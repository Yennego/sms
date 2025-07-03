from datetime import date
from typing import Optional, Dict, Any
from uuid import UUID
from pydantic import BaseModel, Field


class AssignmentBase(BaseModel):
    """Base schema for Assignment model."""
    title: str
    description: Optional[str] = None
    subject_id: UUID
    teacher_id: UUID
    grade_id: UUID
    section_id: Optional[UUID] = None
    assigned_date: Optional[date] = None
    due_date: date
    max_score: float
    weight: float = 1.0
    is_published: bool = False
    submission_type: str = "online"
    attachment_url: Optional[str] = None
    rubric: Optional[Dict[str, Any]] = None


class AssignmentCreate(AssignmentBase):
    """Schema for creating a new assignment."""
    assigned_date: date = date.today()


class AssignmentUpdate(BaseModel):
    """Schema for updating an assignment."""
    title: Optional[str] = None
    description: Optional[str] = None
    subject_id: Optional[UUID] = None
    teacher_id: Optional[UUID] = None
    grade_id: Optional[UUID] = None
    section_id: Optional[UUID] = None
    assigned_date: Optional[date] = None
    due_date: Optional[date] = None
    max_score: Optional[float] = None
    weight: Optional[float] = None
    is_published: Optional[bool] = None
    submission_type: Optional[str] = None
    attachment_url: Optional[str] = None
    rubric: Optional[Dict[str, Any]] = None


class AssignmentInDB(AssignmentBase):
    """Schema for Assignment model in database."""
    id: UUID
    tenant_id: UUID
    created_at: date
    updated_at: date

    class Config:
        from_attributes = True


class Assignment(AssignmentInDB):
    """Schema for Assignment model response."""
    pass


class AssignmentWithDetails(Assignment):
    """Schema for Assignment with additional details."""
    subject_name: str
    teacher_name: str
    grade_name: str
    section_name: Optional[str] = None
