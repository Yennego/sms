from fastapi import APIRouter

# Endpoint imports (core service endpoint etc)
from src.api.v1.endpoints import tenant, auth, people, super_admin, academics, communication, logging, resources
from src.api.v1.endpoints.specialized import financial_academic

# Update the router includes
api_router = APIRouter()

# Include routers for each module
api_router.include_router(tenant.router, prefix="/tenants", tags=["tenants"])
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(people.router, prefix="/people", tags=["people"])
api_router.include_router(academics.router, prefix="/academics", tags=["academics"])
api_router.include_router(communication.router, prefix="/communication", tags=["communication"])
api_router.include_router(logging.router, prefix="/logging", tags=["logging"])
api_router.include_router(resources.router, prefix="/resources", tags=["resources"])
api_router.include_router(super_admin.router, prefix="/super-admin", tags=["super-admin"])
api_router.include_router(financial_academic.router, prefix="/specialized", tags=["specialized"])