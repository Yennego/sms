from typing import Any, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from src.db.crud import tenant as tenant_crud
from src.db.crud import tenant_settings as tenant_settings_crud
from src.db.session import get_db
from src.schemas.tenant import Tenant, TenantCreate, TenantUpdate
from src.schemas.tenant import TenantSettings, TenantSettingsCreate, TenantSettingsUpdate
from src.schemas.tenant.tenant import TenantPublic, TenantSelfUpdate
from src.core.security.permissions import has_permission, require_super_admin
from src.db.models.auth import User
from src.core.middleware.tenant import get_tenant_id_from_request

router = APIRouter()


def _find_active_tenant(db: Session, identifier: str):
    """Active school by domain, code, subdomain or name (case-insensitive)."""
    normalized = (identifier or "").strip().lower()
    model = tenant_crud.model
    for condition in (
        func.lower(model.domain) == normalized,
        model.code == normalized.upper(),
        func.lower(model.subdomain) == normalized,
        func.lower(model.name) == normalized,
    ):
        tenant_obj = db.query(model).filter(condition, model.is_active == True).first()  # noqa: E712
        if tenant_obj:
            return tenant_obj
    return None


@router.post("/", response_model=Tenant, status_code=status.HTTP_201_CREATED)
def create_tenant(
    *, db: Session = Depends(get_db), tenant_in: TenantCreate,
    current_user: User = Depends(require_super_admin())
) -> Any:
    """Create a new tenant (super-admin)."""
    tenant_obj = tenant_crud.get_by_code(db, code=tenant_in.code)
    if tenant_obj:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tenant with this code already exists"
        )
    return tenant_crud.create(db, obj_in=tenant_in)

@router.get("/active", response_model=List[Tenant])
def get_active_tenants(
    *, db: Session = Depends(get_db), skip: int = 0, limit: int = 100,
    current_user: User = Depends(require_super_admin())
) -> Any:
    """Get all active tenants (super-admin)."""
    return tenant_crud.get_active_tenants(db, skip=skip, limit=limit)

# Public (PUBLIC_ROUTES): used by the login page before anyone is signed in
@router.get("/by-domain/", response_model=Optional[TenantPublic])
def get_tenant_by_domain(*, db: Session = Depends(get_db), domain: str) -> Any:
    """Public branding of an active school, found by domain, code, subdomain or name."""
    return _find_active_tenant(db, domain)

# Public (PUBLIC_ROUTES) only for the ?domain= lookup; listing every school needs a super-admin
@router.get("/", response_model=List[TenantPublic])
def get_tenants(
    *,
    db: Session = Depends(get_db),
    domain: Optional[str] = Query(None, description="Find one active school by domain")
) -> Any:
    """Public lookup of one school by domain. Super-admins list schools via /super-admin/tenants."""
    if not domain:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="domain is required")
    tenant_obj = _find_active_tenant(db, domain)
    return [tenant_obj] if tenant_obj else []

# Public (PUBLIC_ROUTES): branding for the login page
@router.get("/{tenant_id}", response_model=TenantPublic)
def get_tenant(*, db: Session = Depends(get_db), tenant_id: UUID) -> Any:
    """Public branding of an active school."""
    tenant_obj = tenant_crud.get(db, id=tenant_id)
    if not tenant_obj or not tenant_obj.is_active:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant not found"
        )
    return tenant_obj

@router.put("/self", response_model=Tenant)
def update_own_tenant(
    *,
    db: Session = Depends(get_db),
    tenant_id: UUID = Depends(get_tenant_id_from_request),
    tenant_in: TenantSelfUpdate,
    current_user: User = Depends(has_permission("manage_tenant_settings"))
) -> Any:
    """A school admin updates their own school's branding (name, logo, colours)."""
    tenant_obj = tenant_crud.get(db, id=tenant_id)
    if not tenant_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant not found"
        )
    return tenant_crud.update(db, db_obj=tenant_obj, obj_in=tenant_in.model_dump(exclude_unset=True))

@router.put("/{tenant_id}", response_model=Tenant)
def update_tenant(
    *,
    db: Session = Depends(get_db),
    tenant_id: UUID,
    tenant_in: TenantUpdate,
    current_user: User = Depends(require_super_admin())
) -> Any:
    """Update any field of a tenant, including billing and status (super-admin)."""
    tenant_obj = tenant_crud.get(db, id=tenant_id)
    if not tenant_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant not found"
        )
    return tenant_crud.update(db, db_obj=tenant_obj, obj_in=tenant_in)

@router.delete("/{tenant_id}", response_model=Tenant)
def delete_tenant(
    *, db: Session = Depends(get_db), tenant_id: UUID,
    current_user: User = Depends(require_super_admin())
) -> Any:
    """Delete the school named in the path if it holds no records (super-admin)."""
    tenant_obj = tenant_crud.get(db, id=tenant_id)
    if not tenant_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant not found"
        )
    return tenant_crud.remove_empty(db, id=tenant_id)

# Tenant Settings endpoints: always the caller's own school (the path id must match it)
def _own_tenant(tenant_id: UUID, request_tenant_id: UUID) -> UUID:
    if str(tenant_id) != str(request_tenant_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You don't have access to this school")
    return request_tenant_id

@router.post("/{tenant_id}/settings", response_model=TenantSettings)
def create_tenant_settings(
    *, db: Session = Depends(get_db), tenant_id: UUID,
    request_tenant_id: UUID = Depends(get_tenant_id_from_request),
    settings_in: TenantSettingsCreate,
    current_user: User = Depends(has_permission("manage_tenant_settings"))
) -> Any:
    """Create settings for the caller's school."""
    tenant_id = _own_tenant(tenant_id, request_tenant_id)
    tenant_obj = tenant_crud.get(db, id=tenant_id)
    if not tenant_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant not found"
        )

    existing_settings = tenant_settings_crud.get_by_tenant_id(db, tenant_id=tenant_id)
    if existing_settings:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Settings already exist for this tenant"
        )

    return tenant_settings_crud.create(db, tenant_id=tenant_id, obj_in=settings_in)

@router.get("/{tenant_id}/settings", response_model=Optional[TenantSettings])
def get_tenant_settings(
    *, db: Session = Depends(get_db), tenant_id: UUID,
    request_tenant_id: UUID = Depends(get_tenant_id_from_request)
) -> Any:
    """Get settings for the caller's school."""
    tenant_id = _own_tenant(tenant_id, request_tenant_id)
    tenant_obj = tenant_crud.get(db, id=tenant_id)
    if not tenant_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant not found"
        )

    settings = tenant_settings_crud.get_by_tenant_id(db, tenant_id=tenant_id)
    # Return None if not found, instead of raising 404 to reduce log noise
    return settings

@router.put("/{tenant_id}/settings", response_model=TenantSettings)
def update_tenant_settings(
    *, db: Session = Depends(get_db), tenant_id: UUID,
    request_tenant_id: UUID = Depends(get_tenant_id_from_request),
    settings_in: TenantSettingsUpdate,
    current_user: User = Depends(has_permission("manage_tenant_settings"))
) -> Any:
    """Update settings for the caller's school."""
    tenant_id = _own_tenant(tenant_id, request_tenant_id)
    tenant_obj = tenant_crud.get(db, id=tenant_id)
    if not tenant_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant not found"
        )

    settings = tenant_settings_crud.get_by_tenant_id(db, tenant_id=tenant_id)
    if not settings:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Settings not found for this tenant"
        )

    return tenant_settings_crud.update(db, tenant_id=tenant_id, db_obj=settings, obj_in=settings_in)
