from fastapi import APIRouter

from src.api.v1.endpoints.auth.auth import router as auth_router
from src.api.v1.endpoints.auth.admin_api import router as admin_router
# # Import other routers as needed

router = APIRouter()
# router.include_router(auth_router)
router.include_router(auth_router, tags=["auth"])
router.include_router(admin_router, tags=["admins"])
# # Include other routers as needed

__all__ = ["router"]

# from fastapi import APIRouter

# router = APIRouter()

@router.get("/me")
async def read_current_user():
    return {"message": "Dummy auth me endpoint"}

@router.post("/refresh")
async def refresh_token():
    return {"message": "Dummy auth refresh endpoint"}

@router.post("/login")
async def login_user():
    return {"message": "Dummy auth login endpoint"}


