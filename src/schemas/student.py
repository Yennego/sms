from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel, ConfigDict

from src.schemas.base import BaseSchema


class StudentBase(BaseSchema):
    """Base schema for Student model."""
    first_name: str
    last_name: str
    email: str
    phone: str
    grade_level: str
    is_active: bool = True


class StudentCreate(StudentBase):
    """Schema for creating a new student."""
    pass


class StudentUpdate(BaseSchema):
    """Schema for updating a student."""
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    grade_level: Optional[str] = None
    is_active: Optional[bool] = None


class StudentInDBBase(StudentBase):
    """Base schema for Student in DB."""
    id: UUID


class Student(StudentInDBBase):
    """Schema for Student response."""
    pass


class StudentWithClasses(Student):
    """Schema for Student with classes."""
    classes: List[str] = []


class StudentList(BaseSchema):
    """Schema for list of students."""
    students: List[Student]
    total: int