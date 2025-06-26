from typing import Any, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from src.db.crud import tenant as tenant_crud
from src.db.crud import tenant_settings as tenant_settings_crud
from src.db.session import get_db
from src.schemas.tenant import Tenant, TenantCreate, TenantUpdate
from src.schemas.tenant import TenantSettings, TenantSettingsCreate, TenantSettingsUpdate
from src.core.auth.dependencies import has_role, has_any_role
from src.db.models.auth import User

router = APIRouter()

@router.post("/", response_model=Tenant, status_code=status.HTTP_201_CREATED)
def create_tenant(*, db: Session = Depends(get_db), tenant_in: TenantCreate) -> Any:
    """Create a new tenant."""
    tenant_obj = tenant_crud.get_by_code(db, code=tenant_in.code)
    if tenant_obj:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tenant with this code already exists"
        )
    return tenant_crud.create(db, obj_in=tenant_in)

@router.get("/", response_model=List[Tenant])
def get_tenants(*, db: Session = Depends(get_db), skip: int = 0, limit: int = 100) -> Any:
    """Get all tenants."""
    return tenant_crud.get_multi(db, skip=skip, limit=limit)

@router.get("/active", response_model=List[Tenant])
def get_active_tenants(*, db: Session = Depends(get_db), skip: int = 0, limit: int = 100) -> Any:
    """Get all active tenants."""
    return tenant_crud.get_active_tenants(db, skip=skip, limit=limit)

@router.get("/{tenant_id}", response_model=Tenant)
def get_tenant(*, db: Session = Depends(get_db), tenant_id: UUID) -> Any:
    """Get a specific tenant by ID."""
    tenant_obj = tenant_crud.get(db, id=tenant_id)
    if not tenant_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant not found"
        )
    return tenant_obj

@router.put("/{tenant_id}", response_model=Tenant)
def update_tenant(
    *, 
    db: Session = Depends(get_db), 
    tenant_id: UUID, 
    tenant_in: TenantUpdate,
    current_user: User = Depends(has_role("admin"))
) -> Any:
    """Update a tenant (requires admin role)."""
    tenant_obj = tenant_crud.get(db, id=tenant_id)
    if not tenant_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant not found"
        )
    return tenant_crud.update(db, db_obj=tenant_obj, obj_in=tenant_in)

@router.delete("/{tenant_id}", response_model=Tenant)
def delete_tenant(*, db: Session = Depends(get_db), tenant_id: UUID) -> Any:
    """Delete a tenant."""
    tenant_obj = tenant_crud.get(db, id=tenant_id)
    if not tenant_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant not found"
        )
    return tenant_crud.remove(db, id=tenant_id)

# Tenant Settings endpoints
@router.post("/{tenant_id}/settings", response_model=TenantSettings)
def create_tenant_settings(*, db: Session = Depends(get_db), tenant_id: UUID, settings_in: TenantSettingsCreate) -> Any:
    """Create settings for a tenant."""
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

@router.get("/{tenant_id}/settings", response_model=TenantSettings)
def get_tenant_settings(*, db: Session = Depends(get_db), tenant_id: UUID) -> Any:
    """Get settings for a tenant."""
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
    
    return settings

@router.put("/{tenant_id}/settings", response_model=TenantSettings)
def update_tenant_settings(*, db: Session = Depends(get_db), tenant_id: UUID, settings_in: TenantSettingsUpdate) -> Any:
    """Update settings for a tenant."""
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