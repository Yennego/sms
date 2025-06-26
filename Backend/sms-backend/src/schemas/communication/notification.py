from typing import Optional, Dict, Any
from uuid import UUID
from datetime import date
from pydantic import BaseModel


class NotificationBase(BaseModel):
    """Base schema for Notification model."""
    user_id: UUID
    title: str
    message: str
    notification_type: str  # email, sms, in-app
    metadata: Optional[Dict[str, Any]] = None


class NotificationCreate(NotificationBase):
    """Schema for creating a new notification."""
    status: str = "pending"  # pending, sent, delivered, read, failed
    is_read: bool = False


class NotificationUpdate(BaseModel):
    """Schema for updating a notification."""
    title: Optional[str] = None
    message: Optional[str] = None
    status: Optional[str] = None
    is_read: Optional[bool] = None
    metadata: Optional[Dict[str, Any]] = None


class NotificationInDB(NotificationBase):
    """Schema for Notification model in database."""
    id: UUID
    tenant_id: UUID
    status: str
    is_read: bool
    created_at: date
    updated_at: date

    class Config:
        from_attributes = True


class Notification(NotificationInDB):
    """Schema for Notification model response."""
    pass