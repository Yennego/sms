from fastapi import APIRouter, Depends

from src.api.v1.endpoints import tenant, auth, people, super_admin, academics, communication, logging, resources, finance, verify, billing
from src.core.security.auth import authenticate_request
from src.services.billing.access import enforce_school_billing
from src.services.tenant.features import enforce_parent_portal

# Authenticated by default: every route requires a valid session and is bound to the
# user's own school, except the explicit PUBLIC_ROUTES allow-list in core/security/auth.py.
# Then the school's platform billing status applies (read-only, suspended: services/billing/access.py).
api_router = APIRouter(dependencies=[Depends(authenticate_request), Depends(enforce_school_billing),
                                     Depends(enforce_parent_portal)])


# Include routers for each module
api_router.include_router(tenant.router, prefix="/tenants", tags=["tenants"])
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(people.router, prefix="/people", tags=["people"])
api_router.include_router(academics.router, prefix="/academics", tags=["academics"])
api_router.include_router(communication.router, prefix="/communication", tags=["communication"])
api_router.include_router(logging.router, prefix="/logging", tags=["logging"])
api_router.include_router(resources.router, prefix="/resources", tags=["resources"])
api_router.include_router(super_admin.router, prefix="/super-admin", tags=["super-admin"])
api_router.include_router(finance.router, prefix="/finance", tags=["finance"])
api_router.include_router(billing.router, prefix="/billing", tags=["billing"])
api_router.include_router(verify.router, prefix="/verify", tags=["verify"])  # public (PUBLIC_ROUTES)