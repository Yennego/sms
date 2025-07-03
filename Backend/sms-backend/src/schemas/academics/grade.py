from datetime import date
from typing import Optional, List, Dict, Any
from uuid import UUID
from pydantic import BaseModel, Field
from enum import Enum


class GradeType(str, Enum):
    """Enum for grade types."""
    ASSIGNMENT = "assignment"
    QUIZ = "quiz"
    TEST = "test"
    EXAM = "exam"
    PROJECT = "project"
    PARTICIPATION = "participation"
    OTHER = "other"



class GradeBase(BaseModel):
    """Base schema for Grade model."""
    student_id: UUID
    enrollment_id: UUID
    subject_id: UUID
    assessment_type: GradeType
    assessment_id: Optional[UUID] = None
    assessment_name: str
    assessment_date: date
    score: float
    max_score: float
    percentage: float = Field(..., ge=0, le=100)
    letter_grade: Optional[str] = None
    comments: Optional[str] = None
    graded_by: UUID


class GradeCreate(GradeBase):
    """Schema for creating a new grade."""
    graded_date: date = date.today()


class GradeUpdate(BaseModel):
    """Schema for updating a grade."""
    score: Optional[float] = None
    max_score: Optional[float] = None
    percentage: Optional[float] = Field(None, ge=0, le=100)
    letter_grade: Optional[str] = None
    comments: Optional[str] = None
    graded_by: Optional[UUID] = None
    graded_date: Optional[date] = None


class GradeInDB(GradeBase):
    """Schema for Grade model in database."""
    id: UUID
    tenant_id: UUID
    graded_date: date
    created_at: date
    updated_at: date

    class Config:
        from_attributes = True


class Grade(GradeInDB):
    """Schema for Grade model response."""
    pass


class GradeWithDetails(Grade):
    """Schema for Grade with additional details."""
    student_name: str
    subject_name: str
    teacher_name: str