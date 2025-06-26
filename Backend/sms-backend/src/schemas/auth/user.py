from datetime import datetime
from typing import Optional, List, Dict, Any
from uuid import UUID
from pydantic import BaseModel, Field, EmailStr

from src.schemas.base.base import TenantSchema
from src.schemas.auth.user_role import UserRole


class UserBase(BaseModel):
    """Base schema for User model."""
    email: EmailStr
    first_name: str
    last_name: str
    is_active: bool = True
    is_first_login: bool = True  
    phone_number: Optional[str] = None
    profile_picture: Optional[str] = None
    preferences: Optional[Dict[str, Any]] = None


class UserCreate(UserBase):
    """Schema for creating a new user."""
    password: str
    tenant_id: UUID


class UserUpdate(BaseModel):
    """Schema for updating a user."""
    email: Optional[EmailStr] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    is_active: Optional[bool] = None
    phone_number: Optional[str] = None
    profile_picture: Optional[str] = None
    preferences: Optional[Dict[str, Any]] = None
    password: Optional[str] = None


class UserInDBBase(UserBase, TenantSchema):
    """Schema for User model in database."""
    id: UUID
    last_login: Optional[datetime] = None
    type: str

    class Config:
        from_attributes = True


class User(UserInDBBase):
    """Schema for User model response."""
    pass


class UserInDB(UserInDBBase):
    """Schema for User model with password hash."""
    password_hash: str


class UserWithRoles(User):
    """Schema for User model response with roles and permissions."""
    roles: List[UserRole] = []


# Add this class to the file
class UserCreateResponse(User):
    generated_password: Optional[str] = None