from typing import Any
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from src.services.academics.dashboard_service import AcademicDashboardService
from src.schemas.academics.dashboard import AcademicDashboardStats
from src.db.session import get_db
from src.core.middleware.tenant import get_tenant_from_request
from src.db.models.auth import User
from src.core.auth.dependencies import get_current_user

from fastapi.concurrency import run_in_threadpool
from src.core.redis import cache

router = APIRouter()

@router.get("/stats", response_model=AcademicDashboardStats)
async def get_dashboard_stats(
    db: Session = Depends(get_db),
    tenant: Any = Depends(get_tenant_from_request),
    current_user: User = Depends(get_current_user)
) -> Any:
    """Get consolidated academic dashboard statistics."""
    print(f"DEBUG: get_dashboard_stats called for user: {current_user.email} (Role: {current_user.role})")
    tenant_id = tenant.id if hasattr(tenant, 'id') else tenant
    
    # We only cache general stats for admins/super_admins
    # Personalized stats for students/teachers should not be globally cached
    is_personalized = current_user.role in ["student", "teacher"]
    cache_key = f"academics:stats:{tenant_id}"
    
    if not is_personalized:
        cached_stats = await cache.get(cache_key)
        if cached_stats:
            return cached_stats
    
    service = AcademicDashboardService(db, tenant_id, current_user=current_user)
    stats = await service.get_stats()
    
    if not is_personalized:
        # Cache general stats for 30 seconds
        await cache.set(cache_key, stats.model_dump(), expire=30)
    
    return stats
