from typing import List, Optional, Dict, Any
from uuid import UUID
from datetime import datetime, timedelta
from fastapi import Request, Depends
from sqlalchemy.orm import Session

from src.db.crud.logging.activity_log import activity_log_crud
from src.db.models.logging.activity_log import ActivityLog
from src.schemas.logging.activity_log import ActivityLogCreate, ActivityLogUpdate
from src.services.base.base import TenantBaseService, SuperAdminBaseService
from src.db.session import get_super_admin_db


class AuditLoggingService(TenantBaseService[ActivityLog, ActivityLogCreate, ActivityLogUpdate]):
    """Service for managing audit and activity logs within a tenant."""
    
    def __init__(self, *args, **kwargs):
        super().__init__(crud=activity_log_crud, model=ActivityLog, *args, **kwargs)
    
    def log_activity(self, user_id: Optional[UUID], action: str, entity_type: str,
                   entity_id: Optional[UUID] = None, old_values: Optional[Dict[str, Any]] = None,
                   new_values: Optional[Dict[str, Any]] = None, request: Optional[Request] = None) -> ActivityLog:
        """Log a user activity or system event."""
        # Extract IP address and user agent from request if provided
        ip_address = None
        user_agent = None
        if request:
            ip_address = request.client.host if hasattr(request.client, 'host') else None
            user_agent = request.headers.get("user-agent")
        
        # Create activity log
        activity_log_in = ActivityLogCreate(
            user_id=user_id,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            old_values=old_values,
            new_values=new_values,
            ip_address=ip_address,
            user_agent=user_agent
        )
        
        return self.create(obj_in=activity_log_in)
    
    def get_by_user(self, user_id: UUID) -> List[ActivityLog]:
        """Get all activity logs for a specific user."""
        return activity_log_crud.get_by_user(
            self.db, tenant_id=self.tenant_id, user_id=user_id
        )
    
    def get_by_entity(self, entity_type: str, entity_id: UUID) -> List[ActivityLog]:
        """Get all activity logs for a specific entity."""
        return activity_log_crud.get_by_entity(
            self.db, tenant_id=self.tenant_id, entity_type=entity_type, entity_id=entity_id
        )
    
    def get_by_action(self, action: str) -> List[ActivityLog]:
        """Get all activity logs for a specific action."""
        return activity_log_crud.get_by_action(
            self.db, tenant_id=self.tenant_id, action=action
        )
    
    def get_by_date_range(self, start_date: datetime, end_date: datetime) -> List[ActivityLog]:
        """Get all activity logs within a date range."""
        return activity_log_crud.get_by_date_range(
            self.db, tenant_id=self.tenant_id, start_date=start_date, end_date=end_date
        )
    
    def get_recent_activities(self, days: int = 7) -> List[ActivityLog]:
        """Get all activity logs from the last X days."""
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=days)
        return self.get_by_date_range(start_date, end_date)


class SuperAdminAuditLoggingService(SuperAdminBaseService[ActivityLog, ActivityLogCreate, ActivityLogUpdate]):
    """Super-admin service for managing audit and activity logs across all tenants."""
    
    def __init__(self, *args, **kwargs):
        super().__init__(crud=activity_log_crud, model=ActivityLog, *args, **kwargs)
    
    def get_all_activity_logs(self, skip: int = 0, limit: int = 100,
                            user_id: Optional[UUID] = None,
                            action: Optional[str] = None,
                            entity_type: Optional[str] = None,
                            entity_id: Optional[UUID] = None,
                            start_date: Optional[datetime] = None,
                            end_date: Optional[datetime] = None,
                            tenant_id: Optional[UUID] = None) -> List[ActivityLog]:
        """Get all activity logs across all tenants with filtering."""
        query = self.db.query(ActivityLog)
        
        # Apply filters
        if user_id:
            query = query.filter(ActivityLog.user_id == user_id)
        if action:
            query = query.filter(ActivityLog.action == action)
        if entity_type:
            query = query.filter(ActivityLog.entity_type == entity_type)
        if entity_id:
            query = query.filter(ActivityLog.entity_id == entity_id)
        if start_date and end_date:
            query = query.filter(ActivityLog.created_at.between(start_date, end_date))
        elif start_date:
            query = query.filter(ActivityLog.created_at >= start_date)
        elif end_date:
            query = query.filter(ActivityLog.created_at <= end_date)
        if tenant_id:
            query = query.filter(ActivityLog.tenant_id == tenant_id)
        
        # Apply pagination
        return query.offset(skip).limit(limit).all()
    
    def get_by_date_range(self, start_date: datetime, end_date: datetime, **filters) -> List[ActivityLog]:
        """Get audit logs within a date range with additional filters."""
        return self.get_all_activity_logs(
            start_date=start_date, end_date=end_date, **filters
        )
    
    def generate_activity_report(self, start_date: datetime, end_date: datetime, 
                               tenant_id: Optional[UUID] = None) -> Dict[str, Any]:
        """Generate an activity report for the specified date range."""
        logs = self.get_all_activity_logs(
            start_date=start_date, end_date=end_date, tenant_id=tenant_id
        )
        
        # Generate report statistics
        total_activities = len(logs)
        unique_users = len(set(log.user_id for log in logs if log.user_id))
        actions_by_type = {}
        
        for log in logs:
            action = log.action
            actions_by_type[action] = actions_by_type.get(action, 0) + 1
        
        return {
            "total_activities": total_activities,
            "unique_users": unique_users,
            "actions_by_type": actions_by_type,
            "date_range": {
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat()
            }
        }

        