from typing import List, Optional, Dict, Any
from uuid import UUID
from datetime import datetime, timedelta
from fastapi import Request, Depends
from sqlalchemy.orm import Session, joinedload

from src.db.crud.logging.activity_log import activity_log_crud
from src.db.models.logging.activity_log import ActivityLog
from src.schemas.logging.activity_log import ActivityLogCreate, ActivityLogUpdate
from src.services.base.base import TenantBaseService, SuperAdminBaseService
from src.db.session import get_db, get_super_admin_db
from src.core.middleware.tenant import get_tenant_from_request


class AuditLoggingService(TenantBaseService[ActivityLog, ActivityLogCreate, ActivityLogUpdate]):
    """Service for managing audit and activity logs within a tenant."""
    
    def __init__(
        self, 
        tenant: Any = Depends(get_tenant_from_request),
        db: Session = Depends(get_db),
        tenant_id: Optional[Any] = None
    ):
        # Extract tenant_id from the Tenant object or use the provided tenant_id
        final_tenant_id = tenant_id if tenant_id is not None else (tenant.id if hasattr(tenant, 'id') else tenant)
        super().__init__(crud=activity_log_crud, model=ActivityLog, tenant_id=final_tenant_id, db=db)
    
    async def log_activity(
        self,
        user_id: Optional[UUID],
        action: str,
        entity_type: str,
        entity_id: Optional[UUID] = None,
        old_values: Optional[Dict] = None,
        new_values: Optional[Dict] = None,
        details: Optional[str] = None,
        request: Optional[Request] = None
    ) -> ActivityLog:
        """Create a new activity log entry."""
        # Get IP and User Agent from request if available
        ip_address = None
        user_agent = None
        if request:
            ip_address = request.client.host if request.client else None
            user_agent = request.headers.get("user-agent")

        log_data = ActivityLogCreate(
            user_id=user_id,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            old_values=old_values,
            new_values=new_values,
            details=details,
            ip_address=ip_address,
            user_agent=user_agent,
            tenant_id=self.tenant_id
        )
        return self.crud.create(self.db, tenant_id=self.tenant_id, obj_in=log_data)

    async def list_with_count(self, skip: int = 0, limit: int = 100, filters: Optional[Dict] = None, **kwargs) -> tuple[List[ActivityLog], int]:
        """List records with total count, eager loading of user, and super-admin filtering."""
        from src.db.models.auth.user import User
        
        # Start with base query
        query = self.db.query(ActivityLog).filter(ActivityLog.tenant_id == self.tenant_id)
        
        # Apply filters
        if filters:
            for field, value in filters.items():
                if hasattr(ActivityLog, field):
                    column = getattr(ActivityLog, field)
                    if value is not None:
                        query = query.filter(column == value)
        
        # EXCLUDE logs where the user is NOT a tenant user (i.e. super-admins)
        # We join with User and ensure User.tenant_id == self.tenant_id
        # We use an outer join to keep system logs (user_id is null)
        query = query.outerjoin(User, ActivityLog.user_id == User.id)
        query = query.filter((User.id == None) | (User.tenant_id == self.tenant_id))
        
        # Get total count
        total = query.count()
        
        # Add eager loading and sorting
        query = query.options(joinedload(ActivityLog.user))
        query = query.order_by(ActivityLog.created_at.desc())
        
        items = query.offset(skip).limit(limit).all()
        return items, total

    async def get_by_date_range(self, start_date: datetime, end_date: datetime, skip: int = 0, limit: int = 100) -> tuple[List[ActivityLog], int]:
        """Get activity logs within a date range with pagination support."""
        from src.db.models.auth.user import User
        
        query = self.db.query(ActivityLog).filter(
            ActivityLog.tenant_id == self.tenant_id,
            ActivityLog.created_at.between(start_date, end_date)
        )
        
        # Apply super-admin filter
        query = query.outerjoin(User, ActivityLog.user_id == User.id)
        query = query.filter((User.id == None) | (User.tenant_id == self.tenant_id))
        
        total = query.count()
        
        query = query.options(joinedload(ActivityLog.user))
        query = query.order_by(ActivityLog.created_at.desc())
        
        items = query.offset(skip).limit(limit).all()
        return items, total

    async def get_recent_activities(self, days: int = 7, skip: int = 0, limit: int = 100) -> tuple[List[ActivityLog], int]:
        """Get all activity logs from the last X days."""
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=days)
        return await self.get_by_date_range(start_date, end_date, skip=skip, limit=limit)


class SuperAdminAuditLoggingService(SuperAdminBaseService[ActivityLog, ActivityLogCreate, ActivityLogUpdate]):
    """Super-admin service for managing audit and activity logs across all tenants."""
    
    def __init__(
        self,
        db: Session = Depends(get_super_admin_db)
    ):
        super().__init__(crud=activity_log_crud, model=ActivityLog, db=db)
    
    def get_all_activity_logs(self, skip: int = 0, limit: int = 100,
                            user_id: Optional[UUID] = None,
                            action: Optional[str] = None,
                            entity_type: Optional[str] = None,
                            entity_id: Optional[UUID] = None,
                            start_date: Optional[datetime] = None,
                            end_date: Optional[datetime] = None,
                            tenant_id: Optional[UUID] = None) -> tuple[List[ActivityLog], int]:
        """Get all activity logs across all tenants with filtering and return total count."""
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
        
        # Get total count before pagination
        total = query.count()
        
        # Add ordering
        query = query.order_by(ActivityLog.created_at.desc())
        
        # Apply pagination
        items = query.offset(skip).limit(limit).all()
        return items, total
    
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

        