from typing import Optional
from uuid import UUID
from pydantic import BaseModel, EmailStr, ConfigDict

from src.schemas.base import BaseSchema

class UserBase(BaseSchema):
    """Base schema for User model."""
    email: EmailStr
    is_active: bool = True
    is_superuser: bool = False
    full_name: Optional[str] = None

class UserCreate(UserBase):
    """Schema for creating a new user."""
    password: str

class UserUpdate(BaseSchema):
    """Schema for updating a user."""
    email: Optional[EmailStr] = None
    password: Optional[str] = None
    is_active: Optional[bool] = None
    is_superuser: Optional[bool] = None
    full_name: Optional[str] = None

class UserInDBBase(UserBase):
    """Base schema for User in DB."""
    id: UUID
    tenant_id: UUID

class User(UserInDBBase):
    """Schema for User response."""
    pass

class UserInDB(UserInDBBase):
    hashed_password: str