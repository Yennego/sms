from typing import List, Optional, Dict, Any, Iterable
from uuid import UUID
from datetime import date, datetime, timedelta
from fastapi import Depends, HTTPException
from sqlalchemy.orm import Session

from src.db.crud.academics.attendance_crud import attendance_crud
from src.db.models.academics.attendance import (
    Attendance, AttendanceStatus, PRESENT_STATUSES, calculate_attendance_rate
)
from src.schemas.academics.attendance import (
    AttendanceCreate, AttendanceUpdate, AttendanceWithDetails,
    AttendanceSummary, BulkAttendanceCreate, AttendanceReport
)
from src.services.base.base import TenantBaseService, SuperAdminBaseService
from src.core.exceptions.business import (
    EntityNotFoundError, DuplicateEntityError, BusinessRuleViolationError, PermissionDeniedError
)
from src.db.session import get_db, get_super_admin_db
from src.core.middleware.tenant import get_tenant_from_request
from src.db.crud.people import student as student_crud
from src.db.crud.academics.class_crud import class_crud
from src.db.crud.academics.schedule_crud import schedule_crud
from src.db.crud.academics.academic_year_crud import academic_year_crud
from src.db.crud.academics.grade import grade as grade_crud
from src.db.models.academics.grade import Grade, GradeType
from src.services.academics.attendance_access import (
    check_class_marking_permission, check_enrollment, resolve_viewable_student_id
)


def _coerce_status(value: Any) -> AttendanceStatus:
    """Accept enum members, values ('present') or names ('PRESENT')."""
    if isinstance(value, AttendanceStatus):
        return value
    try:
        return AttendanceStatus(str(value).lower())
    except ValueError:
        raise BusinessRuleViolationError(f"Invalid attendance status: {value}")


