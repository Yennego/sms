from typing import Optional, Dict, Any, List
from uuid import UUID
from pydantic import BaseModel, Field, field_validator
from src.schemas.base.base import BaseSchema, TimestampSchema


class TenantSettingsBase(BaseModel):
    """Base schema for TenantSettings model."""
    tenant_id: UUID
    theme: str = "light"
    settings: Dict[str, Any] = {}
    is_active: bool = True
    
    @field_validator('theme')
    def validate_theme(cls, v):
        valid_themes = ["light", "dark", "system"]
        if v not in valid_themes:
            raise ValueError(f"theme must be one of: {', '.join(valid_themes)}")
        return v


class TenantSettingsCreate(TenantSettingsBase):
    """Schema for creating new tenant settings."""
    pass


class TenantSettingsUpdate(BaseModel):
    """Schema for updating tenant settings."""
    theme: Optional[str] = None
    settings: Optional[Dict[str, Any]] = None
    is_active: Optional[bool] = None
    
    @field_validator('theme')
    def validate_theme(cls, v):
        if v is not None:
            valid_themes = ["light", "dark", "system"]
            if v not in valid_themes:
                raise ValueError(f"theme must be one of: {', '.join(valid_themes)}")
        return v


class TenantSettings(TenantSettingsBase, TimestampSchema):
    """Schema for TenantSettings model response."""
    id: UUID

    class Config:
        from_attributes = True