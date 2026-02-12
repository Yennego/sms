# Module imports and ExamInDB class
from typing import Optional, Dict, Any, List
from uuid import UUID
from datetime import date, time, datetime
from pydantic import BaseModel, Field, ConfigDict

class ExamBase(BaseModel):
    """Base schema for Exam model."""
    title: str
    description: Optional[str] = None
    subject_id: UUID
    teacher_id: UUID
    grade_id: UUID
    section_id: Optional[UUID] = None
    academic_year_id: UUID
    exam_date: date
    start_time: time
    end_time: time
    max_score: float
    weight: float = 1.0
    is_published: bool = False
    location: Optional[str] = None
    instructions: Optional[str] = None

class ExamCreate(ExamBase):
    """Schema for creating a new exam."""
    pass

class ExamUpdate(BaseModel):
    """Schema for updating an exam."""
    title: Optional[str] = None
    description: Optional[str] = None
    subject_id: Optional[UUID] = None
    teacher_id: Optional[UUID] = None
    grade_id: Optional[UUID] = None
    section_id: Optional[UUID] = None
    academic_year_id: Optional[UUID] = None
    exam_date: Optional[date] = None
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    max_score: Optional[float] = None
    weight: Optional[float] = None
    is_published: Optional[bool] = None
    location: Optional[str] = None
    instructions: Optional[str] = None

class ExamInDB(ExamBase):
    """Schema for Exam model in database."""
    id: UUID
    tenant_id: UUID
    created_at: datetime
    updated_at: datetime

    # Pydantic v2: enable ORM serialization
    model_config = ConfigDict(from_attributes=True)

class Exam(ExamInDB):
    """Schema for Exam model response."""
    pass

class ExamWithDetails(Exam):
    """Schema for Exam with additional details."""
    subject_name: str
    teacher_name: str
    grade_name: str
    section_name: Optional[str] = None

