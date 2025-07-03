from shelve import DbfilenameShelf
from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel

from src.schemas.base.base import BaseSchema, TimestampSchema


class PermissionBase(BaseModel):
    """Base schema for Permission model."""
    name: str
    description: Optional[str] = None


class PermissionCreate(PermissionBase):
    """Schema for creating a new permission."""
    pass


class PermissionUpdate(BaseModel):
    """Schema for updating a permission."""
    name: Optional[str] = None
    description: Optional[str] = None


class Permission(PermissionBase, TimestampSchema):
    """Schema for Permission model response."""
    id: UUID

    class Config:
        from_attributes = True