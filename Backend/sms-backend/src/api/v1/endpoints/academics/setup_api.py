from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from src.db.session import get_db
from src.core.middleware.tenant import get_tenant_from_request
from src.schemas.academics.setup import AcademicSetupStatus
from src.services.academics.setup_service import AcademicSetupService
from src.core.auth.dependencies import get_current_user
from src.schemas.auth import User
from typing import Any

router = APIRouter(prefix="/setup", tags=["setup"])

@router.get("/status", response_model=AcademicSetupStatus)
async def get_setup_status(
    *,
    db: Session = Depends(get_db),
    tenant: Any = Depends(get_tenant_from_request),
    current_user: User = Depends(get_current_user)
) -> Any:
    """Get consolidated status counts for academic setup."""
    tenant_id = tenant.id if hasattr(tenant, 'id') else tenant
    service = AcademicSetupService(db=db, tenant_id=tenant_id)
    return service.get_setup_status()
