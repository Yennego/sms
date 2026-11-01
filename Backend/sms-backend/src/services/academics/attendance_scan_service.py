"""QR ID-card scanning and printing (implementation guide, section 6.4).

Gate scanners may queue scans while offline and send them later (phase6-design.md §5): the scan
carries the time the card was read (scanned_at) and an id of its own (client_scan_id). The read
time judges present/late when it is believable; a scan id seen before returns the first result.
"""
from datetime import UTC, datetime, timedelta
from typing import Any, List, Optional
from uuid import UUID, uuid4

from sqlalchemy.exc import IntegrityError

from src.core.exceptions.business import (
    BusinessRuleViolationError, EntityNotFoundError, PermissionDeniedError
)
from src.db.models.academics.attendance import AttendanceStatus, PRESENT_STATUSES
from src.db.models.academics.class_model import Class
from src.db.models.academics.daily_attendance import (
    AttendanceEvent, AttendanceEventType, AttendanceSource, DailyAttendance
)
from src.db.models.people.student import Student
from src.schemas.academics.attendance_scan import IdCard, ScanRejectReason, ScanResult, ScannedStudent
from src.services.academics import qr_card_service
from src.services.academics.attendance_access import (
    check_class_marking_permission, enrolled_student_ids, is_admin, role_names
)
from src.services.academics.daily_attendance_service import DailyAttendanceService
from src.services.notification import alerts

SCANNER_ROLE = "attendance-scanner"
MAX_SCAN_AGE = timedelta(hours=12)  # an older queued scan is judged at the server's time
REJECT_REASONS = set(ScanRejectReason.__args__)


