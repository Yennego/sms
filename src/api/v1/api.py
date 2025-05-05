from fastapi import APIRouter

# Update the imports
from src.api.v1.endpoints import tenant, auth, people, super_admin

# Update the router includes
api_router = APIRouter()

# Include routers for each module
api_router.include_router(tenant.router, prefix="/tenants", tags=["tenants"])
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(people.router, prefix="/people", tags=["people"])
api_router.include_router(super_admin.router, prefix="/super-admin", tags=["super-admin"])