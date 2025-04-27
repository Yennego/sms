from fastapi import APIRouter

from src.api.v1.endpoints import auth, tenants, class_room

api_router = APIRouter()

# Include all endpoint routers
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(tenants.router, prefix="/tenants", tags=["tenants"])
api_router.include_router(class_room.router, prefix="/class-rooms", tags=["class-rooms"])