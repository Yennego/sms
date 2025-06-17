from typing import Any, List, Optional, Dict
from uuid import UUID
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from src.services.logging import AuditLoggingService, SuperAdminAuditLoggingService
from src.db.session import get_db
from src.schemas.logging.activity_log import ActivityLog, ActivityLogCreate
from src.core.middleware.tenant import get_tenant_from_request
from src.core.auth.dependencies import has_any_role, get_current_user, has_permission
from src.schemas.auth import User

router = APIRouter()

# Admin audit log endpoints
@router.get("/audit-logs", response_model=List[ActivityLog])
def get_audit_logs(
    *,
    audit_service: AuditLoggingService = Depends(),
    skip: int = 0,
    limit: int = 100,
    user_id: Optional[UUID] = Query(None, description="Filter by user ID"),
    entity_type: Optional[str] = Query(None, description="Filter by entity type"),
    entity_id: Optional[UUID] = Query(None, description="Filter by entity ID"),
    action: Optional[str] = Query(None, description="Filter by action"),
    start_date: Optional[datetime] = Query(None, description="Filter by start date"),
    end_date: Optional[datetime] = Query(None, description="Filter by end date"),
    current_user: User = Depends(has_any_role(["admin"]))
) -> Any:
    """Get audit logs with filtering (admin only)."""
    filters = {}
    if user_id:
        filters["user_id"] = user_id
    if entity_type:
        filters["entity_type"] = entity_type
    if entity_id:
        filters["entity_id"] = entity_id
    if action:
        filters["action"] = action
    
    # Apply date filtering if provided
    if start_date and end_date:
        return audit_service.get_by_date_range(start_date=start_date, end_date=end_date, **filters)
    
    return audit_service.get_multi(skip=skip, limit=limit, **filters)

@router.get("/audit-logs/user/{user_id}", response_model=List[ActivityLog])
def get_user_audit_logs(
    *,
    audit_service: AuditLoggingService = Depends(),
    user_id: UUID,
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(has_any_role(["admin"]))
) -> Any:
    """Get audit logs for a specific user (admin only)."""
    return audit_service.get_by_user(user_id=user_id)

@router.get("/audit-logs/entity/{entity_type}/{entity_id}", response_model=List[ActivityLog])
def get_entity_audit_logs(
    *,
    audit_service: AuditLoggingService = Depends(),
    entity_type: str,
    entity_id: UUID,
    current_user: User = Depends(has_any_role(["admin"]))
) -> Any:
    """Get audit logs for a specific entity (admin only)."""
    return audit_service.get_by_entity(entity_type=entity_type, entity_id=entity_id)

# Super Admin endpoints
@router.get("/super-admin/audit-logs", response_model=List[ActivityLog])
def get_all_audit_logs(
    *,
    audit_service: SuperAdminAuditLoggingService = Depends(),
    skip: int = 0,
    limit: int = 100,
    user_id: Optional[UUID] = Query(None, description="Filter by user ID"),
    entity_type: Optional[str] = Query(None, description="Filter by entity type"),
    entity_id: Optional[UUID] = Query(None, description="Filter by entity ID"),
    action: Optional[str] = Query(None, description="Filter by action"),
    tenant_id: Optional[UUID] = Query(None, description="Filter by tenant ID"),
    start_date: Optional[datetime] = Query(None, description="Filter by start date"),
    end_date: Optional[datetime] = Query(None, description="Filter by end date"),
    current_user: User = Depends(has_permission("view_all_audit_logs"))
) -> Any:
    """Get all audit logs across all tenants with filtering (super-admin only)."""
    filters = {}
    if user_id:
        filters["user_id"] = user_id
    if entity_type:
        filters["entity_type"] = entity_type
    if entity_id:
        filters["entity_id"] = entity_id
    if action:
        filters["action"] = action
    if tenant_id:
        filters["tenant_id"] = tenant_id
    
    # Apply date filtering if provided
    if start_date and end_date:
        return audit_service.get_by_date_range(start_date=start_date, end_date=end_date, **filters)
    
    return audit_service.get_multi(skip=skip, limit=limit, **filters)

@router.get("/super-admin/audit-logs/activity-report", response_model=Dict[str, Any])
def generate_activity_report(
    *,
    audit_service: SuperAdminAuditLoggingService = Depends(),
    days: int = Query(30, description="Number of days to include in the report"),
    tenant_id: Optional[UUID] = Query(None, description="Filter by tenant ID"),
    current_user: User = Depends(has_permission("generate_activity_reports"))
) -> Any:
    """Generate an activity report (super-admin only)."""
    end_date = datetime.utcnow()
    start_date = end_date - timedelta(days=days)
    
    return audit_service.generate_activity_report(start_date=start_date, end_date=end_date, tenant_id=tenant_id)