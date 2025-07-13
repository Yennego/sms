from typing import List, Optional, Any, Dict
from uuid import UUID
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import desc

from src.core.security.permissions import has_permission
from src.db.models.auth.user import User
from src.db.session import get_db, get_super_admin_db
from src.schemas.logging.activity_log import ActivityLog
from src.schemas.logging.super_admin_activity_log import AuditLogResponse
from src.services.logging import AuditLoggingService
from src.services.logging.super_admin_activity_log_service import SuperAdminActivityLogService

router = APIRouter()

# Super-admin endpoint - view all audit logs across all tenants
def get_super_admin_audit_service(db: Session = Depends(get_super_admin_db)) -> SuperAdminActivityLogService:
    """Dependency to get SuperAdminActivityLogService instance."""
    return SuperAdminActivityLogService(db=db)

@router.get("/super-admin/audit-logs", response_model=List[AuditLogResponse])
def get_super_admin_audit_logs(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    user_id: Optional[str] = Query(None),
    action: Optional[str] = Query(None),
    entity_type: Optional[str] = Query(None),
    target_tenant_id: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    audit_service: SuperAdminActivityLogService = Depends(get_super_admin_audit_service),
    current_user: User = Depends(has_permission("view_all_audit_logs"))  # Super-admin permission
):
    """Get all super-admin audit logs (super-admin only)."""
    try:
        # Parse optional parameters
        parsed_user_id = UUID(user_id) if user_id else None
        parsed_target_tenant_id = UUID(target_tenant_id) if target_tenant_id else None
        parsed_start_date = datetime.fromisoformat(start_date.replace('Z', '+00:00')) if start_date else None
        parsed_end_date = datetime.fromisoformat(end_date.replace('Z', '+00:00')) if end_date else None
        
        logs = audit_service.get_all_logs(
            skip=skip,
            limit=limit,
            user_id=parsed_user_id,
            action=action,
            entity_type=entity_type,
            target_tenant_id=parsed_target_tenant_id,
            start_date=parsed_start_date,
            end_date=parsed_end_date
        )
        
        # Transform to match frontend expectations
        return [
            AuditLogResponse(
                id=str(log.id),
                timestamp=log.created_at.isoformat(),
                user=f"{log.user.first_name} {log.user.last_name}" if log.user else "System",
                action=log.action,
                details=log.details or f"{log.entity_type}: {log.action}",
                ipAddress=log.ip_address or "Unknown"
            )
            for log in logs
        ]
        
    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid parameter format: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error retrieving audit logs: {str(e)}"
        )

# Admin endpoint - view audit logs for current tenant only
@router.get("/audit-logs", response_model=List[ActivityLog])
def get_tenant_audit_logs(
    *,
    audit_service: AuditLoggingService = Depends(),
    skip: int = 0,
    limit: int = 10,  # Changed from 100 to 10
    user_id: Optional[UUID] = Query(None, description="Filter by user ID"),
    entity_type: Optional[str] = Query(None, description="Filter by entity type"),
    entity_id: Optional[UUID] = Query(None, description="Filter by entity ID"),
    action: Optional[str] = Query(None, description="Filter by action"),
    start_date: Optional[datetime] = Query(None, description="Filter by start date"),
    end_date: Optional[datetime] = Query(None, description="Filter by end date"),
    current_user: User = Depends(has_permission("view_audit_logs"))  # Admin permission
) -> Any:
    """Get audit logs for current tenant (admin only)."""
    try:
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
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving audit logs: {str(e)}"
        )

@router.get("/super-admin/audit-logs/activity-report", response_model=Dict[str, Any])
def generate_activity_report(
    *,
    audit_service: SuperAdminActivityLogService = Depends(get_super_admin_audit_service),
    days: int = Query(30, description="Number of days to include in the report"),
    tenant_id: Optional[UUID] = Query(None, description="Filter by tenant ID"),
    current_user: User = Depends(has_permission("generate_activity_reports"))
) -> Any:
    """Generate an activity report (super-admin only)."""
    try:
        end_date = datetime.now(tz=timezone.utc)
        start_date = end_date - timedelta(days=days)
        
        return audit_service.generate_activity_report(start_date=start_date, end_date=end_date, tenant_id=tenant_id)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error generating activity report: {str(e)}"
        )

@router.get("/audit-logs/user/{user_id}", response_model=List[ActivityLog])
def get_user_audit_logs(
    *,
    audit_service: AuditLoggingService = Depends(),
    user_id: UUID,
    skip: int = 0,
    limit: int = 10,  # Changed from 100 to 10
    current_user: User = Depends(has_permission("view_audit_logs"))
) -> Any:
    """Get audit logs for a specific user (admin only)."""
    try:
        return audit_service.get_by_user(user_id=user_id)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving user audit logs: {str(e)}"
        )

