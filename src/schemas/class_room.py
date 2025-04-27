from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel, Field, validator

from src.schemas.base import BaseSchema, TenantSchema, TimestampSchema
from src.schemas.teacher import Teacher


class ClassBase(BaseSchema):
    """Base schema for Class model."""
    name: str
    grade_level: str
    subject: str
    room_number: Optional[str] = None
    max_capacity: Optional[int] = None
    is_active: bool = True
    teacher_id: Optional[UUID] = None
    
    @validator('max_capacity')
    def validate_max_capacity(cls, v):
        """Validate max capacity if provided."""
        if v is not None and v < 0:
            raise ValueError('Max capacity cannot be negative')
        return v


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
    teacher_id: Optional[UUID] = None


class ClassInDBBase(ClassBase, TenantSchema, TimestampSchema):
    """Base schema for Class in DB."""
    id: UUID


class Class(ClassInDBBase):
    """Schema for Class response."""
    pass


class ClassWithTeacher(Class):
    """Schema for Class with Teacher details."""
    teacher: Optional[Teacher] = None


class ClassList(BaseSchema):
    """Schema for list of classes."""
    classes: List[Class]
    total: int