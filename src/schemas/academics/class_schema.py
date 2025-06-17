from datetime import date
from typing import Optional
from uuid import UUID
from pydantic import BaseModel

from src.schemas.base.base import TimestampSchema, TenantSchema


class ClassBase(BaseModel):
    """Base schema for Class model."""
    name: Optional[str] = None
    academic_year: str
    description: Optional[str] = None
    room: Optional[str] = None
    is_active: bool = True
    start_date: date
    end_date: Optional[date] = None
    grade_id: UUID
    section_id: UUID
    subject_id: UUID
    teacher_id: UUID


class ClassCreate(ClassBase):
    """Schema for creating a new class."""
    start_date: date = date.today()


class ClassUpdate(BaseModel):
    """Schema for updating a class."""
    name: Optional[str] = None
    academic_year: Optional[str] = None
    description: Optional[str] = None
    room: Optional[str] = None
    is_active: Optional[bool] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    grade_id: Optional[UUID] = None
    section_id: Optional[UUID] = None
    subject_id: Optional[UUID] = None
    teacher_id: Optional[UUID] = None


class ClassInDB(ClassBase, TenantSchema):
    """Schema for Class model in database."""
    class Config:
        from_attributes = True


class Class(ClassInDB):
    """Schema for Class model response."""
    pass


class ClassWithDetails(Class):
    """Schema for Class with additional details."""
    grade_name: str
    section_name: str
    subject_name: str
    teacher_name: str