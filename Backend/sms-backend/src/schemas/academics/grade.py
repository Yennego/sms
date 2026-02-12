# Module imports and GradeInDB class
from datetime import date, datetime
from typing import Optional, List, Dict, Any
from uuid import UUID
from pydantic import BaseModel, Field, ConfigDict
from enum import Enum

class GradeType(str, Enum):
    """Enum for grade types."""
    ASSIGNMENT = "ASSIGNMENT"
    QUIZ = "QUIZ"
    TEST = "TEST"
    EXAM = "EXAM"
    PROJECT = "PROJECT"
    PARTICIPATION = "PARTICIPATION"
    OTHER = "OTHER"


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
    period_id: Optional[UUID] = None
    semester_id: Optional[UUID] = None
    period_number: Optional[int] = None
    semester: Optional[int] = None
    is_published: bool = False
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
    period_id: Optional[UUID] = None
    semester_id: Optional[UUID] = None
    period_number: Optional[int] = None
    semester: Optional[int] = None
    is_published: Optional[bool] = None
    graded_by: Optional[UUID] = None
    graded_date: Optional[date] = None


class GradeInDB(GradeBase):
    """Schema for Grade model in database."""
    id: UUID
    tenant_id: UUID
    graded_date: date
    created_at: datetime
    updated_at: datetime

    # Pydantic v2: enable ORM serialization
    model_config = ConfigDict(from_attributes=True)

class Grade(GradeInDB):
    """Schema for Grade model response."""
    student_name: Optional[str] = None
    subject_name: Optional[str] = None

class GradeWithDetails(Grade):
    """Schema for Grade with additional details."""
    student_name: str
    subject_name: str
    teacher_name: str

class SubjectGradeSummary(BaseModel):
    """Summary of grades for a specific subject."""
    subject_id: UUID
    subject_name: str
    assessment_grades: List[Dict[str, Any]]
    period_grades: Dict[str, Optional[float]] = Field(default_factory=lambda: {
        "P1": None, "P2": None, "P3": None, "P4": None, "P5": None, "P6": None
    })
    semester_grades: Dict[str, Optional[float]] = Field(default_factory=lambda: {"S1": None, "S2": None})
    average_score: float
    percentage: float
    letter_grade: str

class ReportCardResponse(BaseModel):
    """Schema for a student report card."""
    student_id: UUID
    student_name: str
    admission_number: str
    academic_year: str
    grade: str
    section: str
    subjects: List[SubjectGradeSummary]
    attendance_percentage: float = 0.0
    period_attendance: Dict[str, Dict[str, int]] = Field(default_factory=dict)
    gpa: float
    generated_date: str
    
    # Dynamic visibility
    active_columns: List[str] = Field(default_factory=list) # ["P1", "P2", "P3", "S1", ...]
    
    # Remarks
    remarks: Dict[str, str] = Field(default_factory=dict) # {"P1": "...", "S1": "..."}
    
    # Signatures
    signatures: Dict[str, Optional[str]] = Field(default_factory=lambda: {
        "class_teacher": None,
        "academic_dean": None,
        "principal": None
    })
    
    # Signatory names
    signatory_names: Dict[str, str] = Field(default_factory=lambda: {
        "class_teacher": "Class Teacher",
        "academic_dean": "Academic Dean",
        "principal": "Principal"
    })