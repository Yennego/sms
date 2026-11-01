from typing import List, Optional, Dict, Any
from uuid import UUID
from datetime import datetime, timedelta
from fastapi import Request
from sqlalchemy.orm import Session
from sqlalchemy import desc

from src.db.models.logging.super_admin_activity_log import SuperAdminActivityLog
from src.db.models.auth.user import User
from src.schemas.logging.super_admin_activity_log import SuperAdminActivityLogCreate, SuperAdminActivityLogUpdate
from src.services.logging.activity_log_service import is_key_event


class SuperAdminActivityLogService:
    """Service for managing super-admin activity logs (no tenant isolation)."""
    
    def __init__(self, db: Session):
        self.db = db
    
    async def log_super_admin_activity(
        self, 
        user_id: Optional[UUID], 
        action: str, 
        entity_type: str,
        entity_id: Optional[UUID] = None, 
        target_tenant_id: Optional[UUID] = None,
        old_values: Optional[Dict[str, Any]] = None,
        new_values: Optional[Dict[str, Any]] = None, 
        details: Optional[str] = None,
        request: Optional[Request] = None
    ) -> SuperAdminActivityLog:
        """Log a super-admin activity."""
        # Extract IP address and user agent from request if provided
        ip_address = None
        user_agent = None
        if request:
            ip_address = request.client.host if hasattr(request.client, 'host') else None
            user_agent = request.headers.get("user-agent")
        
        # Create activity log
        activity_log = SuperAdminActivityLog(
            user_id=user_id,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            target_tenant_id=target_tenant_id,
            old_values=old_values,
            new_values=new_values,
            ip_address=ip_address,
            user_agent=user_agent,
            details=details
        )
        
        self.db.add(activity_log)
        self.db.commit()
        self.db.refresh(activity_log)
        
        return activity_log
    
    def _filtered(
        self,
        user_id: Optional[UUID] = None,
        action: Optional[str] = None,
        entity_type: Optional[str] = None,
        target_tenant_id: Optional[UUID] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ):
        """Key actions (create/update/delete) matching the given filters."""
        query = self.db.query(SuperAdminActivityLog).filter(is_key_event(SuperAdminActivityLog))
        if user_id:
            query = query.filter(SuperAdminActivityLog.user_id == user_id)
        if action:
            query = query.filter(SuperAdminActivityLog.action == action)
        if entity_type:
            query = query.filter(SuperAdminActivityLog.entity_type == entity_type)
        if target_tenant_id:
            query = query.filter(SuperAdminActivityLog.target_tenant_id == target_tenant_id)
        if start_date and end_date:
            query = query.filter(SuperAdminActivityLog.created_at.between(start_date, end_date))
        elif start_date:
            query = query.filter(SuperAdminActivityLog.created_at >= start_date)
        elif end_date:
            query = query.filter(SuperAdminActivityLog.created_at <= end_date)
        return query

    def get_all_logs(self, skip: int = 0, limit: int = 100, **filters) -> List[SuperAdminActivityLog]:
        """Get super-admin activity logs with filtering, most recent first."""
        return (
            self._filtered(**filters)
            .order_by(desc(SuperAdminActivityLog.created_at))
            .offset(skip).limit(limit).all()
        )

    def get_count(self, **filters) -> int:
        """Get count of super-admin activity logs with filtering."""
        return self._filtered(**filters).count()