from datetime import time
from typing import Optional, Literal
from uuid import UUID
from pydantic import BaseModel

from src.schemas.base.base import TimestampSchema, TenantSchema


class ScheduleBase(BaseModel):
    """Base schema for Schedule model."""
    day_of_week: Literal["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"]
    start_time: time
    end_time: time
    period: Optional[str] = None
    class_id: UUID


class ScheduleCreate(ScheduleBase):
    """Schema for creating a new schedule."""
    pass


class ScheduleUpdate(BaseModel):
    """Schema for updating a schedule."""
    day_of_week: Optional[Literal["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"]] = None
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    period: Optional[str] = None
    class_id: Optional[UUID] = None


class ScheduleInDB(ScheduleBase, TenantSchema):
    """Schema for Schedule model in database."""
    class Config:
        from_attributes = True


class Schedule(ScheduleInDB):
    """Schema for Schedule model response."""
    pass


class ScheduleWithDetails(Schedule):
    """Schema for Schedule with additional details."""
    class_name: str