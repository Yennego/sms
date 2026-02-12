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
from src.core.redis import cache
import json

router = APIRouter()

@router.get("/dashboard/stats")
async def get_admin_dashboard_stats(
    *,
    db: Session = Depends(get_db),
    tenant: Tenant = Depends(get_tenant_from_request),
    current_user: User = Depends(has_any_role(["admin", "superadmin"])),
) -> Any:
    """Get dashboard statistics for tenant admin with Redis caching."""
    cache_key = f"tenant:dashboard:stats:{tenant.id}"
    
    try:
        # 1. Try hitting the cache
        cached_data = await cache.get(cache_key)
        if cached_data:
            return cached_data

        # 2. Cache miss - fetch from DB
        from fastapi.concurrency import run_in_threadpool
        dashboard_service = TenantAdminDashboardService(db, str(tenant.id))
        stats = await run_in_threadpool(dashboard_service.get_dashboard_stats)
        
        # 3. Cache for 30 seconds
        await cache.set(cache_key, stats, expire=30)
        
        return stats
    except Exception as e:
        print(f"[Dashboard Stats] ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving dashboard stats: {str(e)}"
        )
