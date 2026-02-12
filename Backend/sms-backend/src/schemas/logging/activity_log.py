from typing import Optional, Dict, Any, List
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel
from src.schemas.base.base import PaginatedResponse


class UserInfo(BaseModel):
    """Basic user information for activity logs."""
    id: UUID
    first_name: str
    last_name: str
    email: str

    class Config:
        from_attributes = True


class ActivityLogBase(BaseModel):
    """Base schema for ActivityLog model."""
    user_id: Optional[UUID] = None
    action: str
    entity_type: str
    entity_id: Optional[UUID] = None
    old_values: Optional[Dict[str, Any]] = None
    new_values: Optional[Dict[str, Any]] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None


class ActivityLogCreate(ActivityLogBase):
    """Schema for creating a new activity log."""
    pass


class ActivityLogUpdate(BaseModel):
    """Schema for updating an activity log."""
    user_id: Optional[UUID] = None
    action: Optional[str] = None
    entity_type: Optional[str] = None
    entity_id: Optional[UUID] = None
    old_values: Optional[Dict[str, Any]] = None
    new_values: Optional[Dict[str, Any]] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None


class ActivityLogInDB(ActivityLogBase):
    """Schema for ActivityLog model in database."""
    id: UUID
    tenant_id: UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ActivityLog(ActivityLogInDB):
    """Schema for ActivityLog model response."""
    user: Optional[UserInfo] = None


class ActivityLogPaginated(PaginatedResponse[ActivityLog]):
    """Schema for paginated activity log response."""
    pass

