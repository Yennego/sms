from typing import Dict, Any, Optional
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import func
from uuid import UUID

from src.db.models.people import Student, Teacher
from src.db.models.academics import Class, Enrollment
from src.db.models.auth import User
from src.utils.uuid_utils import ensure_uuid

class TenantAdminDashboardService:
    """
    Service for providing tenant-specific admin dashboard statistics.
    """
    
    def __init__(self, db: Session, tenant_id: str):
        self.db = db
        # Properly validate and convert tenant_id to UUID
        self.tenant_id = ensure_uuid(tenant_id)
        if self.tenant_id is None:
            raise ValueError(f"Invalid tenant_id format: {tenant_id}")
    
    def get_dashboard_stats(self) -> Dict[str, Any]:
        """Get comprehensive dashboard statistics for the tenant admin."""
        return {
            "students": self._get_student_stats(),
            "teachers": self._get_teacher_stats(),
            "classes": self._get_class_stats(),
            "users": self._get_user_stats(),
            "recent_activities": self._get_recent_activities(),
            "pending_tasks": self._get_pending_tasks()
        }
    
    def _get_student_stats(self) -> Dict[str, Any]:
        """Get student statistics for the current tenant."""
        # Total students
        total_students = self.db.query(func.count(Student.id)).filter(
            Student.tenant_id == self.tenant_id
        ).scalar() or 0
        
        # Active students
        active_students = self.db.query(func.count(Student.id)).filter(
            Student.tenant_id == self.tenant_id,
            Student.status == 'active'
        ).scalar() or 0
        
        # New students this month
        start_of_month = datetime.now().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        new_students_this_month = self.db.query(func.count(Student.id)).filter(
            Student.tenant_id == self.tenant_id,
            Student.created_at >= start_of_month
        ).scalar() or 0
        
        # Calculate growth rate
        last_month_start = (start_of_month - timedelta(days=1)).replace(day=1)
        last_month_students = self.db.query(func.count(Student.id)).filter(
            Student.tenant_id == self.tenant_id,
            Student.created_at >= last_month_start,
            Student.created_at < start_of_month
        ).scalar() or 0
        
        growth_rate = 0
        if last_month_students > 0:
            growth_rate = ((new_students_this_month - last_month_students) / last_month_students) * 100
        
        return {
            "total": total_students,
            "active": active_students,
            "inactive": total_students - active_students,
            "new_this_month": new_students_this_month,
            "growth_rate": round(growth_rate, 1)
        }
    
    def _get_teacher_stats(self) -> Dict[str, Any]:
        """Get teacher statistics for the current tenant."""
        # Total teachers
        total_teachers = self.db.query(func.count(Teacher.id)).filter(
            Teacher.tenant_id == self.tenant_id
        ).scalar() or 0
        
        # Active teachers
        active_teachers = self.db.query(func.count(Teacher.id)).filter(
            Teacher.tenant_id == self.tenant_id,
            Teacher.status == 'active'
        ).scalar() or 0
        
        # New teachers this month
        start_of_month = datetime.now().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        new_teachers_this_month = self.db.query(func.count(Teacher.id)).filter(
            Teacher.tenant_id == self.tenant_id,
            Teacher.created_at >= start_of_month
        ).scalar() or 0
        
        return {
            "total": total_teachers,
            "active": active_teachers,
            "inactive": total_teachers - active_teachers,
            "new_this_month": new_teachers_this_month
        }
    
    def _get_class_stats(self) -> Dict[str, Any]:
        """Get class statistics for the current tenant."""
        # Total classes
        total_classes = self.db.query(func.count(Class.id)).filter(
            Class.tenant_id == self.tenant_id
        ).scalar() or 0
        
        # Active classes
        active_classes = self.db.query(func.count(Class.id)).filter(
            Class.tenant_id == self.tenant_id,
            Class.is_active == True
        ).scalar() or 0
        
        return {
            "total": total_classes,
            "active": active_classes,
            "inactive": total_classes - active_classes
        }
    
    def _get_user_stats(self) -> Dict[str, Any]:
        """Get user statistics for the current tenant."""
        # Total users
        total_users = self.db.query(func.count(User.id)).filter(
            User.tenant_id == self.tenant_id
        ).scalar() or 0
        
        # Active users
        active_users = self.db.query(func.count(User.id)).filter(
            User.tenant_id == self.tenant_id,
            User.is_active == True
        ).scalar() or 0
        
        # Recent logins (last 24 hours)
        yesterday = datetime.now() - timedelta(days=1)
        recent_logins = self.db.query(func.count(User.id)).filter(
            User.tenant_id == self.tenant_id,
            User.last_login >= yesterday
        ).scalar() or 0
        
        return {
            "total": total_users,
            "active": active_users,
            "recent_logins": recent_logins
        }
    
    def _get_recent_activities(self) -> list:
        """Get recent activities for the dashboard."""
        # This would integrate with the activity log service
        # For now, return empty list
        return []
    
    def _get_pending_tasks(self) -> Dict[str, int]:
        """Get pending administrative tasks."""
        # Count pending teacher approvals (teachers with status 'pending')
        pending_teachers = self.db.query(func.count(Teacher.id)).filter(
            Teacher.tenant_id == self.tenant_id,
            Teacher.status == 'pending'
        ).scalar() or 0
        
        # Count pending student registrations (students with status 'pending')
        pending_students = self.db.query(func.count(Student.id)).filter(
            Student.tenant_id == self.tenant_id,
            Student.status == 'pending'
        ).scalar() or 0
        
        return {
            "pending_teacher_approvals": pending_teachers,
            "pending_student_registrations": pending_students,
            "upcoming_events": 0  # Placeholder for future events feature
        }