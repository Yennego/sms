from datetime import date
from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel


class EnrollmentBase(BaseModel):
    """Base schema for Enrollment model."""
    student_id: UUID
    academic_year: str
    grade: str
    section: str
    enrollment_date: Optional[date] = None
    roll_number: Optional[int] = None
    status: str = "active"
    is_active: bool = True
    comments: Optional[str] = None


class EnrollmentCreate(EnrollmentBase):
    """Schema for creating a new enrollment."""
    enrollment_date: date = date.today()


class EnrollmentUpdate(BaseModel):
    """Schema for updating an enrollment."""
    academic_year: Optional[str] = None
    grade: Optional[str] = None
    section: Optional[str] = None
    roll_number: Optional[int] = None
    status: Optional[str] = None
    is_active: Optional[bool] = None
    withdrawal_date: Optional[date] = None
    withdrawal_reason: Optional[str] = None
    comments: Optional[str] = None


class EnrollmentInDB(EnrollmentBase):
    """Schema for Enrollment model in database."""
    id: UUID
    tenant_id: UUID
    withdrawal_date: Optional[date] = None
    withdrawal_reason: Optional[str] = None
    created_at: date
    updated_at: date

    class Config:
        from_attributes = True


class Enrollment(EnrollmentInDB):
    """Schema for Enrollment model response."""
    pass


class EnrollmentWithStudent(Enrollment):
    """Schema for Enrollment with Student details."""
    student_name: str
    student_email: str
    student_admission_number: str


class BulkEnrollmentCreate(BaseModel):
    """Schema for bulk enrollment creation."""
    student_ids: List[UUID]
    academic_year: str
    grade: str
    section: str
    enrollment_date: Optional[date] = None
    semester: Optional[str] = None
    status: str = "active"
    is_active: bool = True