from typing import Optional, List
from datetime import date
from uuid import UUID
from pydantic import BaseModel, Field, validator, EmailStr

from src.schemas.base import BaseSchema, TenantSchema, TimestampSchema


class StudentBase(BaseSchema):
    """Base schema for Student model."""
    first_name: str
    last_name: str
    date_of_birth: Optional[date] = None
    enrollment_date: Optional[date] = None
    grade_level: Optional[str] = None
    student_id: str
    parent_email: Optional[str] = None
    parent_phone: Optional[str] = None
    address: Optional[str] = None
    
    @validator('parent_email')
    def validate_email(cls, v):
        """Validate email format if provided."""
        if v is not None and v.strip():
            # Simple email validation
            if '@' not in v:
                raise ValueError('Invalid email format')
        return v


class StudentCreate(StudentBase):
    """Schema for creating a new student."""
    pass


class StudentUpdate(BaseSchema):
    """Schema for updating a student."""
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    date_of_birth: Optional[date] = None
    enrollment_date: Optional[date] = None
    grade_level: Optional[str] = None
    student_id: Optional[str] = None
    parent_email: Optional[str] = None
    parent_phone: Optional[str] = None
    address: Optional[str] = None


class StudentInDBBase(StudentBase, TenantSchema, TimestampSchema):
    """Base schema for Student in DB."""
    id: UUID


class Student(StudentInDBBase):
    """Schema for Student response."""
    pass


class StudentList(BaseSchema):
    """Schema for list of students."""
    students: List[Student]
    total: int