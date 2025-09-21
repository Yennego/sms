from datetime import date
import fnmatch
from typing import Optional, Dict, Any
from uuid import UUID
from pydantic import BaseModel

from src.schemas.base.base import TimestampSchema, TenantSchema


class TimetableBase(BaseModel):
    """Base schema for Timetable model."""
    name: str
    # Replace: academic_year: str
    # With: academic_year_id: UUID
    academic_year_id: UUID
    grade_id: UUID
    section_id: Optional[UUID] = None
    is_active: bool = True
    effective_from: date
    effective_until: Optional[date] = None
    description: Optional[str] = None
    timetable_data: Dict[str, Any]


class TimetableCreate(TimetableBase):
    """Schema for creating a new timetable."""
    effective_from: date = date.today()


class TimetableUpdate(BaseModel):
    """Schema for updating a timetable."""
    name: Optional[str] = None
    # Replace: academic_year: Optional[str] = None
    # With: academic_year_id: Optional[UUID] = None
    academic_year_id: Optional[UUID] = None
    grade_id: Optional[UUID] = None
    section_id: Optional[UUID] = None
    is_active: Optional[bool] = None
    effective_from: Optional[date] = None
    effective_until: Optional[date] = None
    description: Optional[str] = None
    timetable_data: Optional[Dict[str, Any]] = None


class TimetableInDB(TimetableBase, TenantSchema):
    """Schema for Timetable model in database."""
    class Config:
        from_attributes = True


class Timetable(TimetableInDB):
    """Schema for Timetable model response."""
    pass


class TimetableWithDetails(Timetable):
    """Schema for Timetable with additional details."""
    grade_name: str
    section_name: Optional[str] = None
    academic_year_name: str  # Add this for display purposes
    # teacher_name: Optional[str] = None