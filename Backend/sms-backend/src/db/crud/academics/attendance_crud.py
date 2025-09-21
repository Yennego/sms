from typing import Any, Dict, List, Optional, Union
from uuid import UUID
from datetime import date, datetime
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func

from src.db.crud.base.base import TenantCRUDBase
from src.db.models.academics.attendance import Attendance, AttendanceStatus
from src.schemas.academics.attendance import AttendanceCreate, AttendanceUpdate


class CRUDAttendance(TenantCRUDBase[Attendance, AttendanceCreate, AttendanceUpdate]):
    """CRUD operations for Attendance model."""
    
    def get_by_student_and_date(
        self, 
        db: Session, 
        tenant_id: Any, 
        student_id: UUID, 
        attendance_date: date
    ) -> Optional[Attendance]:
        """Get attendance record for a student on a specific date."""
        return db.query(Attendance).filter(
            Attendance.tenant_id == tenant_id,
            Attendance.student_id == student_id,
            Attendance.date == attendance_date
        ).first()
    
    def get_by_class_and_date(
        self, 
        db: Session, 
        tenant_id: Any, 
        class_id: UUID, 
        attendance_date: date
    ) -> List[Attendance]:
        """Get all attendance records for a class on a specific date."""
        return db.query(Attendance).filter(
            Attendance.tenant_id == tenant_id,
            Attendance.class_id == class_id,
            Attendance.date == attendance_date
        ).all()
    
    def get_by_schedule_and_date(
        self, 
        db: Session, 
        tenant_id: Any, 
        schedule_id: UUID, 
        attendance_date: date
    ) -> List[Attendance]:
        """Get all attendance records for a schedule on a specific date."""
        return db.query(Attendance).filter(
            Attendance.tenant_id == tenant_id,
            Attendance.schedule_id == schedule_id,
            Attendance.date == attendance_date
        ).all()
    
    def get_student_attendance_range(
        self, 
        db: Session, 
        tenant_id: Any, 
        student_id: UUID, 
        start_date: date, 
        end_date: date
    ) -> List[Attendance]:
        """Get student attendance records within a date range."""
        return db.query(Attendance).filter(
            Attendance.tenant_id == tenant_id,
            Attendance.student_id == student_id,
            Attendance.date >= start_date,
            Attendance.date <= end_date
        ).order_by(Attendance.date.asc()).all()
    
    def get_class_attendance_range(
        self, 
        db: Session, 
        tenant_id: Any, 
        class_id: UUID, 
        start_date: date, 
        end_date: date
    ) -> List[Attendance]:
        """Get class attendance records within a date range."""
        return db.query(Attendance).filter(
            Attendance.tenant_id == tenant_id,
            Attendance.class_id == class_id,
            Attendance.date >= start_date,
            Attendance.date <= end_date
        ).order_by(Attendance.date.asc(), Attendance.student_id.asc()).all()
    
    def get_attendance_by_status(
        self, 
        db: Session, 
        tenant_id: Any, 
        status: AttendanceStatus, 
        attendance_date: Optional[date] = None,
        class_id: Optional[UUID] = None
    ) -> List[Attendance]:
        """Get attendance records by status with optional filters."""
        query = db.query(Attendance).filter(
            Attendance.tenant_id == tenant_id,
            Attendance.status == status
        )
        
        if attendance_date:
            query = query.filter(Attendance.date == attendance_date)
        
        if class_id:
            query = query.filter(Attendance.class_id == class_id)
        
        return query.all()
    
    def get_attendance_summary(
        self, 
        db: Session, 
        tenant_id: Any, 
        student_id: Optional[UUID] = None,
        class_id: Optional[UUID] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None
    ) -> Dict[str, Any]:
        """Get attendance summary statistics."""
        query = db.query(Attendance).filter(Attendance.tenant_id == tenant_id)
        
        # Apply filters
        if student_id:
            query = query.filter(Attendance.student_id == student_id)
        if class_id:
            query = query.filter(Attendance.class_id == class_id)
        if start_date:
            query = query.filter(Attendance.date >= start_date)
        if end_date:
            query = query.filter(Attendance.date <= end_date)
        
        # Get status counts
        status_counts = (
            query.with_entities(
                Attendance.status,
                func.count(Attendance.id).label('count')
            )
            .group_by(Attendance.status)
            .all()
        )
        
        total_records = sum(count for _, count in status_counts)
        
        summary = {
            'total_records': total_records,
            'status_breakdown': {status.value: count for status, count in status_counts},
            'attendance_rate': 0.0
        }
        
        # Calculate attendance rate (present + late / total)
        present_count = summary['status_breakdown'].get('present', 0)
        late_count = summary['status_breakdown'].get('late', 0)
        
        if total_records > 0:
            summary['attendance_rate'] = ((present_count + late_count) / total_records) * 100
        
        return summary
    
    def bulk_create_attendance(
        self, 
        db: Session, 
        tenant_id: Any, 
        attendance_records: List[AttendanceCreate]
    ) -> List[Attendance]:
        """Bulk create attendance records."""
        tenant_id = self._ensure_uuid(tenant_id)
        
        # Validate tenant exists
        from src.db.models.tenant import Tenant
        tenant = db.query(Tenant).filter(Tenant.id == tenant_id, Tenant.is_active == True).first()
        if not tenant:
            raise ValueError(f"Tenant {tenant_id} not found or inactive")
        
        db_objects = []
        for record in attendance_records:
            obj_data = record.model_dump()
            obj_data["tenant_id"] = tenant_id
            db_obj = Attendance(**obj_data)
            db_objects.append(db_obj)
        
        db.add_all(db_objects)
        db.commit()
        
        # Refresh all objects
        for obj in db_objects:
            db.refresh(obj)
        
        return db_objects
    
    def update_attendance_status(
        self, 
        db: Session, 
        tenant_id: Any, 
        attendance_id: UUID, 
        status: AttendanceStatus,
        marked_by: UUID,
        check_in_time: Optional[datetime] = None,
        check_out_time: Optional[datetime] = None,
        comments: Optional[str] = None
    ) -> Optional[Attendance]:
        """Update attendance status and related fields."""
        attendance = self.get_by_id(db, tenant_id, attendance_id)
        if not attendance:
            return None
        
        update_data = {
            'status': status,
            'marked_by': marked_by,
            'marked_at': datetime.utcnow()
        }
        
        if check_in_time is not None:
            update_data['check_in_time'] = check_in_time
        if check_out_time is not None:
            update_data['check_out_time'] = check_out_time
        if comments is not None:
            update_data['comments'] = comments
        
        return self.update(db, tenant_id, db_obj=attendance, obj_in=update_data)


attendance_crud = CRUDAttendance(Attendance)