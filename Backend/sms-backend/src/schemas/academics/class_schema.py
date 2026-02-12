from datetime import date
from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel, ConfigDict

from src.schemas.base.base import TimestampSchema, TenantSchema


class BulkDeleteRequest(BaseModel):
    ids: List[UUID]


class BulkReassignRequest(BaseModel):
    ids: List[UUID]
    new_teacher_id: UUID
    new_academic_year_id: Optional[UUID] = None

class ClassBase(BaseModel):
    """Base schema for Class model."""
    name: Optional[str] = None
    academic_year_id: UUID
    description: Optional[str] = None
    room: Optional[str] = None
    capacity: int = 30
    is_active: bool = True
    start_date: date
    end_date: Optional[date] = None
    grade_id: UUID
    section_id: UUID
    class_teacher_id: Optional[UUID] = None


class ClassCreate(ClassBase):
    """Schema for creating a new class."""
    start_date: date = date.today()


class ClassUpdate(BaseModel):
    """Schema for updating a class."""
    name: Optional[str] = None
    academic_year_id: Optional[UUID] = None
    description: Optional[str] = None
    room: Optional[str] = None
    capacity: Optional[int] = None
    is_active: Optional[bool] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    grade_id: Optional[UUID] = None
    section_id: Optional[UUID] = None
    class_teacher_id: Optional[UUID] = None


class ClassInDB(ClassBase, TenantSchema):
    """Schema for Class model in database."""
    model_config = ConfigDict(from_attributes=True)


from src.schemas.academics.class_subject_schema import ClassSubject

class Class(ClassInDB):
    """Schema for Class model response."""
    pass


class ClassWithDetails(Class):
    """Schema for Class with additional details."""
    grade_name: str
    section_name: str
    academic_year_name: Optional[str] = None
    class_teacher_name: Optional[str] = None
    subjects: List[ClassSubject] = []
    class_name: Optional[str] = None