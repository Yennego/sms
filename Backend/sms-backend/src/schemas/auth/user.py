from datetime import datetime
from typing import Optional, List, Dict, Any
from uuid import UUID
from pydantic import BaseModel, Field, EmailStr, field_validator

from src.core.security.password_policy import check_password
from src.db.models.auth.username import username_problem

from src.schemas.base.base import TenantSchema
from src.schemas.auth.user_role import UserRole


def _clean_username(v: Optional[str]) -> Optional[str]:
    """Lower case; blank means "generate one from the name"."""
    if v is None:
        return None
    v = v.strip().lower()
    if not v:
        return None
    problem = username_problem(v)
    if problem:
        raise ValueError(f"Username {problem}")
    return v


class UserBase(BaseModel):
    """Base schema for User model.

    People sign in with their email or their username. Email is optional (many families have
    none); every account has a username, generated from the name when none is given.
    """
    email: Optional[EmailStr] = None
    username: Optional[str] = None
    first_name: str
    last_name: str
    is_active: bool = True
    is_first_login: bool = True  
    phone_number: Optional[str] = None
    profile_picture: Optional[str] = None
    preferences: Optional[Dict[str, Any]] = None
    address: Optional[str] = None


class UserCreate(UserBase):
    """Schema for creating a new user."""
    password: Optional[str] = None 
    # tenant_id: UUID

    @field_validator("username")
    @classmethod
    def username_rules(cls, v: Optional[str]) -> Optional[str]:
        return _clean_username(v)

    @field_validator("password")
    @classmethod
    def password_meets_policy(cls, v: Optional[str]) -> Optional[str]:
        # Empty means "generate one"; anything typed must meet the policy
        return check_password(v) if v else v


class UserCreateCrossTenant(UserCreate):
    """Schema for creating a user across tenants (super-admin only)."""
    role_id: Optional[UUID] = None  # Optional role assignment
    tenant_id: UUID  # Required tenant ID for cross-tenant creation


class UserUpdate(BaseModel):
    """Schema for updating a user."""
    email: Optional[EmailStr] = None
    username: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    is_active: Optional[bool] = None
    phone_number: Optional[str] = None
    profile_picture: Optional[str] = None
    preferences: Optional[Dict[str, Any]] = None
    password: Optional[str] = None
    address: Optional[str] = None

    @field_validator("username")
    @classmethod
    def username_rules(cls, v: Optional[str]) -> Optional[str]:
        return _clean_username(v)


class UserInDBBase(UserBase, TenantSchema):
    """Schema for User model in database."""
    id: UUID
    last_login: Optional[datetime] = None
    type: str
    tenant_name: Optional[str] = None
    tenant_domain: Optional[str] = None

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

class UserWithRole(UserWithRoles):
    """Schema for User model response with role field."""
    role: Optional[str] = None
    # Everything the user's roles allow in their school (with the school's role adjustments)
    permissions: List[str] = []