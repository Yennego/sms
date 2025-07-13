from datetime import datetime
from typing import Optional, Dict, Any, List, TypeVar, Generic
from uuid import UUID
from pydantic import BaseModel, Field, EmailStr

T = TypeVar('T')

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


class PaginatedResponse(BaseModel, Generic[T]):
    """Generic paginated response schema."""
    items: List[T]
    total: int
    skip: int
    limit: int
    has_next: bool
    has_prev: bool
    
    class Config:
        from_attributes = True

