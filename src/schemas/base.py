from typing import Optional, Generic, TypeVar, List
from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, Field, validator, ConfigDict

T = TypeVar('T')

class BaseSchema(BaseModel):
    """Base schema for all models."""
    model_config = ConfigDict(from_attributes=True)


class TenantSchema(BaseSchema):
    """Base schema for tenant-isolated models."""
    tenant_id: UUID


class TimestampSchema(BaseSchema):
    """Schema mixin for timestamps."""
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class PaginationParams(BaseSchema):
    """Common pagination parameters."""
    skip: int = Field(0, ge=0)
    limit: int = Field(100, ge=1, le=1000)


class PaginatedResponse(BaseSchema, Generic[T]):
    """Generic paginated response."""
    items: List[T]
    total: int
    skip: int
    limit: int