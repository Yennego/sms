from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel

from src.schemas.base.base import BaseSchema, TimestampSchema
from src.schemas.auth.permission import Permission


class UserRoleBase(BaseModel):
    """Base schema for UserRole model."""
    name: str
    description: Optional[str] = None


class UserRoleCreate(UserRoleBase):
    """Schema for creating a new user role."""
    pass


class UserRoleUpdate(BaseModel):
    """Schema for updating a user role."""
    name: Optional[str] = None
    description: Optional[str] = None


class UserRole(UserRoleBase, TimestampSchema):
    """Schema for UserRole model response."""
    id: UUID
    permissions: List[Permission] = []

    class Config:
        from_attributes = True