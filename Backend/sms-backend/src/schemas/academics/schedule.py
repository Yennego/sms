from datetime import time
from typing import Optional, Literal
from uuid import UUID
from pydantic import BaseModel, ConfigDict

from src.schemas.base.base import TimestampSchema, TenantSchema


class ScheduleBase(BaseModel):
    """Base schema for Schedule model."""
    day_of_week: Literal["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
    start_time: time
    end_time: time
    period: Optional[int] = None
    class_id: UUID

class ScheduleUpdate(BaseModel):
    """Schema for updating a schedule."""
    day_of_week: Optional[Literal["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]] = None
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    period: Optional[int] = None
    class_id: Optional[UUID] = None


class ScheduleCreate(ScheduleBase):
    """Schema for creating a new schedule."""
    pass


class ScheduleInDB(ScheduleBase, TenantSchema):
    """Schema for Schedule model in database."""
    model_config = ConfigDict(from_attributes=True)


class Schedule(ScheduleInDB):
    """Schema for Schedule model response."""
    pass


class ScheduleWithDetails(Schedule):
    """Schema for Schedule with additional details."""
    class_name: str

