from typing import Optional, Dict, Any
from datetime import datetime
from uuid import UUID
from typing import Optional
from pydantic import BaseModel, Field, field_validator

from src.schemas.base.base import BaseSchema, TimestampSchema
from src.schemas.tenant.tenant_settings import TenantSettings


class TenantBase(BaseModel):
    """Base schema for Tenant model."""
    name: str
    code: str
    is_active: bool = True
    # created_at: Optional[datetime]
    # updated_at: Optional[datetime]
    domain: Optional[str] = None
    subdomain: Optional[str] = None
    logo: Optional[str] = None
    primary_color: Optional[str] = None  
    secondary_color: Optional[str] = None  
    
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


class AdminUserData(BaseModel):
    """Schema for admin user data when creating a tenant"""
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    email: str = Field(..., max_length=255)
    password: Optional[str] = Field(None, min_length=8)  # If None, password will be generated


class TenantCreateWithAdmin(TenantBase):
    """Schema for creating a tenant with admin user in a single atomic operation"""
    admin_user: AdminUserData


class TenantUpdate(BaseModel):
    """Schema for updating a tenant."""
    name: Optional[str] = None
    code: Optional[str] = None
    is_active: Optional[bool] = None
    # updated_at: Optional[datetime] = None
    domain: Optional[str] = None
    subdomain: Optional[str] = None
    logo: Optional[str] = None
    primary_color: Optional[str] = None  
    secondary_color: Optional[str] = None  
    
    @field_validator('code')
    def code_to_uppercase(cls, v):
        return v.upper() if v else v
    
    @field_validator('name')
    def validate_name_length(cls, v):
        if v and len(v) < 3:
            raise ValueError("tenant name must be at least 3 characters long")
        return v


class TenantCreateResponse(BaseModel):
    """Response schema for tenant creation with admin user"""
    tenant: 'Tenant'
    admin_user: dict  # Contains user info and generated password if applicable
    
    class Config:
        from_attributes = True


class Tenant(TenantBase, TimestampSchema):
    """Schema for Tenant model response."""
    id: UUID
    
    class Config:
        from_attributes = True
        populate_by_name = True


        