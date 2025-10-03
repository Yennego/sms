from typing import Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from uuid import UUID

from src.db.session import get_db, get_tenant_id
from src.core.auth.dependencies import has_permission, has_any_role, get_current_user
from src.services.tenant.admin_dashboard import TenantAdminDashboardService
from src.db.models.auth import User
from src.db.models.tenant import Tenant
from src.core.middleware.tenant import get_tenant_from_request

router = APIRouter()

@router.get("/dashboard/stats")
def get_admin_dashboard_stats(
    *,
    db: Session = Depends(get_db),
    tenant: Tenant = Depends(get_tenant_from_request),  # Get tenant directly from header
    current_user: User = Depends(has_any_role(["admin", "superadmin"])),  # Require admin or superadmin role
) -> Any:
    """Get dashboard statistics for tenant admin."""
    try:
        dashboard_service = TenantAdminDashboardService(db, str(tenant.id))
        stats = dashboard_service.get_dashboard_stats()
        return stats
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving dashboard stats: {str(e)}"
        )