class AttendanceService(TenantBaseService[Attendance, AttendanceCreate, AttendanceUpdate]):
    """Service for managing attendance within a tenant."""
    
    def __init__(
        self,
        tenant: Any = Depends(get_tenant_from_request),
        db: Session = Depends(get_db)
    ):
        tenant_id = tenant.id if hasattr(tenant, 'id') else tenant
        super().__init__(crud=attendance_crud, model=Attendance, tenant_id=tenant_id, db=db)
    
    # Core CRUD Operations
    async def get_by_student_and_date(
        self, 
        student_id: UUID, 
        attendance_date: date,
        class_id: Optional[UUID] = None
    ) -> Optional[Attendance]:
        """Get attendance record for a student on a specific date and class."""
        return attendance_crud.get_by_student_and_date(
            self.db, self.tenant_id, student_id, attendance_date, class_id
        )
    
    async def get_by_class_and_date(
        self, 
        class_id: UUID, 
        attendance_date: date
    ) -> List[Attendance]:
        """Get all attendance records for a class on a specific date."""
        return attendance_crud.get_by_class_and_date(
            self.db, self.tenant_id, class_id, attendance_date
        )
    
    async def get_by_schedule_and_date(
        self, 
        schedule_id: UUID, 
        attendance_date: date
    ) -> List[Attendance]:
        """Get all attendance records for a schedule on a specific date."""
        return attendance_crud.get_by_schedule_and_date(
            self.db, self.tenant_id, schedule_id, attendance_date
        )
    
    # Validation helpers shared by single and bulk marking
    def _validate_marking_context(
        self,
        class_id: UUID,
        academic_year_id: UUID,
        marked_by: UUID,
        schedule_id: Optional[UUID],
        period: Optional[str]
    ) -> Any:
        """Validate class, schedule/period, academic year and marking permission. Returns the class."""
        if not class_id:
            raise BusinessRuleViolationError("class_id is required to mark attendance")
        cls = class_crud.get_by_id(self.db, tenant_id=self.tenant_id, id=class_id)
        if not cls:
            raise EntityNotFoundError("Class", class_id)
        if schedule_id:
            sch = schedule_crud.get_by_id(self.db, tenant_id=self.tenant_id, id=schedule_id)
            if not sch:
                raise EntityNotFoundError("Schedule", schedule_id)
        elif not period:
            raise BusinessRuleViolationError("Either schedule_id or period (ad-hoc name) must be provided")
        ay = academic_year_crud.get_by_id(self.db, tenant_id=self.tenant_id, id=academic_year_id)
        if not ay:
            raise EntityNotFoundError("AcademicYear", academic_year_id)
        self._check_marking_permission(cls, marked_by)
        return cls

    def _check_marking_permission(self, cls: Any, marked_by: UUID) -> None:
        check_class_marking_permission(self.db, cls, marked_by)

    def _check_enrollment(self, cls: Any, student_ids: Iterable[UUID]) -> None:
        check_enrollment(self.db, self.tenant_id, cls, student_ids)

    def _upsert_record(
        self,
        *,
        student_id: UUID,
        class_id: UUID,
        academic_year_id: UUID,
        attendance_date: date,
        status: AttendanceStatus,
        marked_by: UUID,
        schedule_id: Optional[UUID] = None,
        period: Optional[str] = None,
        check_in_time: Optional[datetime] = None,
        check_out_time: Optional[datetime] = None,
        comments: Optional[str] = None
    ) -> Attendance:
        """Insert or update one record in the session. The caller commits."""
        record = attendance_crud.get_for_period(
            self.db, self.tenant_id, student_id, class_id, attendance_date, schedule_id, period
        )
        if record is None:
            record = Attendance(
                tenant_id=self.tenant_id,
                student_id=student_id,
                class_id=class_id,
                academic_year_id=academic_year_id,
                date=attendance_date,
                schedule_id=schedule_id,
                period=period
            )
            self.db.add(record)
        record.status = status
        record.marked_by = marked_by
        record.marked_at = datetime.utcnow()
        if check_in_time is not None:
            record.check_in_time = check_in_time
        if check_out_time is not None:
            record.check_out_time = check_out_time
        if comments is not None:
            record.notes = comments
        return record

    # Daily Attendance Management
    async def mark_daily_attendance(
        self,
        student_id: UUID,
        class_id: UUID,
        academic_year_id: UUID,
        status: AttendanceStatus,
        marked_by: UUID,
        schedule_id: Optional[UUID] = None,
        attendance_date: Optional[date] = None,
        check_in_time: Optional[datetime] = None,
        check_out_time: Optional[datetime] = None,
        comments: Optional[str] = None,
        period: Optional[str] = None
    ) -> Attendance:
        if attendance_date is None:
            attendance_date = date.today()
        student = student_crud.get_by_id(self.db, tenant_id=self.tenant_id, id=student_id)
        if not student:
            raise EntityNotFoundError("Student", student_id)
        cls = self._validate_marking_context(class_id, academic_year_id, marked_by, schedule_id, period)
        self._check_enrollment(cls, [student_id])

        try:
            record = self._upsert_record(
                student_id=student_id,
                class_id=class_id,
                academic_year_id=academic_year_id,
                attendance_date=attendance_date,
                status=_coerce_status(status),
                marked_by=marked_by,
                schedule_id=schedule_id,
                period=period,
                check_in_time=check_in_time,
                check_out_time=check_out_time,
                comments=comments
            )
            self.db.commit()
        except Exception:
            self.db.rollback()
            raise
        self.db.refresh(record)
        return record

    async def bulk_mark_attendance(
        self,
        attendance_in: BulkAttendanceCreate
    ) -> List[Attendance]:
        """Bulk mark attendance with upsert logic, all-or-nothing in one transaction."""
        attendance_date = attendance_in.date or date.today()
        cls = self._validate_marking_context(
            attendance_in.class_id,
            attendance_in.academic_year_id,
            attendance_in.marked_by,
            attendance_in.schedule_id,
            attendance_in.period
        )

        entries = []
        for record in attendance_in.attendances:
            try:
                student_id = UUID(str(record['student_id']))
            except (KeyError, ValueError):
                raise BusinessRuleViolationError(f"Invalid student_id in attendance entry: {record}")
            if 'status' not in record:
                raise BusinessRuleViolationError(f"Missing status for student {student_id}")
            entries.append((student_id, _coerce_status(record['status']), record.get('notes')))
        self._check_enrollment(cls, [sid for sid, _, _ in entries])

        try:
            results = [
                self._upsert_record(
                    student_id=student_id,
                    class_id=attendance_in.class_id,
                    academic_year_id=attendance_in.academic_year_id,
                    attendance_date=attendance_date,
                    status=status,
                    marked_by=attendance_in.marked_by,
                    schedule_id=attendance_in.schedule_id,
                    period=attendance_in.period,
                    comments=notes
                )
                for student_id, status, notes in entries
            ]
            self.db.commit()
        except Exception:
            self.db.rollback()
            raise
        for record in results:
            self.db.refresh(record)

        # Attendance grades are produced per subject by sync_assessment_attendance when an
        # ATTENDANCE assessment is created; a Grade can't exist without subject/enrollment.
        return results
    
    def resolve_viewable_student_id(self, current_user: Any, student_id: Optional[UUID]) -> Optional[UUID]:
        """Staff may read anyone; a student only themselves; a parent only their linked children."""
        return resolve_viewable_student_id(self.db, current_user, student_id)

    def ensure_can_modify(self, attendance: Attendance, user_id: UUID) -> None:
        """Only the sponsor of the record's class or an administrator may change it."""
        cls = class_crud.get_by_id(self.db, tenant_id=self.tenant_id, id=attendance.class_id)
        if not cls:
            raise EntityNotFoundError("Class", attendance.class_id)
        self._check_marking_permission(cls, user_id)

    async def update_attendance_status(
        self,
        attendance_id: UUID,
        status: AttendanceStatus,
        marked_by: UUID,
        check_in_time: Optional[datetime] = None,
        check_out_time: Optional[datetime] = None,
        comments: Optional[str] = None
    ) -> Optional[Attendance]:
        """Update attendance status and related fields."""
        attendance = attendance_crud.get_by_id(self.db, self.tenant_id, attendance_id)
        if not attendance:
            return None
        self.ensure_can_modify(attendance, marked_by)
        return attendance_crud.update_attendance_status(
            self.db, self.tenant_id, attendance_id, status, marked_by,
            check_in_time, check_out_time, comments
        )
    
    # Reporting and Analytics
    async def get_student_attendance_range(
        self, 
        student_id: UUID, 
        start_date: date, 
        end_date: date
    ) -> List[Attendance]:
        """Get student attendance records within a date range."""
        return attendance_crud.get_student_attendance_range(
            self.db, self.tenant_id, student_id, start_date, end_date
        )
    
    async def get_class_attendance_range(
        self, 
        class_id: UUID, 
        start_date: date, 
        end_date: date
    ) -> List[Attendance]:
        """Get class attendance records within a date range."""
        return attendance_crud.get_class_attendance_range(
            self.db, self.tenant_id, class_id, start_date, end_date
        )
    
    async def get_attendance_summary(
        self, 
        student_id: Optional[UUID] = None,
        class_id: Optional[UUID] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None
    ) -> AttendanceSummary:
        """Get attendance summary statistics."""
        summary_data = attendance_crud.get_attendance_summary(
            self.db, self.tenant_id, student_id, class_id, start_date, end_date
        )
        
        # Use the current date if no specific date range is provided
        summary_date = start_date or date.today()
        
        return AttendanceSummary(
            date=summary_date,
            total_students=summary_data['total_records'],
            present_count=summary_data['status_breakdown'].get('present', 0),
            absent_count=summary_data['status_breakdown'].get('absent', 0),
            late_count=summary_data['status_breakdown'].get('late', 0),
            excused_count=summary_data['status_breakdown'].get('excused', 0),
            attendance_percentage=summary_data['attendance_rate']
        )

    def get_multi(
        self,
        *,
        skip: int = 0,
        limit: int = 100,
        student_id: Optional[UUID] = None,
        class_id: Optional[UUID] = None,
        schedule_id: Optional[UUID] = None,
        academic_year_id: Optional[UUID] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        status_filter: Optional[Any] = None,
    ) -> List[Attendance]:
        # The CRUD treats tenant_id=None as "all tenants"; never allow that here
        if self.tenant_id is None:
            raise BusinessRuleViolationError("Tenant context is required")

        # Normalize status_filter if passed as schema enum or string
        if status_filter is not None:
            try:
                normalized = getattr(status_filter, "value", status_filter)
                status_filter = AttendanceStatus(normalized)
            except Exception:
                status_filter = None

        return attendance_crud.get_multi(
            self.db,
            self.tenant_id,
            skip=skip,
            limit=limit,
            student_id=student_id,
            class_id=class_id,
            schedule_id=schedule_id,
            academic_year_id=academic_year_id,
            start_date=start_date,
            end_date=end_date,
            status_filter=status_filter,
        )


    async def generate_attendance_report(
        self, 
        class_id: Optional[UUID] = None,
        student_id: Optional[UUID] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        report_type: str = "summary"
    ) -> AttendanceReport:
        """Generate comprehensive attendance report."""
        if start_date is None:
            start_date = date.today() - timedelta(days=30)  # Default to last 30 days
        if end_date is None:
            end_date = date.today()
        
        # Get attendance records
        if student_id:
            records = await self.get_student_attendance_range(student_id, start_date, end_date)
        elif class_id:
            records = await self.get_class_attendance_range(class_id, start_date, end_date)
        else:
            # Get all records for the tenant within date range
            records = attendance_crud.list(
                self.db, 
                tenant_id=self.tenant_id,
                filters={'date__gte': start_date, 'date__lte': end_date}
            )
        
        # Get summary statistics
        summary = await self.get_attendance_summary(student_id, class_id, start_date, end_date)
        
        return AttendanceReport(
            report_type=report_type,
            period_start=start_date,
            period_end=end_date,
            class_id=class_id,
            student_id=student_id,
            summary=summary,
            records=records,
            generated_at=datetime.utcnow()
        )
    
    async def get_absent_students(
        self, 
        class_id: Optional[UUID] = None,
        attendance_date: Optional[date] = None
    ) -> List[Attendance]:
        """Get list of absent students for a specific date and class."""
        if attendance_date is None:
            attendance_date = date.today()
        
        return attendance_crud.get_attendance_by_status(
            self.db, self.tenant_id, AttendanceStatus.ABSENT, attendance_date, class_id
        )
    
    async def get_late_students(
        self, 
        class_id: Optional[UUID] = None,
        attendance_date: Optional[date] = None
    ) -> List[Attendance]:
        """Get list of late students for a specific date and class."""
        if attendance_date is None:
            attendance_date = date.today()
        
        return attendance_crud.get_attendance_by_status(
            self.db, self.tenant_id, AttendanceStatus.LATE, attendance_date, class_id
        )
    
    # Integration Features
    async def get_student_attendance_percentage(
        self, 
        student_id: UUID, 
        start_date: Optional[date] = None,
        end_date: Optional[date] = None
    ) -> float:
        """Student's attendance rate (%) from school-day records (present / (days - excused)).

        Used by grade calculation, promotion and the ATTENDANCE assessment sync, so
        all of them follow daily attendance (QR scans, sponsor marks, auto-absent).
        """
        counts: Dict[AttendanceStatus, int] = {}
        for record in await self.get_student_daily_range(student_id, start_date, end_date):
            counts[record.status] = counts.get(record.status, 0) + 1
        return calculate_attendance_rate(counts)

    async def get_student_daily_range(
        self,
        student_id: UUID,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None
    ) -> List[Any]:
        """School-day records (DailyAttendance) for a student, oldest first."""
        from src.db.models.academics.daily_attendance import DailyAttendance

        query = self.db.query(DailyAttendance).filter(
            DailyAttendance.tenant_id == self.tenant_id,
            DailyAttendance.student_id == student_id
        )
        if start_date:
            query = query.filter(DailyAttendance.date >= start_date)
        if end_date:
            query = query.filter(DailyAttendance.date <= end_date)
        return query.order_by(DailyAttendance.date.asc()).all()
    
    async def sync_assessment_attendance(
        self,
        assessment: Any,
        marked_by: UUID
    ) -> int:
        """Automatically populate grades for an ATTENDANCE assessment for all students in the target class/section."""
        from src.db.models.academics.enrollment import Enrollment
        from src.db.crud.academics.grade import grade as grade_crud
        from src.schemas.academics.grade import GradeCreate
        
        # 1. Get all students enrolled in the class/grade for this academic year
        query = self.db.query(Enrollment).filter(
            Enrollment.tenant_id == self.tenant_id,
            Enrollment.academic_year_id == assessment.academic_year_id,
            Enrollment.is_active == True
        )
        
        if assessment.section_id:
            query = query.filter(Enrollment.section_id == assessment.section_id)
        else:
            query = query.filter(Enrollment.grade_id == assessment.grade_id)
            
        enrollments = query.all()
        
        # Helper for letter grade
        def get_letter_grade(pct: float) -> str:
            if pct >= 90: return 'A'
            if pct >= 80: return 'B'
            if pct >= 70: return 'C'
            if pct >= 60: return 'D'
            return 'F'

        count = 0
        for enrollment in enrollments:
            # 2. Get attendance percentage for this student
            ay = academic_year_crud.get_by_id(self.db, self.tenant_id, assessment.academic_year_id)
            
            attendance_pct = await self.get_student_attendance_percentage(
                student_id=enrollment.student_id,
                start_date=ay.start_date if ay else None,
                end_date=assessment.assessment_date
            )
            
            # 3. Calculate score based on assessment max_score
            score = (attendance_pct / 100.0) * assessment.max_score
            
            # 4. Upsert Grade
            existing_grade = self.db.query(Grade).filter(
                Grade.tenant_id == self.tenant_id,
                Grade.student_id == enrollment.student_id,
                Grade.assessment_type == GradeType.ATTENDANCE,
                Grade.assessment_id == assessment.id
            ).first()
            
            if existing_grade:
                grade_crud.update(
                    self.db,
                    tenant_id=self.tenant_id,
                    db_obj=existing_grade,
                    obj_in={
                        "score": score,
                        "percentage": attendance_pct,
                        "letter_grade": get_letter_grade(attendance_pct),
                        "graded_date": date.today(),
                        "graded_by": marked_by
                    }
                )
            else:
                grade_data = GradeCreate(
                    student_id=enrollment.student_id,
                    enrollment_id=enrollment.id,
                    subject_id=assessment.subject_id,
                    graded_by=marked_by,
                    academic_year_id=assessment.academic_year_id,
                    assessment_type=GradeType.ATTENDANCE,
                    assessment_id=assessment.id,
                    assessment_name=assessment.title,
                    assessment_date=assessment.assessment_date,
                    score=score,
                    max_score=assessment.max_score,
                    percentage=attendance_pct,
                    letter_grade=get_letter_grade(attendance_pct),
                    grading_category_id=assessment.grading_category_id,
                    comments="Auto-generated from daily attendance records"
                )
                grade_crud.create(self.db, tenant_id=self.tenant_id, obj_in=grade_data)
            count += 1
            
        return count
    
    async def get_class_attendance_trends(
        self, 
        class_id: UUID, 
        days: int = 30
    ) -> Dict[str, Any]:
        """Get attendance trends for a class over specified days."""
        end_date = date.today()
        start_date = end_date - timedelta(days=days)
        
        records = await self.get_class_attendance_range(class_id, start_date, end_date)
        
        # Group status counts by date
        daily_counts: Dict[str, Dict[AttendanceStatus, int]] = {}
        for record in records:
            counts = daily_counts.setdefault(record.date.isoformat(), {})
            counts[record.status] = counts.get(record.status, 0) + 1

        # Calculate daily rates
        trends = []
        for date_str, counts in daily_counts.items():
            trends.append({
                'date': date_str,
                'total_students': sum(counts.values()),
                'present_students': sum(c for s, c in counts.items() if s in PRESENT_STATUSES),
                'late_students': counts.get(AttendanceStatus.LATE, 0),
                'attendance_rate': calculate_attendance_rate(counts)
            })
        
        return {
            'class_id': str(class_id),
            'period_days': days,
            'start_date': start_date.isoformat(),
            'end_date': end_date.isoformat(),
            'daily_trends': sorted(trends, key=lambda x: x['date'])
        }


