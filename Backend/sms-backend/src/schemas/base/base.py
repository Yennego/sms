from datetime import datetime
from typing import Optional, Dict, Any
from uuid import UUID
from pydantic import BaseModel, Field, EmailStr


class BaseSchema(BaseModel):
    """Base schema with common fields for all models."""
    id: Optional[UUID] = None
    
    class Config:
        from_attributes = True


class TimestampSchema(BaseSchema):
    """Schema with timestamp fields."""
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class TenantSchema(TimestampSchema):
    """Schema for tenant-aware models."""
    tenant_id: UUID

