"""School-day attendance: one record per student per day (implementation guide, section 6.3)."""
from datetime import UTC, date, datetime, timedelta
from typing import Any, Callable, Dict, Iterable, List, Optional, Tuple
from uuid import UUID, uuid4
from zoneinfo import ZoneInfo

from fastapi import Depends
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from src.core.exceptions.business import (
    BusinessRuleViolationError, EntityNotFoundError, PermissionDeniedError
)
from src.core.middleware.tenant import get_tenant_from_request
from src.db.crud.academics.class_crud import class_crud
from src.db.models.academics.attendance import (
    EXCUSED_STATUSES, AttendanceStatus, calculate_attendance_rate
)
from src.db.models.academics.class_model import Class
from src.db.models.academics.daily_attendance import (
    AttendanceEvent, AttendanceEventType, AttendanceSettings, AttendanceSource,
    DailyAttendance, ExcuseStatus, SchoolCalendarDay
)
from src.db.models.academics.enrollment import Enrollment
from src.db.models.people.student import Student
from src.db.session import get_db
from src.schemas.academics.daily_attendance import (
    AttendanceSettingsUpdate, DailyAttendanceSummary, DailyBulkSet, DailyRoster, DailyRosterEntry,
    DailyStatusSet, ExcuseReview, ExcuseSet, SchoolCalendarDayUpsert, SchoolDayInfo
)
from src.services.academics.attendance_access import (
    academic_year_for, check_class_marking_permission, check_enrollment, enrolled_student_ids,
    is_admin, resolve_viewable_student_id
)
from src.services.notification import alerts

CONCURRENT_CHANGE = "Attendance was changed by someone else while saving. Reload and try again."


