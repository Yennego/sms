from fastapi import APIRouter

from .super_admin import router as super_admin_router

router = APIRouter()
router.include_router(super_admin_router)

__all__ = ["router"]