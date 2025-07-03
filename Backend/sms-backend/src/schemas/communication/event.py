from datetime import datetime
from typing import Optional, Literal
from uuid import UUID
from pydantic import BaseModel

from src.schemas.base.base import TimestampSchema, TenantSchema


class EventBase(BaseModel):
    """Base schema for Event model."""
    title: str
    description: Optional[str] = None
    event_type: Literal["academic", "sports", "cultural", "holiday", "exam", "meeting", "other"]
    organizer_id: UUID
    location: Optional[str] = None
    start_datetime: datetime
    end_datetime: datetime
    is_all_day: bool = False
    is_recurring: bool = False
    recurrence_pattern: Optional[str] = None
    is_active: bool = True


class EventCreate(EventBase):
    """Schema for creating a new event."""
    pass


class EventUpdate(BaseModel):
    """Schema for updating an event."""
    title: Optional[str] = None
    description: Optional[str] = None
    event_type: Optional[Literal["academic", "sports", "cultural", "holiday", "exam", "meeting", "other"]] = None
    organizer_id: Optional[UUID] = None
    location: Optional[str] = None
    start_datetime: Optional[datetime] = None
    end_datetime: Optional[datetime] = None
    is_all_day: Optional[bool] = None
    is_recurring: Optional[bool] = None
    recurrence_pattern: Optional[str] = None
    is_active: Optional[bool] = None


class EventInDB(EventBase, TenantSchema):
    """Schema for Event model in database."""
    class Config:
        from_attributes = True


class Event(EventInDB):
    """Schema for Event model response."""
    pass


class EventWithDetails(Event):
    """Schema for Event with additional details."""
    organizer_name: str

