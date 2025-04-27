from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from src.db.session import get_db
from src.core.middleware.tenant import get_tenant_from_request
from src.db.models.tenant import Tenant

router = APIRouter()


@router.get("/tenant-info", summary="Get current tenant information")
async def get_tenant_info(tenant: Tenant = Depends(get_tenant_from_request)):
    """Get information about the current tenant."""
    return {
        "id": str(tenant.id),
        "name": tenant.name,
        "slug": tenant.slug,
        "domain": tenant.domain,
        "is_active": tenant.is_active
    }


@router.get("/tenant-settings", summary="Get current tenant settings")
async def get_tenant_settings(
    tenant: Tenant = Depends(get_tenant_from_request),
    db: Session = Depends(get_db)
):
    """Get settings for the current tenant."""
    # The tenant relationship is automatically loaded
    if not tenant.settings:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Settings not found for this tenant"
        )
    
    return {
        "tenant_id": str(tenant.id),
        "max_users": tenant.settings.max_users,
        "max_storage_mb": tenant.settings.max_storage_mb,
        "rate_limit": tenant.settings.rate_limit,
        "theme": tenant.settings.theme,
        "logo_url": tenant.settings.logo_url
    }