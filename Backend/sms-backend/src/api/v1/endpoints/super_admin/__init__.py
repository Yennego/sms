from fastapi import APIRouter

from .super_admin import router as super_admin_router
from .dashboard import router as dashboard_router
from .billing import router as billing_router

router = APIRouter()
router.include_router(super_admin_router)
router.include_router(dashboard_router)
# Platform billing (phase7-design.md §5)
router.include_router(billing_router, prefix="/billing", tags=["platform-billing"])

__all__ = ["router"]