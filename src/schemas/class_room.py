from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel, ConfigDict

from src.schemas.base import BaseSchema

class ClassBase(BaseSchema):
    """Base schema for Class model."""
    name: str
    grade_level: str
    subject: str
    room_number: str
    max_capacity: int
    is_active: bool = True

class ClassCreate(ClassBase):
    """Schema for creating a new class."""
    pass

class ClassUpdate(BaseSchema):
    """Schema for updating a class."""
    name: Optional[str] = None
    grade_level: Optional[str] = None
    subject: Optional[str] = None
    room_number: Optional[str] = None
    max_capacity: Optional[int] = None
    is_active: Optional[bool] = None

class ClassInDBBase(ClassBase):
    """Base schema for Class in DB."""
    id: UUID

class Class(ClassInDBBase):
    """Schema for Class response."""
    pass

class ClassWithStudents(Class):
    """Schema for Class with students."""
    students: List[str] = []

class ClassWithTeacher(Class):
    """Schema for Class with teacher."""
    teacher: str