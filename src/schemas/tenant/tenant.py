from typing import Optional, Dict, Any
from uuid import UUID
from pydantic import BaseModel, Field, field_validator

from src.schemas.base.base import BaseSchema, TimestampSchema
from src.schemas.tenant.tenant_settings import TenantSettings


class TenantBase(BaseModel):
    """Base schema for Tenant model."""
    name: str
    code: str
    is_active: bool = True
    
    @field_validator('code')
    def code_to_uppercase(cls, v):
        return v.upper() if v else v
    
    @field_validator('name')
    def validate_name_length(cls, v):
        if len(v) < 3:
            raise ValueError("tenant name must be at least 3 characters long")
        return v


class TenantCreate(TenantBase):
    """Schema for creating a new tenant."""
    pass


class TenantUpdate(BaseModel):
    """Schema for updating a tenant."""
    name: Optional[str] = None
    code: Optional[str] = None
    is_active: Optional[bool] = None
    
    @field_validator('code')
    def code_to_uppercase(cls, v):
        return v.upper() if v else v
    
    @field_validator('name')
    def validate_name_length(cls, v):
        if v and len(v) < 3:
            raise ValueError("tenant name must be at least 3 characters long")
        return v


class Tenant(TenantBase, TimestampSchema):
    """Schema for Tenant model response."""
    id: UUID
    settings: Optional[TenantSettings] = None

    class Config:
        from_attributes = True