@router.get("/audit-logs/entity/{entity_type}/{entity_id}", response_model=List[ActivityLog])
def get_entity_audit_logs(
    *,
    audit_service: AuditLoggingService = Depends(),
    entity_type: str,
    entity_id: UUID,
    current_user: User = Depends(has_permission("view_audit_logs"))
) -> Any:
    """Get audit logs for a specific entity (admin only)."""
    try:
        return audit_service.get_by_entity(entity_type=entity_type, entity_id=entity_id)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving entity audit logs: {str(e)}"
        )

@router.get("/super-admin/audit-logs/all", response_model=List[AuditLogResponse])
def get_all_audit_logs_combined(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    user_id: Optional[str] = Query(None),
    action: Optional[str] = Query(None),
    entity_type: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    tenant_id: Optional[str] = Query(None, description="Filter by specific tenant"),
    log_type: Optional[str] = Query('all', description="Filter by log type: 'all', 'super_admin', 'tenant'"),
    db: Session = Depends(get_super_admin_db),
    current_user: User = Depends(has_permission("view_all_audit_logs"))
):
    """Get all audit logs from both super-admin and regular tenant tables."""
    try:
        # Parse optional parameters
        parsed_user_id = UUID(user_id) if user_id else None
        parsed_tenant_id = UUID(tenant_id) if tenant_id else None
        parsed_start_date = datetime.fromisoformat(start_date.replace('Z', '+00:00')) if start_date else None
        parsed_end_date = datetime.fromisoformat(end_date.replace('Z', '+00:00')) if end_date else None
        
        all_logs = []
        
        # Get super-admin logs if requested
        if log_type in ['all', 'super_admin']:
            super_admin_service = SuperAdminActivityLogService(db=db)
            super_admin_logs = super_admin_service.get_all_logs(
                skip=0,
                limit=limit * 2,  # Get more to ensure we have enough after combining
                user_id=parsed_user_id,
                action=action,
                entity_type=entity_type,
                start_date=parsed_start_date,
                end_date=parsed_end_date
            )
            
            # Add super-admin logs with "Super-Admin" prefix
            for log in super_admin_logs:
                all_logs.append(AuditLogResponse(
                    id=str(log.id),
                    timestamp=log.created_at.isoformat(),
                    user=f"Super Admin - {log.user.first_name} {log.user.last_name}" if log.user else "Super Admin - System",
                    action=log.action,
                    details=log.details or f"Super-admin {log.action} on {log.entity_type}",
                    ipAddress=log.ip_address or "Unknown"
                ))
        
        # Get regular tenant logs if requested
        if log_type in ['all', 'tenant']:
            # Note: For tenant logs, we need to query across all tenants from super-admin perspective
            # This is a simplified approach - in production, you might want to implement
            # a more sophisticated cross-tenant query
            from src.db.models.logging.activity_log import ActivityLog
            from src.db.models.tenant.tenant import Tenant
            
            query = db.query(ActivityLog).join(Tenant, ActivityLog.tenant_id == Tenant.id)
            
            # Apply filters
            if parsed_user_id:
                query = query.filter(ActivityLog.user_id == parsed_user_id)
            if action:
                query = query.filter(ActivityLog.action == action)
            if entity_type:
                query = query.filter(ActivityLog.entity_type == entity_type)
            if parsed_tenant_id:
                query = query.filter(ActivityLog.tenant_id == parsed_tenant_id)
            if parsed_start_date and parsed_end_date:
                query = query.filter(ActivityLog.created_at.between(parsed_start_date, parsed_end_date))
            elif parsed_start_date:
                query = query.filter(ActivityLog.created_at >= parsed_start_date)
            elif parsed_end_date:
                query = query.filter(ActivityLog.created_at <= parsed_end_date)
            
            # Order by most recent first and limit
            tenant_logs = query.order_by(desc(ActivityLog.created_at)).limit(limit * 2).all()
            
            # Add tenant logs with tenant context
            for log in tenant_logs:
                tenant_name = "Unknown Tenant"
                if hasattr(log, 'tenant') and log.tenant:
                    tenant_name = log.tenant.name
                elif hasattr(log, 'tenant_id') and log.tenant_id:
                    tenant_name = f"Tenant {str(log.tenant_id)[:8]}..."
                
                user_name = "System"
                if hasattr(log, 'user') and log.user:
                    user_name = f"{log.user.first_name} {log.user.last_name}"
                
                all_logs.append(AuditLogResponse(
                    id=str(log.id),
                    timestamp=log.created_at.isoformat(),
                    user=f"{user_name} ({tenant_name})",
                    action=log.action,
                    details=f"{log.entity_type}: {log.action}",
                    ipAddress=log.ip_address or "Unknown"
                ))
        
        # Sort by timestamp (most recent first)
        all_logs.sort(key=lambda x: x.timestamp, reverse=True)
        
        # Apply pagination
        return all_logs[skip:skip + limit]
        
    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid parameter format: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error retrieving audit logs: {str(e)}"
        )