class AttendanceScanService(DailyAttendanceService):
    """Check-in/out by ID card scan, plus ID card generation."""

    # --- Permissions -----------------------------------------------------------------

    def _can_scan_any(self, user: Any) -> bool:
        return is_admin(user) or SCANNER_ROLE in role_names(user)

    def _can_scan_student(self, user: Any, cls: Class) -> bool:
        """Admins and gate scanners scan anyone; a sponsor only their own class."""
        if self._can_scan_any(user):
            return True
        try:
            check_class_marking_permission(self.db, cls, user.id)
            return True
        except PermissionDeniedError:
            return False

    # --- Scanning --------------------------------------------------------------------

    def _student_summary(self, student: Student, cls: Optional[Class] = None) -> ScannedStudent:
        return ScannedStudent(
            id=student.id,
            name=f"{student.first_name} {student.last_name}".strip(),
            admission_number=student.admission_number,
            photo=student.photo,
            class_name=cls.name if cls else None,
        )

    def _reject(
        self, reason: str, user: Any, device_label: Optional[str], *,
        student: Optional[Student] = None, cls: Optional[Class] = None, mode: str = "check_in"
    ) -> ScanResult:
        self._log(AttendanceEventType.SCAN_REJECTED, student_id=student.id if student else None,
                  actor_id=user.id, reason=reason, device_label=device_label)
        self.db.commit()
        return ScanResult(
            result="rejected", reason=reason, mode=mode,
            student=self._student_summary(student, cls) if student else None,
        )

    def _duplicate(
        self, record: DailyAttendance, student: Student, cls: Class, user: Any,
        device_label: Optional[str], mode: str, note: str
    ) -> ScanResult:
        self._log(AttendanceEventType.SCAN_DUPLICATE, record=record, old_status=record.status.value,
                  new_status=record.status.value, actor_id=user.id, reason=note, device_label=device_label)
        self.db.commit()
        return ScanResult(
            result="duplicate", mode=mode, student=self._student_summary(student, cls),
            status=record.status, check_in_at=record.check_in_at, check_out_at=record.check_out_at,
        )

    def _check_in(
        self, student: Student, cls: Class, user: Any, device_label: Optional[str], *,
        source: AttendanceSource, event_type: AttendanceEventType, reason: Optional[str] = None
    ) -> ScanResult:
        """Precedence (guide 6.3.3): first arrival is present/late; repeat arrivals are
        duplicates; excused/sick are never overwritten; an absent mark is upgraded
        because the student is physically here."""
        settings = self.get_settings()
        now, local = self.now_utc(), self.local_now()
        today = local.date()

        record = self._records_on(today, [student.id]).get(str(student.id))
        if record is not None and record.status != AttendanceStatus.ABSENT:
            note = "Already checked in" if record.status in PRESENT_STATUSES else f"Kept {record.status.value} mark"
            return self._duplicate(record, student, cls, user, device_label, "check_in", note)

        if local.time() > settings.scan_closes_at:
            return self._reject("scan_closed", user, device_label, student=student, cls=cls)

        new_status = AttendanceStatus.LATE if local.time() > settings.late_after else AttendanceStatus.PRESENT
        old_status = record.status.value if record is not None else None
        if record is None:
            record = DailyAttendance(id=uuid4(), tenant_id=self.tenant_id, student_id=student.id, date=today)
            self.db.add(record)
        record.class_id = cls.id
        record.academic_year_id = cls.academic_year_id
        record.status = new_status
        record.source = source
        record.check_in_at = now
        record.marked_by = user.id
        record.marked_at = now
        self._log(event_type, record=record, old_status=old_status, new_status=new_status.value,
                  actor_id=user.id, reason=reason, device_label=device_label)
        if new_status == AttendanceStatus.LATE:
            self._alerts.append(lambda: alerts.attendance_late(self.db, self.tenant_id, student.id, today, local))
        try:
            self._commit()
        except BusinessRuleViolationError:
            # Another scanner read the same card at the same moment and won
            existing = self._records_on(today, [student.id])[str(student.id)]
            return self._duplicate(existing, student, cls, user, device_label, "check_in", "Simultaneous scan")
        self.db.refresh(record)
        return ScanResult(
            result="accepted", mode="check_in", student=self._student_summary(student, cls),
            status=record.status, check_in_at=record.check_in_at,
        )

    def _check_out(self, student: Student, cls: Class, user: Any, device_label: Optional[str]) -> ScanResult:
        if not self.get_settings().allow_checkout_scan:
            return self._reject("checkout_disabled", user, device_label, student=student, cls=cls, mode="check_out")
        today = self.school_today()
        record = self._records_on(today, [student.id]).get(str(student.id))
        if record is None or record.status not in PRESENT_STATUSES:
            return self._reject("not_checked_in", user, device_label, student=student, cls=cls, mode="check_out")
        if record.check_out_at is not None:
            return self._duplicate(record, student, cls, user, device_label, "check_out", "Already checked out")
        record.check_out_at = self.now_utc()
        self._log(AttendanceEventType.SCAN_ACCEPTED, record=record, old_status=record.status.value,
                  new_status=record.status.value, actor_id=user.id, reason="check_out", device_label=device_label)
        self._commit()
        self.db.refresh(record)
        return ScanResult(
            result="accepted", mode="check_out", student=self._student_summary(student, cls),
            status=record.status, check_in_at=record.check_in_at, check_out_at=record.check_out_at,
        )

    def _resolve_for_scan(
        self, student: Student, user: Any, device_label: Optional[str], mode: str
    ):
        """Shared checks after the student is known. Returns (cls, None) or (None, rejection)."""
        if student.status != "active":
            return None, self._reject("inactive_student", user, device_label, student=student, mode=mode)
        info = self.day_info(self.school_today())
        if not info.is_school_day:
            return None, self._reject("not_school_day", user, device_label, student=student, mode=mode)
        try:
            cls = self._homeroom(student.id, info.date)
        except BusinessRuleViolationError:
            return None, self._reject("not_enrolled", user, device_label, student=student, mode=mode)
        if not self._can_scan_student(user, cls):
            return None, self._reject("not_your_class", user, device_label, student=student, cls=cls, mode=mode)
        return cls, None

    # --- Queued (offline) scans --------------------------------------------------------

    def _scan_time(self, scanned_at: Optional[datetime]) -> Optional[datetime]:
        """The read time, if it is today (school time) and at most 12 hours old; the server's time
        when there is none or it is in the future (a wrong device clock). None when the read is
        from an earlier day or older than 12 hours: that scan can't count any more."""
        server = self.now_utc()
        if scanned_at is None:
            return server
        at = scanned_at if scanned_at.tzinfo is not None else scanned_at.replace(tzinfo=UTC)
        if at > server:
            return server
        zone = self.local_now().tzinfo
        if server - at > MAX_SCAN_AGE or at.astimezone(zone).date() != server.astimezone(zone).date():
            return None
        return at.astimezone(UTC)

    def _seen(self, client_scan_id: Optional[str]) -> Optional[ScanResult]:
        """The result of a scan already received with this id (nothing is logged again)."""
        if not client_scan_id:
            return None
        event = self.db.query(AttendanceEvent).filter(
            AttendanceEvent.tenant_id == self.tenant_id, AttendanceEvent.client_scan_id == client_scan_id
        ).first()
        if event is None:
            return None
        student = self.db.query(Student).filter(
            Student.id == event.student_id, Student.tenant_id == self.tenant_id
        ).first() if event.student_id else None
        record = self._get_record(event.daily_attendance_id) if event.daily_attendance_id else None
        cls = self.db.query(Class).filter(Class.id == record.class_id).first() if record else None
        check_out_reasons = ("check_out", "checkout_disabled", "not_checked_in", "Already checked out")
        mode = "check_out" if event.reason in check_out_reasons else "check_in"
        summary = self._student_summary(student, cls) if student else None
        if event.event_type == AttendanceEventType.SCAN_REJECTED.value or record is None:
            reason = event.reason if event.reason in REJECT_REASONS else None
            return ScanResult(result="rejected", reason=reason, mode=mode, student=summary)
        return ScanResult(result="duplicate", mode=mode, student=summary, status=record.status,
                          check_in_at=record.check_in_at, check_out_at=record.check_out_at)

    def _queued(self, client_scan_id: Optional[str], scanned_at: Optional[datetime], handle, expired) -> ScanResult:
        """Run one scan at its read time, once per client_scan_id; `expired` rejects a read that
        is too old to count."""
        seen = self._seen(client_scan_id)
        if seen is not None:
            return seen
        at = self._scan_time(scanned_at)
        if at is None:
            self._client_scan_id = client_scan_id
            try:
                return expired()
            finally:
                self._client_scan_id = None
        server_clock = self.now_utc
        self.now_utc = lambda: at
        self._client_scan_id = client_scan_id
        try:
            return handle()
        except IntegrityError:
            # The same scan id arrived twice at once and the other request recorded it first
            self.db.rollback()
            seen = self._seen(client_scan_id)
            if seen is None:
                raise
            return seen
        finally:
            self.now_utc = server_clock
            self._client_scan_id = None

    def scan(self, token: str, mode: str, device_label: Optional[str], user: Any, *,
             scanned_at: Optional[datetime] = None, client_scan_id: Optional[str] = None) -> ScanResult:
        """Scan outcomes are returned (not raised) so the scanner screen can show them."""
        return self._queued(client_scan_id, scanned_at, lambda: self._scan(token, mode, device_label, user),
                            lambda: self._reject("scan_expired", user, device_label, mode=mode))

    def _scan(self, token: str, mode: str, device_label: Optional[str], user: Any) -> ScanResult:
        try:
            decoded = qr_card_service.verify_token(token)
        except qr_card_service.InvalidToken:
            return self._reject("invalid_signature", user, device_label, mode=mode)
        if decoded.tenant_id != self.tenant_id:
            return self._reject("wrong_tenant", user, device_label, mode=mode)
        student = self.db.query(Student).filter(
            Student.id == decoded.student_id, Student.tenant_id == self.tenant_id
        ).first()
        if student is None:
            return self._reject("unknown_student", user, device_label, mode=mode)
        if (student.card_version or 1) != decoded.card_version:
            return self._reject("revoked", user, device_label, student=student, mode=mode)

        cls, rejection = self._resolve_for_scan(student, user, device_label, mode)
        if rejection:
            return rejection
        if mode == "check_out":
            return self._check_out(student, cls, user, device_label)
        return self._check_in(student, cls, user, device_label,
                              source=AttendanceSource.QR, event_type=AttendanceEventType.SCAN_ACCEPTED)

    def manual_check_in(self, admission_number: str, device_label: Optional[str], user: Any, *,
                        scanned_at: Optional[datetime] = None, client_scan_id: Optional[str] = None) -> ScanResult:
        """Fallback at the scanner for a damaged/forgotten card. Recorded as a manual mark."""
        return self._queued(client_scan_id, scanned_at,
                            lambda: self._manual_check_in(admission_number, device_label, user),
                            lambda: self._reject("scan_expired", user, device_label))

    def _manual_check_in(self, admission_number: str, device_label: Optional[str], user: Any) -> ScanResult:
        student = self.db.query(Student).filter(
            Student.tenant_id == self.tenant_id,
            Student.admission_number == admission_number.strip()
        ).first()
        if student is None:
            return self._reject("unknown_student", user, device_label)
        cls, rejection = self._resolve_for_scan(student, user, device_label, "check_in")
        if rejection:
            return rejection
        return self._check_in(student, cls, user, device_label, source=AttendanceSource.MANUAL,
                              event_type=AttendanceEventType.MANUAL_SET,
                              reason="Checked in at scanner without card")

    # --- ID cards --------------------------------------------------------------------

    def _card(self, student: Student, cls: Optional[Class]) -> IdCard:
        if student.card_issued_at is None:
            student.card_issued_at = self.now_utc()
        token = qr_card_service.build_token(self.tenant_id, student.id, student.card_version or 1)
        return IdCard(
            student_id=student.id,
            student_name=f"{student.first_name} {student.last_name}".strip(),
            admission_number=student.admission_number,
            photo=student.photo,
            class_name=cls.name if cls else None,
            academic_year=cls.academic_year.name if cls and cls.academic_year else None,
            card_version=student.card_version or 1,
            card_issued_at=student.card_issued_at,
            qr_svg=qr_card_service.qr_svg(token),
        )

    def _require_admin(self, user: Any) -> None:
        if not is_admin(user):
            raise PermissionDeniedError("manage", "ID cards (administrator only)")

    def class_cards(self, class_id: UUID, user: Any) -> List[IdCard]:
        self._require_admin(user)
        cls = self._get_class(class_id)
        ids = enrolled_student_ids(self.db, self.tenant_id, cls)
        students = self.db.query(Student).filter(
            Student.id.in_([UUID(s) for s in ids])
        ).order_by(Student.last_name, Student.first_name).all() if ids else []
        cards = [self._card(s, cls) for s in students]
        self.db.commit()  # persists first-issue dates
        return cards

    def student_card(self, student_id: UUID, user: Any) -> IdCard:
        self._require_admin(user)
        student = self._get_student(student_id)
        cls = self._current_class(student.id)
        card = self._card(student, cls)
        self.db.commit()
        return card

    def reissue_card(self, student_id: UUID, user: Any) -> IdCard:
        """New card version: every previously printed card for this student stops working."""
        self._require_admin(user)
        student = self._get_student(student_id)
        student.card_version = (student.card_version or 1) + 1
        student.card_issued_at = self.now_utc()
        card = self._card(student, self._current_class(student.id))
        self.db.commit()
        return card

    def _get_student(self, student_id: UUID) -> Student:
        student = self.db.query(Student).filter(
            Student.id == student_id, Student.tenant_id == self.tenant_id
        ).first()
        if not student:
            raise EntityNotFoundError("Student", student_id)
        return student

    def _current_class(self, student_id: UUID) -> Optional[Class]:
        try:
            return self._homeroom(student_id, self.school_today())
        except BusinessRuleViolationError:
            return None
