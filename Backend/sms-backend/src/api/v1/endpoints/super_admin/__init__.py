from fastapi import APIRouter

from .super_admin import router as super_admin_router
from .dashboard import router as dashboard_router

router = APIRouter()
router.include_router(super_admin_router)
router.include_router(dashboard_router)

__all__ = ["router"]