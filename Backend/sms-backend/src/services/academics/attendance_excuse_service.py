"""Excuse documents, parent-submitted excuses and the review queue."""
import base64
import binascii
import io
from datetime import date, timedelta
from typing import Any, List, Optional
from uuid import UUID, uuid4

from src.core.exceptions.business import (
    BusinessRuleViolationError, EntityNotFoundError, PermissionDeniedError
)
from src.db.models.academics.attendance import AttendanceStatus, PRESENT_STATUSES
from src.db.models.academics.class_model import Class
from src.db.models.academics.daily_attendance import (
    AttendanceDocument, AttendanceEvent, AttendanceEventType, AttendanceSource, DailyAttendance,
    ExcuseStatus
)
from src.db.models.people.student import Student
from src.db.models.resources.file import StoredFile
from src.schemas.academics.daily_attendance import (
    MAX_EXCUSE_DOCUMENT_BYTES, ChildSummary, ExcuseDocumentIn, ExcuseDocumentOut, ExcuseListItem,
    ExcuseWithDocument, ParentExcuseCreate
)
from src.services.academics.attendance_access import (
    check_class_marking_permission, is_admin, resolve_viewable_student_id, role_names
)
from src.services.academics.daily_attendance_service import DailyAttendanceService
from src.services import files

PARENT_DAYS_BACK = 14     # parents can excuse absences up to two weeks old
PARENT_DAYS_AHEAD = 30    # ...and report planned absences up to a month ahead
IMAGE_MAX_SIDE = 1600     # px; keeps notes readable while shrinking phone photos


def _prepare_document(doc: ExcuseDocumentIn) -> tuple:
    """Decode, validate and (for images) re-encode. Returns (filename, content_type, bytes)."""
    try:
        raw = base64.b64decode(doc.data_base64, validate=True)
    except (binascii.Error, ValueError):
        raise BusinessRuleViolationError("The document could not be read (invalid base64)")
    if not raw:
        raise BusinessRuleViolationError("The document is empty")
    if len(raw) > MAX_EXCUSE_DOCUMENT_BYTES:
        raise BusinessRuleViolationError("The document is larger than 5 MB")

    if doc.content_type == "application/pdf":
        if not raw.startswith(b"%PDF-"):
            raise BusinessRuleViolationError("The file is not a valid PDF")
        return doc.filename, doc.content_type, raw

    # Re-encoding validates the image and strips metadata (e.g. GPS location in phone photos)
    from PIL import Image, UnidentifiedImageError
    try:
        img = Image.open(io.BytesIO(raw))
        img = img.convert("RGB")
        img.thumbnail((IMAGE_MAX_SIDE, IMAGE_MAX_SIDE))
        out = io.BytesIO()
        img.save(out, format="JPEG", quality=82, optimize=True)
    except (UnidentifiedImageError, OSError):
        raise BusinessRuleViolationError("The file is not a valid image")
    stem = doc.filename.rsplit(".", 1)[0] or "document"
    return f"{stem}.jpg", "image/jpeg", out.getvalue()


