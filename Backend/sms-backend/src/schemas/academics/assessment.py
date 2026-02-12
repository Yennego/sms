from typing import Optional
from uuid import UUID
from datetime import date
from pydantic import BaseModel
from src.db.models.academics.grade import GradeType

class AssessmentBase(BaseModel):
    title: str
    description: Optional[str] = None
    type: GradeType = GradeType.QUIZ
    subject_id: UUID
    teacher_id: UUID
    academic_year_id: UUID
    grade_id: UUID
    section_id: Optional[UUID] = None
    class_id: Optional[UUID] = None
    grading_category_id: Optional[UUID] = None
    assessment_date: date = date.today()
    max_score: float = 100.0
    is_published: bool = False

class AssessmentCreate(AssessmentBase):
    pass

class AssessmentUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    type: Optional[GradeType] = None
    due_date: Optional[date] = None # Added for compatibility with assignment logic if needed
    max_score: Optional[float] = None
    is_published: Optional[bool] = None

class Assessment(AssessmentBase):
    id: UUID
    tenant_id: UUID

    class Config:
        from_attributes = True
