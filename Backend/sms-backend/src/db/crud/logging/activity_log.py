from typing import List, Optional, Dict, Any
from uuid import UUID
from datetime import datetime, timedelta
from sqlalchemy.orm import Session

from src.db.crud.base.base import TenantCRUDBase
from src.db.models.logging.activity_log import ActivityLog
from src.schemas.logging.activity_log import ActivityLogCreate, ActivityLogUpdate


class CRUDActivityLog(TenantCRUDBase[ActivityLog, ActivityLogCreate, ActivityLogUpdate]):
    """CRUD operations for ActivityLog model."""
    
    def get_by_user(self, db: Session, tenant_id: Any, user_id: Any) -> List[ActivityLog]:
        """Get all activity logs for a specific user within a tenant."""
        return db.query(ActivityLog).filter(
            ActivityLog.tenant_id == tenant_id,
            ActivityLog.user_id == user_id
        ).all()
    
    def get_by_entity(self, db: Session, tenant_id: Any, entity_type: str, entity_id: Any) -> List[ActivityLog]:
        """Get all activity logs for a specific entity within a tenant."""
        return db.query(ActivityLog).filter(
            ActivityLog.tenant_id == tenant_id,
            ActivityLog.entity_type == entity_type,
            ActivityLog.entity_id == entity_id
        ).all()
    
    def get_by_action(self, db: Session, tenant_id: Any, action: str) -> List[ActivityLog]:
        """Get all activity logs for a specific action within a tenant."""
        return db.query(ActivityLog).filter(
            ActivityLog.tenant_id == tenant_id,
            ActivityLog.action == action
        ).all()
    
    def get_by_date_range(self, db: Session, tenant_id: Any, start_date: datetime, end_date: datetime) -> List[ActivityLog]:
        """Get all activity logs within a date range within a tenant."""
        return db.query(ActivityLog).filter(
            ActivityLog.tenant_id == tenant_id,
            ActivityLog.created_at.between(start_date, end_date)
        ).all()


activity_log_crud = CRUDActivityLog(ActivityLog)