class AttendanceExcuseService(DailyAttendanceService):

    # --- Documents -------------------------------------------------------------------

    def _document_path(self, record: DailyAttendance) -> str:
        return f"/academics/attendance/daily/{record.id}/excuse/document"

    def _store_document(self, record: DailyAttendance, doc: ExcuseDocumentIn, user_id: UUID) -> None:
        filename, content_type, data = _prepare_document(doc)
        # The bytes go to file storage; a replaced document's old file is removed later by
        # scripts/cleanup_files.py once nothing refers to it
        stored = files.store_file(self.db, self.tenant_id, data, filename=filename, content_type=content_type,
                                  uploaded_by=user_id)
        row = self.db.query(AttendanceDocument).filter(
            AttendanceDocument.tenant_id == self.tenant_id,
            AttendanceDocument.daily_attendance_id == record.id
        ).first()
        if row is None:
            row = AttendanceDocument(tenant_id=self.tenant_id, daily_attendance_id=record.id)
            self.db.add(row)
        row.filename, row.content_type, row.size_bytes, row.file_id = filename, content_type, len(data), stored.id
        row.uploaded_by = user_id
        record.excuse_document_url = self._document_path(record)

    def _ensure_can_view_record(self, record: DailyAttendance, user: Any) -> None:
        names = role_names(user)
        if "student" in names or "parent" in names:
            resolve_viewable_student_id(self.db, user, record.student_id)
            return
        check_class_marking_permission(self.db, self._get_class(record.class_id), user.id)

    def get_document(self, daily_id: UUID, user: Any) -> ExcuseDocumentOut:
        record = self._get_record(daily_id)
        self._ensure_can_view_record(record, user)
        row = self.db.query(AttendanceDocument).filter(
            AttendanceDocument.tenant_id == self.tenant_id,
            AttendanceDocument.daily_attendance_id == record.id
        ).first()
        if row is None:
            raise EntityNotFoundError("AttendanceDocument", daily_id)
        stored = self.db.query(StoredFile).filter(
            StoredFile.tenant_id == self.tenant_id, StoredFile.id == row.file_id
        ).one()
        return ExcuseDocumentOut(
            filename=row.filename, content_type=row.content_type, size_bytes=row.size_bytes,
            data_base64=base64.b64encode(files.read_file(stored)).decode()
        )

    def set_excuse_with_document(self, daily_id: UUID, data: ExcuseWithDocument, user: Any) -> DailyAttendance:
        """Staff excuse (pre-approved), optionally with a supporting document."""
        record = self.set_excuse(daily_id, data, user)
        if data.document is not None:
            self._store_document(record, data.document, user.id)
            self._commit()
            self.db.refresh(record)
        return record

    # --- Parent submissions ----------------------------------------------------------

    def my_children(self, user: Any) -> List[ChildSummary]:
        from src.db.models.people.parent import parent_student

        if "parent" not in role_names(user):
            raise PermissionDeniedError("list", "children (parents only)")
        ids = [row.student_id for row in self.db.query(parent_student.c.student_id)
               .filter(parent_student.c.parent_id == user.id).all()]
        students = self.db.query(Student).filter(
            Student.id.in_(ids), Student.tenant_id == self.tenant_id
        ).order_by(Student.first_name).all() if ids else []
        today = self.school_today()
        result = []
        for s in students:
            try:
                class_name = self._homeroom(s.id, today).name
            except BusinessRuleViolationError:
                class_name = None
            result.append(ChildSummary(
                student_id=s.id, name=f"{s.first_name} {s.last_name}".strip(),
                admission_number=s.admission_number, class_name=class_name
            ))
        return result

    def submit_parent_excuse(self, data: ParentExcuseCreate, user: Any) -> DailyAttendance:
        """A parent reports an absence (past, today or planned). It stays pending until
        an administrator reviews it, or the sponsor marks the day excused."""
        if "parent" not in role_names(user):
            raise PermissionDeniedError("submit", "excuses (parents only)")
        resolve_viewable_student_id(self.db, user, data.student_id)

        today = self.school_today()
        if data.date < today - timedelta(days=PARENT_DAYS_BACK):
            raise BusinessRuleViolationError(f"Excuses can be submitted up to {PARENT_DAYS_BACK} days after the absence")
        if data.date > today + timedelta(days=PARENT_DAYS_AHEAD):
            raise BusinessRuleViolationError(f"Planned absences can be reported up to {PARENT_DAYS_AHEAD} days ahead")
        info = self.day_info(data.date)
        if not info.is_school_day:
            raise BusinessRuleViolationError(f"{data.date} is not a school day ({info.reason})")
        cls: Class = self._homeroom(data.student_id, data.date)

        record = self._records_on(data.date, [data.student_id]).get(str(data.student_id))
        if record is not None:
            if record.status in PRESENT_STATUSES:
                raise BusinessRuleViolationError(
                    "Your child was marked present that day. Contact the class sponsor if this is wrong."
                )
            if record.status == AttendanceStatus.EXCUSED and record.excuse_status == ExcuseStatus.APPROVED:
                raise BusinessRuleViolationError("This day is already excused")
        old_status = record.status.value if record is not None else None
        if record is None:
            # A reported absence; a scan on the day still upgrades it if the child comes in
            record = DailyAttendance(
                id=uuid4(), tenant_id=self.tenant_id, student_id=data.student_id, date=data.date,
                class_id=cls.id, academic_year_id=cls.academic_year_id,
                status=AttendanceStatus.ABSENT, source=AttendanceSource.MANUAL,
                marked_by=user.id, marked_at=self.now_utc()
            )
            self.db.add(record)
        record.excuse_reason = data.reason.strip()
        record.excuse_status = ExcuseStatus.PENDING
        record.excuse_reviewed_by = None
        if data.document is not None:
            self._store_document(record, data.document, user.id)
        self._log(AttendanceEventType.EXCUSE_SET, record=record, old_status=old_status,
                  new_status=record.status.value, actor_id=user.id,
                  reason=f"Submitted by parent (pending review): {record.excuse_reason}")
        self._commit()
        self.db.refresh(record)
        return record

    # --- Review queue ----------------------------------------------------------------

    def list_excuses(
        self, user: Any, excuse_status: Optional[ExcuseStatus] = ExcuseStatus.PENDING,
        start: Optional[date] = None, end: Optional[date] = None
    ) -> List[ExcuseListItem]:
        if not is_admin(user):
            raise PermissionDeniedError("review", "excuses (administrator only)")
        from src.db.models.auth import User as UserModel

        query = self.db.query(DailyAttendance, Student, Class).join(
            Student, Student.id == DailyAttendance.student_id
        ).join(Class, Class.id == DailyAttendance.class_id).filter(
            DailyAttendance.tenant_id == self.tenant_id,
            DailyAttendance.excuse_status.isnot(None)
        )
        if excuse_status is not None:
            query = query.filter(DailyAttendance.excuse_status == excuse_status)
        if start:
            query = query.filter(DailyAttendance.date >= start)
        if end:
            query = query.filter(DailyAttendance.date <= end)
        rows = query.order_by(DailyAttendance.date.asc()).limit(500).all()

        doc_ids = {
            r.daily_attendance_id for r in self.db.query(AttendanceDocument.daily_attendance_id).filter(
                AttendanceDocument.tenant_id == self.tenant_id,
                AttendanceDocument.daily_attendance_id.in_([rec.id for rec, _, _ in rows])
            ).all()
        } if rows else set()
        # Who submitted/recorded the excuse, and when: the latest excuse event per record
        submitted: dict = {}
        if rows:
            events = self.db.query(AttendanceEvent.daily_attendance_id, AttendanceEvent.occurred_at,
                                   UserModel.first_name, UserModel.last_name).outerjoin(
                UserModel, UserModel.id == AttendanceEvent.actor_id
            ).filter(
                AttendanceEvent.tenant_id == self.tenant_id,
                AttendanceEvent.event_type == AttendanceEventType.EXCUSE_SET.value,
                AttendanceEvent.daily_attendance_id.in_([rec.id for rec, _, _ in rows])
            ).order_by(AttendanceEvent.occurred_at.asc()).all()
            for daily_id, occurred_at, first, last in events:
                submitted[daily_id] = (f"{first or ''} {last or ''}".strip() or None, occurred_at)

        return [
            ExcuseListItem(
                daily_id=rec.id, student_id=student.id,
                student_name=f"{student.first_name} {student.last_name}".strip(),
                class_name=cls.name, date=rec.date, status=rec.status,
                excuse_status=rec.excuse_status, excuse_reason=rec.excuse_reason,
                has_document=rec.id in doc_ids,
                submitted_by_name=submitted.get(rec.id, (None, None))[0],
                submitted_at=submitted.get(rec.id, (None, rec.marked_at))[1],
            )
            for rec, student, cls in rows
        ]
