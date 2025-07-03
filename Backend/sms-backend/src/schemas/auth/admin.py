from typing import Optional
from uuid import UUID
from pydantic import BaseModel

from src.schemas.auth.user import UserBase, UserCreate, UserUpdate, User


class AdminBase(UserBase):
    """Base schema for Admin model."""
    department: Optional[str] = None
    admin_level: Optional[str] = None


class AdminCreate(UserCreate):
    """Schema for creating a new admin."""
    department: Optional[str] = None
    admin_level: Optional[str] = None


class AdminUpdate(UserUpdate):
    """Schema for updating an admin."""
    department: Optional[str] = None
    admin_level: Optional[str] = None


class Admin(User):
    """Schema for Admin model response."""
    department: Optional[str] = None
    admin_level: Optional[str] = None

    class Config:
        from_attributes = True

