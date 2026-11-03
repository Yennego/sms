"""School-day attendance reporting: today's overview and class reports (guide section 6.5)."""
from datetime import date, timedelta
from typing import Any, Dict, Optional
from uuid import UUID

from sqlalchemy import func

from src.core.exceptions.business import BusinessRuleViolationError, PermissionDeniedError
from src.db.models.academics.attendance import AttendanceStatus, calculate_attendance_rate
from src.db.models.academics.class_model import Class
from src.db.models.academics.daily_attendance import (
    AttendanceSource, DailyAttendance, ExcuseStatus
)
from src.db.models.academics.enrollment import Enrollment
from src.db.models.people.student import Student
from src.schemas.academics.daily_attendance import (
    AttendanceCounts, ClassAttendanceReport, ClassOverview, DailyOverview, StudentReportRow
)
from src.services.academics.attendance_access import (
    academic_year_for, can_view_school_attendance, check_class_viewing_permission, enrolled_student_ids
)
from src.services.academics.daily_attendance_service import DailyAttendanceService

MAX_REPORT_DAYS = 366


def _counts_from(status_counts: Dict[AttendanceStatus, int], enrolled: int = 0, scanned: int = 0) -> AttendanceCounts:
    marked = sum(status_counts.values())
    countable = sum(c for s, c in status_counts.items()
                    if s not in (AttendanceStatus.EXCUSED, AttendanceStatus.SICK))
    return AttendanceCounts(
        enrolled=enrolled,
        present=status_counts.get(AttendanceStatus.PRESENT, 0) + status_counts.get(AttendanceStatus.TARDY, 0),
        late=status_counts.get(AttendanceStatus.LATE, 0),
        absent=status_counts.get(AttendanceStatus.ABSENT, 0),
        excused=status_counts.get(AttendanceStatus.EXCUSED, 0),
        sick=status_counts.get(AttendanceStatus.SICK, 0),
        unmarked=max(enrolled - marked, 0),
        scanned=scanned,
        attendance_rate=round(calculate_attendance_rate(status_counts), 1) if countable else None,
    )


