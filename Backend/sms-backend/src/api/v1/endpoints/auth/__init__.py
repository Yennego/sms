from fastapi import APIRouter

from .auth import router as auth_router
from .admin_api import router as admin_router

router = APIRouter()
router.include_router(auth_router)
router.include_router(admin_router)

@router.get("/me")
async def read_current_user():
    return {"message": "Dummy auth me endpoint"}

@router.post("/refresh")
async def refresh_token():
    return {"message": "Dummy auth refresh endpoint"}

@router.post("/login")
async def login_user():
    return {"message": "Dummy auth login endpoint"}

__all__ = ["router"]


