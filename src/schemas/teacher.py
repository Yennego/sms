from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel, ConfigDict

from src.schemas.base import BaseSchema


class TeacherBase(BaseSchema):
    """Base schema for Teacher model."""
    first_name: str
    last_name: str
    email: str
    phone: str
    is_active: bool = True


class TeacherCreate(TeacherBase):
    """Schema for creating a new teacher."""
    pass


class TeacherUpdate(BaseSchema):
    """Schema for updating a teacher."""
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    is_active: Optional[bool] = None


class TeacherInDBBase(TeacherBase):
    """Base schema for Teacher in DB."""
    id: UUID


class Teacher(TeacherInDBBase):
    """Schema for Teacher response."""
    pass


class TeacherWithClasses(Teacher):
    """Schema for Teacher with classes."""
    classes: List[str] = []