class DailyAttendanceService:
    """Daily attendance for the current tenant."""

    def __init__(
        self,
        tenant: Any = Depends(get_tenant_from_request),
        db: Session = Depends(get_db)
    ):
        tenant_id = tenant["id"] if isinstance(tenant, dict) else getattr(tenant, "id", tenant)
        self.tenant_id = tenant_id if isinstance(tenant_id, UUID) else UUID(str(tenant_id))
        self.db = db
        self.now_utc: Callable[[], datetime] = lambda: datetime.now(UTC)  # overridable in tests
        self._settings: Optional[AttendanceSettings] = None
        self._alerts: List[Callable[[], Any]] = []  # parents' alerts, written by the next _commit
        self._client_scan_id: Optional[str] = None  # the gate scanner's id for the scan being handled

    # --- Settings & time -------------------------------------------------------------

    def get_settings(self) -> AttendanceSettings:
        """Saved settings, or defaults (not persisted) if the school hasn't saved any."""
        if self._settings is None:
            row = self.db.query(AttendanceSettings).filter(
                AttendanceSettings.tenant_id == self.tenant_id
            ).first()
            if row is None:
                defaults = AttendanceSettingsUpdate()
                row = AttendanceSettings(tenant_id=self.tenant_id, **defaults.model_dump())
            self._settings = row
        return self._settings

    def update_settings(self, data: AttendanceSettingsUpdate) -> AttendanceSettings:
        row = self.db.query(AttendanceSettings).filter(
            AttendanceSettings.tenant_id == self.tenant_id
        ).first()
        if row is None:
            row = AttendanceSettings(tenant_id=self.tenant_id)
            self.db.add(row)
        for field, value in data.model_dump().items():
            setattr(row, field, value)
        self.db.commit()
        self.db.refresh(row)
        self._settings = row
        return row

    def local_now(self) -> datetime:
        return self.now_utc().astimezone(ZoneInfo(self.get_settings().timezone))

    def school_today(self) -> date:
        return self.local_now().date()

    # --- School calendar -------------------------------------------------------------

    def _calendar_overrides(self, start: date, end: date) -> Dict[date, SchoolCalendarDay]:
        rows = self.db.query(SchoolCalendarDay).filter(
            SchoolCalendarDay.tenant_id == self.tenant_id,
            SchoolCalendarDay.date >= start,
            SchoolCalendarDay.date <= end
        ).all()
        return {row.date: row for row in rows}

    def _school_day_status(
        self, on_date: date, academic_year: Any, override: Optional[SchoolCalendarDay]
    ) -> Tuple[bool, Optional[str]]:
        if academic_year is None:
            return False, "Outside the academic year"
        if override is not None:
            if override.is_school_day:
                return True, override.label or "Make-up school day"
            return False, override.label or "Holiday"
        if on_date.weekday() not in self.get_settings().school_days:
            return False, "Not a school day of the week"
        return True, None

    def day_info(self, on_date: date) -> SchoolDayInfo:
        override = self._calendar_overrides(on_date, on_date).get(on_date)
        ay = academic_year_for(self.db, self.tenant_id, on_date)
        is_school_day, reason = self._school_day_status(on_date, ay, override)
        today = self.school_today()
        cutoff_passed = on_date < today or (
            on_date == today and self.local_now().time() >= self.get_settings().auto_absent_at
        )
        return SchoolDayInfo(
            date=on_date, is_school_day=is_school_day, reason=reason, today=today,
            auto_absent_applied=is_school_day and cutoff_passed
        )

    def list_calendar(self, start: date, end: date) -> List[SchoolCalendarDay]:
        return sorted(self._calendar_overrides(start, end).values(), key=lambda r: r.date)

    def set_calendar_day(self, on_date: date, data: SchoolCalendarDayUpsert) -> SchoolCalendarDay:
        row = self._calendar_overrides(on_date, on_date).get(on_date)
        if row is None:
            row = SchoolCalendarDay(tenant_id=self.tenant_id, date=on_date)
            self.db.add(row)
        row.is_school_day = data.is_school_day
        row.label = data.label
        self.db.commit()
        self.db.refresh(row)
        return row

    def delete_calendar_day(self, on_date: date) -> None:
        row = self._calendar_overrides(on_date, on_date).get(on_date)
        if row is None:
            raise EntityNotFoundError("SchoolCalendarDay", str(on_date))
        self.db.delete(row)
        self.db.commit()

    # --- Lookups ---------------------------------------------------------------------

    def _get_class(self, class_id: UUID) -> Class:
        cls = class_crud.get_by_id(self.db, tenant_id=self.tenant_id, id=class_id)
        if not cls:
            raise EntityNotFoundError("Class", class_id)
        return cls

    def _get_record(self, daily_id: UUID) -> DailyAttendance:
        record = self.db.query(DailyAttendance).filter(
            DailyAttendance.tenant_id == self.tenant_id, DailyAttendance.id == daily_id
        ).first()
        if not record:
            raise EntityNotFoundError("DailyAttendance", daily_id)
        return record

    def _records_on(self, on_date: date, student_ids: Iterable[UUID]) -> Dict[str, DailyAttendance]:
        ids = [UUID(str(s)) for s in student_ids]
        if not ids:
            return {}
        rows = self.db.query(DailyAttendance).filter(
            DailyAttendance.tenant_id == self.tenant_id,
            DailyAttendance.date == on_date,
            DailyAttendance.student_id.in_(ids)
        ).all()
        return {str(r.student_id): r for r in rows}

    def _homeroom(self, student_id: UUID, on_date: date) -> Class:
        """The class a student is actively enrolled in on a date (grade + section + year)."""
        ay = academic_year_for(self.db, self.tenant_id, on_date)
        if ay is None:
            raise BusinessRuleViolationError(f"{on_date} is outside every academic year")
        cls = self.db.query(Class).join(
            Enrollment,
            (Enrollment.academic_year_id == Class.academic_year_id)
            & (Enrollment.grade_id == Class.grade_id)
            & (Enrollment.section_id == Class.section_id)
        ).filter(
            Class.tenant_id == self.tenant_id,
            Enrollment.tenant_id == self.tenant_id,
            Enrollment.student_id == student_id,
            Enrollment.academic_year_id == ay.id,
            Enrollment.is_active == True
        ).first()
        if not cls:
            raise BusinessRuleViolationError("Student is not actively enrolled in a class for this date")
        return cls

    def _require_markable_day(self, on_date: date) -> SchoolDayInfo:
        info = self.day_info(on_date)
        if on_date > info.today:
            raise BusinessRuleViolationError("Attendance can't be marked for a future date")
        if not info.is_school_day:
            raise BusinessRuleViolationError(f"{on_date} is not a school day ({info.reason})")
        return info

    # --- Events ----------------------------------------------------------------------

    def _log(
        self, event_type: AttendanceEventType, *, record: Optional[DailyAttendance] = None,
        student_id: Optional[UUID] = None, old_status: Optional[str] = None,
        new_status: Optional[str] = None, actor_id: Optional[UUID] = None,
        reason: Optional[str] = None, device_label: Optional[str] = None
    ) -> None:
        # A scan logs one event; it carries the scanner's id for the scan, if any
        client_scan_id, self._client_scan_id = self._client_scan_id, None
        self.db.add(AttendanceEvent(
            tenant_id=self.tenant_id,
            daily_attendance=record,
            student_id=student_id or (record.student_id if record is not None else None),
            event_type=event_type.value,
            old_status=old_status,
            new_status=new_status,
            actor_id=actor_id,
            reason=reason,
            device_label=device_label,
            occurred_at=self.now_utc(),
            client_scan_id=client_scan_id
        ))

    # --- Manual marking (precedence: a manual mark always wins) ----------------------

    def _apply_manual(
        self, record: Optional[DailyAttendance], *, student_id: UUID, cls: Class,
        on_date: date, data: DailyStatusSet, actor_id: UUID
    ) -> DailyAttendance:
        old_status = record.status.value if record is not None else None
        if record is None:
            record = DailyAttendance(
                id=uuid4(), tenant_id=self.tenant_id, student_id=student_id, date=on_date
            )
            self.db.add(record)
        record.class_id = cls.id
        record.academic_year_id = cls.academic_year_id
        record.status = data.status
        record.source = AttendanceSource.MANUAL
        record.marked_by = actor_id
        record.marked_at = self.now_utc()
        if data.notes is not None:
            record.notes = data.notes

        if data.status == AttendanceStatus.EXCUSED:
            # Staff-entered excuses are pre-approved
            record.excuse_reason = data.excuse_reason.strip()
            record.excuse_document_url = data.excuse_document_url
            record.excuse_status = ExcuseStatus.APPROVED
            record.excuse_reviewed_by = actor_id
            event, reason = AttendanceEventType.EXCUSE_SET, record.excuse_reason
        else:
            # A parent's pending excuse waits for review; any other excuse no longer applies
            if record.excuse_status != ExcuseStatus.PENDING:
                record.excuse_reason = None
                record.excuse_document_url = None
                record.excuse_status = None
                record.excuse_reviewed_by = None
            event, reason = AttendanceEventType.MANUAL_SET, data.notes

        self._log(event, record=record, old_status=old_status,
                  new_status=data.status.value, actor_id=actor_id, reason=reason)
        if data.status == AttendanceStatus.ABSENT:
            self._alerts.append(lambda: alerts.attendance_absent(self.db, self.tenant_id, [(student_id, on_date)]))
        return record

    def _commit(self) -> None:
        pending, self._alerts = self._alerts, []
        try:
            self.db.flush()
            # Parents' alerts go in the same transaction as the marks (one per student, day and kind)
            for write_alert in pending:
                write_alert()
            self.db.commit()
        except IntegrityError as exc:
            self.db.rollback()
            # Another request created the same student/day row first; anything else is a real error
            message = str(exc.orig)
            if "uq_daily_attendance_student_date" in message or (
                "UNIQUE" in message and "daily_attendances.student_id" in message
            ):
                raise BusinessRuleViolationError(CONCURRENT_CHANGE)
            raise

    def set_status(self, student_id: UUID, on_date: Optional[date], data: DailyStatusSet, user: Any) -> DailyAttendance:
        on_date = on_date or self.school_today()
        self._require_markable_day(on_date)
        cls = self._homeroom(student_id, on_date)
        check_class_marking_permission(self.db, cls, user.id)

        record = self._records_on(on_date, [student_id]).get(str(student_id))
        record = self._apply_manual(record, student_id=student_id, cls=cls, on_date=on_date,
                                    data=data, actor_id=user.id)
        self._commit()
        self.db.refresh(record)
        return record

    def bulk_set(self, data: DailyBulkSet, user: Any) -> List[DailyAttendance]:
        """Save a whole class roster in one transaction."""
        on_date = data.date or self.school_today()
        cls = self._get_class(data.class_id)
        check_class_marking_permission(self.db, cls, user.id)
        self._require_markable_day(on_date)
        ay = academic_year_for(self.db, self.tenant_id, on_date)
        if ay is None or ay.id != cls.academic_year_id:
            raise BusinessRuleViolationError("The date is outside this class's academic year")

        student_ids = [e.student_id for e in data.entries]
        if len({str(s) for s in student_ids}) != len(student_ids):
            raise BusinessRuleViolationError("Each student can appear only once")
        check_enrollment(self.db, self.tenant_id, cls, student_ids)

        existing = self._records_on(on_date, student_ids)
        results = [
            self._apply_manual(existing.get(str(e.student_id)), student_id=e.student_id, cls=cls,
                               on_date=on_date, data=e, actor_id=user.id)
            for e in data.entries
        ]
        self._commit()
        for record in results:
            self.db.refresh(record)
        return results

    # --- Excuses ---------------------------------------------------------------------

    def set_excuse(self, daily_id: UUID, data: ExcuseSet, user: Any) -> DailyAttendance:
        record = self._get_record(daily_id)
        cls = self._get_class(record.class_id)
        check_class_marking_permission(self.db, cls, user.id)
        status = DailyStatusSet(
            status=AttendanceStatus.EXCUSED, excuse_reason=data.reason, excuse_document_url=data.document_url
        )
        self._apply_manual(record, student_id=record.student_id, cls=cls, on_date=record.date,
                           data=status, actor_id=user.id)
        self._commit()
        self.db.refresh(record)
        return record

    def review_excuse(self, daily_id: UUID, review: ExcuseReview, user: Any) -> DailyAttendance:
        if not is_admin(user):
            raise PermissionDeniedError("review", "excuses (administrator only)")
        record = self._get_record(daily_id)
        if record.excuse_status != ExcuseStatus.PENDING:
            raise BusinessRuleViolationError("Only pending excuses can be reviewed")
        old_status = record.status.value
        record.excuse_status = ExcuseStatus.APPROVED if review.approve else ExcuseStatus.REJECTED
        record.excuse_reviewed_by = user.id
        # Only an absence becomes excused; if the student turned up, the record keeps its status
        if review.approve and record.status == AttendanceStatus.ABSENT:
            record.status = AttendanceStatus.EXCUSED
        if review.notes is not None:
            record.notes = review.notes
        self._log(AttendanceEventType.EXCUSE_REVIEWED, record=record, old_status=old_status,
                  new_status=record.status.value, actor_id=user.id,
                  reason=f"{record.excuse_status.value}: {review.notes or ''}".strip(": "))
        self._commit()
        self.db.refresh(record)
        return record

    # --- Auto-absent -----------------------------------------------------------------

    def _fill_absent(self, on_date: date, rows: List[Tuple[UUID, UUID, UUID]]) -> int:
        """Create AUTO absent records for (student_id, class_id, academic_year_id) rows that
        have no record yet. Never overwrites; safe to run concurrently or repeatedly."""
        if not rows:
            return 0
        dialect = self.db.get_bind().dialect.name
        if dialect == "postgresql":
            from sqlalchemy.dialects.postgresql import insert
        elif dialect == "sqlite":
            from sqlalchemy.dialects.sqlite import insert
        else:
            raise NotImplementedError(f"Auto-absent is not supported on {dialect}")

        now = self.now_utc()
        values = [
            dict(
                id=uuid4(), tenant_id=self.tenant_id, created_at=now, updated_at=now,
                student_id=student_id, class_id=class_id, academic_year_id=ay_id, date=on_date,
                status=AttendanceStatus.ABSENT, source=AttendanceSource.AUTO, marked_at=now
            )
            for student_id, class_id, ay_id in rows
        ]
        stmt = insert(DailyAttendance).values(values).on_conflict_do_nothing(
            index_elements=["tenant_id", "student_id", "date"]
        ).returning(DailyAttendance.id, DailyAttendance.student_id)
        inserted = self.db.execute(stmt).all()
        for record_id, student_id in inserted:
            self.db.add(AttendanceEvent(
                tenant_id=self.tenant_id, daily_attendance_id=record_id, student_id=student_id,
                event_type=AttendanceEventType.AUTO_ABSENT.value, new_status=AttendanceStatus.ABSENT.value,
                reason="Not marked by the auto-absent cut-off", occurred_at=now
            ))
        alerts.attendance_absent(self.db, self.tenant_id, [(student_id, on_date) for _, student_id in inserted])
        self.db.commit()
        return len(inserted)

    def close_day(self, on_date: Optional[date], user: Any) -> int:
        """Mark every unmarked, actively enrolled student absent for a finished school day."""
        if not is_admin(user):
            raise PermissionDeniedError("close", "the attendance day (administrator only)")
        return self.fill_unmarked_absences(on_date or self.school_today())

    def fill_unmarked_absences(self, on_date: date) -> int:
        """close_day without the user check; also run by scripts/close_attendance_days.py."""
        info = self.day_info(on_date)
        if on_date > info.today:
            raise BusinessRuleViolationError("Can't close a future date")
        if not info.is_school_day:
            raise BusinessRuleViolationError(f"{on_date} is not a school day ({info.reason})")
        if not info.auto_absent_applied:
            raise BusinessRuleViolationError(
                f"The auto-absent cut-off ({self.get_settings().auto_absent_at.strftime('%H:%M')}) hasn't passed yet"
            )
        ay = academic_year_for(self.db, self.tenant_id, on_date)
        rows = self.db.query(Enrollment.student_id, Class.id, Class.academic_year_id).join(
            Class,
            (Enrollment.academic_year_id == Class.academic_year_id)
            & (Enrollment.grade_id == Class.grade_id)
            & (Enrollment.section_id == Class.section_id)
        ).filter(
            Enrollment.tenant_id == self.tenant_id,
            Class.tenant_id == self.tenant_id,
            Enrollment.academic_year_id == ay.id,
            Enrollment.is_active == True
        ).all()
        return self._fill_absent(on_date, [tuple(r) for r in rows])

    # --- Reading ---------------------------------------------------------------------

    def get_roster(self, class_id: UUID, on_date: Optional[date], user: Any) -> DailyRoster:
        on_date = on_date or self.school_today()
        cls = self._get_class(class_id)
        check_class_marking_permission(self.db, cls, user.id)
        info = self.day_info(on_date)
        if on_date > info.today:
            raise BusinessRuleViolationError("Attendance can't be viewed for a future date")

        ids = enrolled_student_ids(self.db, self.tenant_id, cls)
        students = self.db.query(Student).filter(
            Student.id.in_([UUID(s) for s in ids])
        ).order_by(Student.last_name, Student.first_name).all() if ids else []

        # Lazy auto-absent: a finished school day never shows unmarked students
        if info.auto_absent_applied and on_date >= self._class_start(cls):
            self._fill_absent(on_date, [(s.id, cls.id, cls.academic_year_id) for s in students])

        records = self._records_on(on_date, [s.id for s in students])
        return DailyRoster(
            class_id=cls.id,
            class_name=cls.name,
            day=info,
            entries=[
                DailyRosterEntry(
                    student_id=s.id,
                    student_name=f"{s.first_name} {s.last_name}".strip(),
                    admission_number=s.admission_number,
                    photo=s.photo,
                    record=records.get(str(s.id))
                )
                for s in students
            ]
        )

    def _class_start(self, cls: Class) -> date:
        """Don't back-fill absences before the class (or its academic year) started."""
        ay_start = cls.academic_year.start_date if cls.academic_year else date.min
        return max(cls.start_date or date.min, ay_start)

    def student_history(
        self, student_id: UUID, start: Optional[date], end: Optional[date], current_user: Any
    ) -> Tuple[date, date, DailyAttendanceSummary, List[DailyAttendance]]:
        resolve_viewable_student_id(self.db, current_user, student_id)
        student = self.db.query(Student).filter(
            Student.id == student_id, Student.tenant_id == self.tenant_id
        ).first()
        if not student:
            raise EntityNotFoundError("Student", student_id)

        if start and end and start > end:
            raise BusinessRuleViolationError("start_date must be on or before end_date")

        today = self.school_today()
        if start and start > today:
            raise BusinessRuleViolationError("The range can't start in the future")
        if start is None:
            ay = academic_year_for(self.db, self.tenant_id, today)
            start = ay.start_date if ay else today - timedelta(days=30)
        end = max(min(end or today, today), start)

        records = self.db.query(DailyAttendance).filter(
            DailyAttendance.tenant_id == self.tenant_id,
            DailyAttendance.student_id == student_id,
            DailyAttendance.date >= start,
            DailyAttendance.date <= end
        ).order_by(DailyAttendance.date.desc()).all()

        counts: Dict[AttendanceStatus, int] = {}
        for r in records:
            counts[r.status] = counts.get(r.status, 0) + 1
        countable = sum(c for s, c in counts.items() if s not in EXCUSED_STATUSES)
        summary = DailyAttendanceSummary(
            school_days=self._count_school_days(start, end),
            present=counts.get(AttendanceStatus.PRESENT, 0) + counts.get(AttendanceStatus.TARDY, 0),
            late=counts.get(AttendanceStatus.LATE, 0),
            absent=counts.get(AttendanceStatus.ABSENT, 0),
            excused=counts.get(AttendanceStatus.EXCUSED, 0),
            sick=counts.get(AttendanceStatus.SICK, 0),
            # None when every record is excused/sick: there's nothing to rate
            attendance_rate=round(calculate_attendance_rate(counts), 1) if countable else None
        )
        return start, end, summary, records

    def _count_school_days(self, start: date, end: date) -> int:
        overrides = self._calendar_overrides(start, end)
        count, day = 0, start
        ay = None
        while day <= end:
            if ay is None or not (ay.start_date <= day <= ay.end_date):
                ay = academic_year_for(self.db, self.tenant_id, day)
            if self._school_day_status(day, ay, overrides.get(day))[0]:
                count += 1
            day += timedelta(days=1)
        return count

    def list_events(self, daily_id: UUID, user: Any) -> List[Tuple[AttendanceEvent, Optional[str]]]:
        from src.db.models.auth import User as UserModel

        record = self._get_record(daily_id)
        check_class_marking_permission(self.db, self._get_class(record.class_id), user.id)
        rows = self.db.query(AttendanceEvent, UserModel.first_name, UserModel.last_name).outerjoin(
            UserModel, UserModel.id == AttendanceEvent.actor_id
        ).filter(
            AttendanceEvent.tenant_id == self.tenant_id,
            AttendanceEvent.daily_attendance_id == daily_id
        ).order_by(AttendanceEvent.occurred_at.asc(), AttendanceEvent.created_at.asc()).all()
        return [
            (event, f"{first or ''} {last or ''}".strip() or None)
            for event, first, last in rows
        ]
