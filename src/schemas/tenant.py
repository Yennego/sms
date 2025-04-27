from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel, Field, validator, EmailStr, ConfigDict

from src.schemas.base import BaseSchema, TimestampSchema


# Tenant Schemas
class TenantBase(BaseSchema):
    """Base schema for Tenant model."""
    name: str
    slug: str
    domain: Optional[str] = None
    is_active: bool = True
    settings: Optional[dict] = None


class TenantCreate(TenantBase):
    """Schema for creating a new tenant."""
    pass


class TenantUpdate(BaseSchema):
    """Schema for updating a tenant."""
    name: Optional[str] = None
    slug: Optional[str] = None
    is_active: Optional[bool] = None


class TenantInDBBase(TenantBase):
    """Base schema for Tenant in DB."""
    id: UUID

    class Config:
        from_attributes = True


class Tenant(TenantInDBBase):
    """Schema for Tenant response."""
    pass


class TenantInDB(TenantInDBBase):
    pass


# Tenant Settings Schemas
class TenantSettingsBase(BaseSchema):
    """Base schema for TenantSettings model."""
    max_users: int = 10
    max_storage_mb: int = 1024
    rate_limit: int = 60
    theme: str = "default"
    logo_url: Optional[str] = None


class TenantSettingsCreate(TenantSettingsBase):
    """Schema for creating tenant settings."""
    tenant_id: UUID


class TenantSettingsUpdate(BaseSchema):
    """Schema for updating tenant settings."""
    max_users: Optional[int] = None
    max_storage_mb: Optional[int] = None
    rate_limit: Optional[int] = None
    theme: Optional[str] = None
    logo_url: Optional[str] = None


class TenantSettingsInDBBase(TenantSettingsBase, TimestampSchema):
    """Base schema for TenantSettings in DB."""
    id: UUID
    tenant_id: UUID


class TenantSettings(TenantSettingsInDBBase):
    """Schema for TenantSettings response."""
    pass


# Combined Tenant with Settings
class TenantWithSettings(Tenant):
    """Schema for Tenant with its settings."""
    settings: Optional[TenantSettings] = None