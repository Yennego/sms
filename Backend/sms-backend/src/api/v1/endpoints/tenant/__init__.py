from fastapi import APIRouter

from .tenant import router as tenant_router
from .admin_dashboard import router as admin_dashboard_router
from .notification_config import router as notification_config_router

router = APIRouter()
router.include_router(tenant_router)
router.include_router(admin_dashboard_router)
router.include_router(notification_config_router)

__all__ = ["router"]