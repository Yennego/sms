from typing import Optional, List
from uuid import UUID
from datetime import date
from pydantic import BaseModel, ConfigDict

from src.schemas.base import BaseSchema

class EnrollmentBase(BaseSchema):
    """Base schema for Enrollment model."""
    student_id: UUID
    class_id: UUID
    enrollment_date: date
    status: str = "active"

class EnrollmentCreate(EnrollmentBase):
    """Schema for creating a new enrollment."""
    pass

class EnrollmentUpdate(BaseSchema):
    """Schema for updating an enrollment."""
    enrollment_date: Optional[date] = None
    status: Optional[str] = None

class EnrollmentInDBBase(EnrollmentBase):
    """Base schema for Enrollment in DB."""
    id: UUID
    tenant_id: UUID

    class Config:
        from_attributes = True

class Enrollment(EnrollmentInDBBase):
    """Schema for Enrollment response."""
    pass

class EnrollmentList(BaseModel):
    enrollments: List[Enrollment]
    total: int 