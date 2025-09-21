from typing import List, Optional, Dict, Any
from uuid import UUID
from datetime import date, datetime, timedelta
from fastapi import Depends, HTTPException
from sqlalchemy.orm import Session

from src.db.crud.academics.attendance_crud import attendance_crud
from src.db.models.academics.attendance import Attendance, AttendanceStatus
from src.schemas.academics.attendance import (
    AttendanceCreate, AttendanceUpdate, AttendanceWithDetails,
    AttendanceSummary, BulkAttendanceCreate, AttendanceReport
)
from src.services.base.base import TenantBaseService, SuperAdminBaseService
from src.core.exceptions.business import EntityNotFoundError, DuplicateEntityError
from src.db.session import get_db, get_super_admin_db
from src.core.middleware.tenant import get_tenant_from_request


class AttendanceService(TenantBaseService[Attendance, AttendanceCreate, AttendanceUpdate]):
    """Service for managing attendance within a tenant."""
    
    def __init__(
        self,
        tenant_id: Any = Depends(get_tenant_from_request),
        db: Session = Depends(get_db)
    ):
        super().__init__(crud=attendance_crud, model=Attendance, tenant_id=tenant_id, db=db)
    
    # Core CRUD Operations
    def get_by_student_and_date(
        self, 
        student_id: UUID, 
        attendance_date: date
    ) -> Optional[Attendance]:
        """Get attendance record for a student on a specific date."""
        return attendance_crud.get_by_student_and_date(
            self.db, self.tenant_id, student_id, attendance_date
        )
    
    def get_by_class_and_date(
        self, 
        class_id: UUID, 
        attendance_date: date
    ) -> List[Attendance]:
        """Get all attendance records for a class on a specific date."""
        return attendance_crud.get_by_class_and_date(
            self.db, self.tenant_id, class_id, attendance_date
        )
    
    def get_by_schedule_and_date(
        self, 
        schedule_id: UUID, 
        attendance_date: date
    ) -> List[Attendance]:
        """Get all attendance records for a schedule on a specific date."""
        return attendance_crud.get_by_schedule_and_date(
            self.db, self.tenant_id, schedule_id, attendance_date
        )
    
    # Daily Attendance Management
    def mark_daily_attendance(
        self, 
        student_id: UUID,
        class_id: UUID,
        schedule_id: UUID,
        academic_year_id: UUID,
        status: AttendanceStatus,
        marked_by: UUID,
        attendance_date: Optional[date] = None,
        check_in_time: Optional[datetime] = None,
        check_out_time: Optional[datetime] = None,
        comments: Optional[str] = None
    ) -> Attendance:
        """Mark attendance for a student on a specific date."""
        if attendance_date is None:
            attendance_date = date.today()
        
        # Check if attendance already exists
        existing = self.get_by_student_and_date(student_id, attendance_date)
        if existing:
            # Update existing attendance
            return self.update_attendance_status(
                existing.id, status, marked_by, check_in_time, check_out_time, comments
            )
        
        # Create new attendance record
        attendance_data = AttendanceCreate(
            student_id=student_id,
            class_id=class_id,
            schedule_id=schedule_id,
            academic_year_id=academic_year_id,
            date=attendance_date,
            status=status,
            check_in_time=check_in_time,
            check_out_time=check_out_time,
            marked_by=marked_by,
            marked_at=datetime.utcnow(),
            comments=comments
        )
        
        return self.create(obj_in=attendance_data)
    
    def bulk_mark_attendance(
        self, 
        attendance_records: List[BulkAttendanceCreate]
    ) -> List[Attendance]:
        """Bulk mark attendance for multiple students."""
        # Convert to AttendanceCreate objects
        create_records = []
        for record in attendance_records:
            create_data = AttendanceCreate(
                student_id=record.student_id,
                class_id=record.class_id,
                schedule_id=record.schedule_id,
                academic_year_id=record.academic_year_id,
                date=record.date,
                status=record.status,
                check_in_time=record.check_in_time,
                check_out_time=record.check_out_time,
                marked_by=record.marked_by,
                marked_at=datetime.utcnow(),
                comments=record.comments
            )
            create_records.append(create_data)
        
        return attendance_crud.bulk_create_attendance(
            self.db, self.tenant_id, create_records
        )
    
    def update_attendance_status(
        self, 
        attendance_id: UUID, 
        status: AttendanceStatus,
        marked_by: UUID,
        check_in_time: Optional[datetime] = None,
        check_out_time: Optional[datetime] = None,
        comments: Optional[str] = None
    ) -> Optional[Attendance]:
        """Update attendance status and related fields."""
        return attendance_crud.update_attendance_status(
            self.db, self.tenant_id, attendance_id, status, marked_by,
            check_in_time, check_out_time, comments
        )
    
    # Reporting and Analytics
    def get_student_attendance_range(
        self, 
        student_id: UUID, 
        start_date: date, 
        end_date: date
    ) -> List[Attendance]:
        """Get student attendance records within a date range."""
        return attendance_crud.get_student_attendance_range(
            self.db, self.tenant_id, student_id, start_date, end_date
        )
    
    def get_class_attendance_range(
        self, 
        class_id: UUID, 
        start_date: date, 
        end_date: date
    ) -> List[Attendance]:
        """Get class attendance records within a date range."""
        return attendance_crud.get_class_attendance_range(
            self.db, self.tenant_id, class_id, start_date, end_date
        )
    
    def get_attendance_summary(
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
    
    def generate_attendance_report(
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
            records = self.get_student_attendance_range(student_id, start_date, end_date)
        elif class_id:
            records = self.get_class_attendance_range(class_id, start_date, end_date)
        else:
            # Get all records for the tenant within date range
            records = attendance_crud.list(
                self.db, 
                tenant_id=self.tenant_id,
                filters={'date__gte': start_date, 'date__lte': end_date}
            )
        
        # Get summary statistics
        summary = self.get_attendance_summary(student_id, class_id, start_date, end_date)
        
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
    
    def get_absent_students(
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
    
    def get_late_students(
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
    def get_student_attendance_percentage(
        self, 
        student_id: UUID, 
        start_date: Optional[date] = None,
        end_date: Optional[date] = None
    ) -> float:
        """Calculate student's attendance percentage for a period."""
        summary = self.get_attendance_summary(
            student_id=student_id, 
            start_date=start_date, 
            end_date=end_date
        )
        return summary.attendance_rate
    
    def get_class_attendance_trends(
        self, 
        class_id: UUID, 
        days: int = 30
    ) -> Dict[str, Any]:
        """Get attendance trends for a class over specified days."""
        end_date = date.today()
        start_date = end_date - timedelta(days=days)
        
        records = self.get_class_attendance_range(class_id, start_date, end_date)
        
        # Group by date and calculate daily attendance rates
        daily_stats = {}
        for record in records:
            record_date = record.date.isoformat()
            if record_date not in daily_stats:
                daily_stats[record_date] = {'total': 0, 'present': 0, 'late': 0}
            
            daily_stats[record_date]['total'] += 1
            if record.status in [AttendanceStatus.PRESENT, AttendanceStatus.LATE]:
                daily_stats[record_date]['present'] += 1
            if record.status == AttendanceStatus.LATE:
                daily_stats[record_date]['late'] += 1
        
        # Calculate daily rates
        trends = []
        for date_str, stats in daily_stats.items():
            attendance_rate = (stats['present'] / stats['total'] * 100) if stats['total'] > 0 else 0
            trends.append({
                'date': date_str,
                'total_students': stats['total'],
                'present_students': stats['present'],
                'late_students': stats['late'],
                'attendance_rate': attendance_rate
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
        
        total_records = sum(count for _, count in status_counts)
        present_count = sum(count for status, count in status_counts 
                          if status in [AttendanceStatus.PRESENT, AttendanceStatus.LATE])
        
        return {
            'total_records': total_records,
            'status_breakdown': {status.value: count for status, count in status_counts},
            'global_attendance_rate': (present_count / total_records * 100) if total_records > 0 else 0,
            'period_start': start_date.isoformat() if start_date else None,
            'period_end': end_date.isoformat() if end_date else None
        }