class SuperAdminAttendanceService(SuperAdminBaseService[Attendance, AttendanceCreate, AttendanceUpdate]):
    """Super-admin service for managing attendance across all tenants."""
    
    def __init__(self, db: Session = Depends(get_super_admin_db)):
        super().__init__(crud=attendance_crud, model=Attendance, db=db)
    
    def get_global_attendance_stats(
        self, 
        start_date: Optional[date] = None,
        end_date: Optional[date] = None
    ) -> Dict[str, Any]:
        """Get global attendance statistics across all tenants."""
        query = self.db.query(Attendance)
        
        if start_date:
            query = query.filter(Attendance.date >= start_date)
        if end_date:
            query = query.filter(Attendance.date <= end_date)
        
        # Get status counts across all tenants
        from sqlalchemy import func
        status_counts = (
            query.with_entities(
                Attendance.status,
                func.count(Attendance.id).label('count')
            )
            .group_by(Attendance.status)
            .all()
        )
        
        status_breakdown = {status.value: count for status, count in status_counts}

        return {
            'total_records': sum(status_breakdown.values()),
            'status_breakdown': status_breakdown,
            'global_attendance_rate': calculate_attendance_rate(status_breakdown),
            'period_start': start_date.isoformat() if start_date else None,
            'period_end': end_date.isoformat() if end_date else None
        }
    
    def get_multi(
        self,
        *,
        skip: int = 0,
        limit: int = 100,
        tenant_id: Optional[UUID] = None,
        student_id: Optional[UUID] = None,
        class_id: Optional[UUID] = None,
        schedule_id: Optional[UUID] = None,
        academic_year_id: Optional[UUID] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        status_filter: Optional[Any] = None,
    ) -> List[Attendance]:
        # Normalize status_filter if passed as schema enum or string
        if status_filter is not None:
            try:
                normalized = getattr(status_filter, "value", status_filter)
                status_filter = AttendanceStatus(normalized)
            except Exception:
                status_filter = None

        return attendance_crud.get_multi(
            self.db,
            tenant_id,
            skip=skip,
            limit=limit,
            student_id=student_id,
            class_id=class_id,
            schedule_id=schedule_id,
            academic_year_id=academic_year_id,
            start_date=start_date,
            end_date=end_date,
            status_filter=status_filter,
        )