class AttendanceReportService(DailyAttendanceService):

    def overview(self, on_date: Optional[date], user: Any) -> DailyOverview:
        """Whole school for one day: totals and one row per class."""
        if not can_view_school_attendance(user):
            raise PermissionDeniedError("view", "the attendance overview (school attendance readers only)")
        on_date = on_date or self.school_today()
        info = self.day_info(on_date)
        if on_date > info.today:
            raise BusinessRuleViolationError("Can't show attendance for a future date")
        if info.auto_absent_applied:
            self.fill_unmarked_absences(on_date)  # a finished day has no "not marked" students

        pending = self.db.query(func.count(DailyAttendance.id)).filter(
            DailyAttendance.tenant_id == self.tenant_id,
            DailyAttendance.excuse_status == ExcuseStatus.PENDING
        ).scalar() or 0

        ay = academic_year_for(self.db, self.tenant_id, on_date)
        if ay is None:
            return DailyOverview(day=info, totals=AttendanceCounts(), classes=[], pending_excuses=pending)

        classes = self.db.query(Class).filter(
            Class.tenant_id == self.tenant_id, Class.academic_year_id == ay.id, Class.is_active == True
        ).all()
        enrolled = dict(self.db.query(Class.id, func.count(Enrollment.id)).join(
            Enrollment,
            (Enrollment.academic_year_id == Class.academic_year_id)
            & (Enrollment.grade_id == Class.grade_id)
            & (Enrollment.section_id == Class.section_id)
        ).filter(
            Class.tenant_id == self.tenant_id, Enrollment.tenant_id == self.tenant_id,
            Class.academic_year_id == ay.id, Enrollment.is_active == True
        ).group_by(Class.id).all())

        status_rows = self.db.query(
            DailyAttendance.class_id, DailyAttendance.status, func.count(DailyAttendance.id)
        ).filter(
            DailyAttendance.tenant_id == self.tenant_id, DailyAttendance.date == on_date
        ).group_by(DailyAttendance.class_id, DailyAttendance.status).all()
        scanned = dict(self.db.query(DailyAttendance.class_id, func.count(DailyAttendance.id)).filter(
            DailyAttendance.tenant_id == self.tenant_id, DailyAttendance.date == on_date,
            DailyAttendance.source == AttendanceSource.QR
        ).group_by(DailyAttendance.class_id).all())

        by_class: Dict[UUID, Dict[AttendanceStatus, int]] = {}
        all_counts: Dict[AttendanceStatus, int] = {}
        for class_id, status, count in status_rows:
            by_class.setdefault(class_id, {})[status] = count
            all_counts[status] = all_counts.get(status, 0) + count

        rows = []
        for cls in sorted(classes, key=lambda c: c.name or ""):
            sponsor = cls.class_teacher
            counts = _counts_from(by_class.get(cls.id, {}), enrolled.get(cls.id, 0), scanned.get(cls.id, 0))
            rows.append(ClassOverview(
                class_id=cls.id, class_name=cls.name,
                sponsor_name=f"{sponsor.first_name} {sponsor.last_name}".strip() if sponsor else None,
                **counts.model_dump()
            ))
        totals = _counts_from(all_counts, sum(enrolled.values()), sum(scanned.values()))
        return DailyOverview(day=info, totals=totals, classes=rows, pending_excuses=pending)

    def class_report(
        self, class_id: UUID, start: Optional[date], end: Optional[date], user: Any
    ) -> ClassAttendanceReport:
        """Per-student totals for a class over a date range (sponsor, admin, or whole-school readers)."""
        cls = self._get_class(class_id)
        check_class_viewing_permission(self.db, cls, user)

        if start and end and start > end:
            raise BusinessRuleViolationError("start_date must be on or before end_date")

        today = self.school_today()
        ay = cls.academic_year
        if start and start > today:
            raise BusinessRuleViolationError("The report can't start in the future")
        # Clamp the requested range to what has happened and to the class's academic year
        end = min(end or today, today, ay.end_date if ay else today)
        start = max(start or (ay.start_date if ay else end - timedelta(days=30)), ay.start_date if ay else date.min)
        if start > end:
            raise BusinessRuleViolationError(
                f"No school days in that range: {cls.name}'s academic year runs "
                f"{ay.start_date:%d %b %Y} – {ay.end_date:%d %b %Y}"
                if ay else "No school days in that range"
            )
        if (end - start).days > MAX_REPORT_DAYS:
            raise BusinessRuleViolationError("Reports can cover at most one year")

        ids = [UUID(s) for s in enrolled_student_ids(self.db, self.tenant_id, cls)]
        students = self.db.query(Student).filter(Student.id.in_(ids)).order_by(
            Student.last_name, Student.first_name
        ).all() if ids else []

        per_student: Dict[UUID, Dict[AttendanceStatus, int]] = {}
        if ids:
            for student_id, status, count in self.db.query(
                DailyAttendance.student_id, DailyAttendance.status, func.count(DailyAttendance.id)
            ).filter(
                DailyAttendance.tenant_id == self.tenant_id,
                DailyAttendance.student_id.in_(ids),
                DailyAttendance.date >= start,
                DailyAttendance.date <= end
            ).group_by(DailyAttendance.student_id, DailyAttendance.status).all():
                per_student.setdefault(student_id, {})[status] = count

        school_days = self._count_school_days(start, end)
        rows, all_counts = [], {}
        for s in students:
            counts = per_student.get(s.id, {})
            for status, count in counts.items():
                all_counts[status] = all_counts.get(status, 0) + count
            c = _counts_from(counts, enrolled=school_days)  # unmarked = school days without a record
            rows.append(StudentReportRow(
                student_id=s.id, student_name=f"{s.first_name} {s.last_name}".strip(),
                admission_number=s.admission_number, present=c.present, late=c.late, absent=c.absent,
                excused=c.excused, sick=c.sick, unmarked=c.unmarked, attendance_rate=c.attendance_rate
            ))
        totals = _counts_from(all_counts, enrolled=school_days * len(students))
        return ClassAttendanceReport(
            class_id=cls.id, class_name=cls.name, start_date=start, end_date=end,
            school_days=school_days, rows=rows, totals=totals
        )
