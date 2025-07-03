from asyncio import LimitOverrunError
from typing import Optional
from uuid import UUID
from pydantic import BaseModel

from src.schemas.base.base import TimestampSchema, TenantSchema


class SubjectBase(BaseModel):
    """Base schema for Subject model."""
    name: str
    code: str
    description: Optional[str] = None
    is_active: bool = True
    credits: Optional[float] = None


class SubjectCreate(SubjectBase):
    """Schema for creating a new subject."""
    pass


class SubjectUpdate(BaseModel):
    """Schema for updating a subject."""
    name: Optional[str] = None
    code: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None
    credits: Optional[float] = None


class SubjectInDB(SubjectBase, TenantSchema):
    """Schema for Subject model in database."""
    class Config:
        from_attributes = True


class Subject(SubjectInDB):
    """Schema for Subject model response."""
    pass

class SubjectWithDetails(Subject):
    """Schema for Subject with additional details."""
    teacher_name: str
    grade_name: str
    section_name: str