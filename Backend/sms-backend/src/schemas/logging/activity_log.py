from typing import Optional, Dict, Any
from uuid import UUID
from datetime import date
from pydantic import BaseModel


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
    created_at: date
    updated_at: date

    class Config:
        from_attributes = True


class ActivityLog(ActivityLogInDB):
    """Schema for ActivityLog model response."""
    pass

