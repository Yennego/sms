from typing import Any, List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from src.core import security
from src.db.session import get_db
from src.schemas.tenant import Tenant, TenantCreate, TenantUpdate
from src.services.tenant import tenant_service

router = APIRouter()

@router.post("/", response_model=Tenant)
def create_tenant(
    *,
    db: Session = Depends(get_db),
    tenant_in: TenantCreate,
    current_user: Any = Depends(security.get_current_superuser),
) -> Any:
    """
    Create new tenant.
    """
    _ = current_user  # Mark as used
    tenant = tenant_service.get_by_slug(db, slug=tenant_in.slug)
    if tenant:
        raise HTTPException(
            status_code=400,
            detail="A tenant with this slug already exists in the system.",
        )
    tenant = tenant_service.create(db, obj_in=tenant_in)
    return tenant

@router.get("/", response_model=List[Tenant])
def read_tenants(
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 100,
    current_user: Any = Depends(security.get_current_superuser),
) -> Any:
    """
    Retrieve tenants.
    """
    tenants = tenant_service.get_multi(db, skip=skip, limit=limit)
    _ = current_user  # Mark as used
    return tenants

@router.get("/{tenant_id}", response_model=Tenant)
def read_tenant(
    tenant_id: str,
    db: Session = Depends(get_db),
    current_user: Any = Depends(security.get_current_superuser),
) -> Any:
    """
    Get tenant by ID.
    """
    _ = current_user  # Mark as used
    tenant = tenant_service.get(db, id=tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    return tenant

@router.put("/{tenant_id}", response_model=Tenant)
def update_tenant(
    *,
    db: Session = Depends(get_db),
    tenant_id: str,
    tenant_in: TenantUpdate,
    current_user: Any = Depends(security.get_current_superuser),
) -> Any:
    """
    Update a tenant.
    """
    _ = current_user  # Mark as used
    tenant = tenant_service.get(db, id=tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    tenant = tenant_service.update(db, db_obj=tenant, obj_in=tenant_in)
    return tenant

@router.delete("/{tenant_id}", response_model=Tenant)
def delete_tenant(
    *,
    db: Session = Depends(get_db),
    tenant_id: str,
    current_user: Any = Depends(security.get_current_superuser),
) -> Any:
    """
    Delete a tenant.
    """
    _ = current_user  # Mark as used to silence linter warning
    tenant = tenant_service.get(db, id=tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    tenant = tenant_service.remove(db, id=tenant_id)
    return tenant 