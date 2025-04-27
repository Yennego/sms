from typing import Optional, List
from datetime import date
from uuid import UUID
from pydantic import BaseModel, Field, validator, EmailStr

from src.schemas.base import BaseSchema, TenantSchema, TimestampSchema


class TeacherBase(BaseSchema):
    """Base schema for Teacher model."""
    first_name: str
    last_name: str
    email: str
    phone: Optional[str] = None
    hire_date: Optional[date] = None
    subject_specialty: Optional[str] = None
    teacher_id: str
    
    @validator('email')
    def validate_email(cls, v):
        """Validate email format."""
        if '@' not in v:
            raise ValueError('Invalid email format')
        return v


class TeacherCreate(TeacherBase):
    """Schema for creating a new teacher."""
    pass


class TeacherUpdate(BaseSchema):
    """Schema for updating a teacher."""
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    hire_date: Optional[date] = None
    subject_specialty: Optional[str] = None
    teacher_id: Optional[str] = None


class TeacherInDBBase(TeacherBase, TenantSchema, TimestampSchema):
    """Base schema for Teacher in DB."""
    id: UUID


class Teacher(TeacherInDBBase):
    """Schema for Teacher response."""
    pass


class TeacherList(BaseSchema):
    """Schema for list of teachers."""
    teachers: List[Teacher]
    total: int