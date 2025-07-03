from typing import Optional
from uuid import UUID
from pydantic import BaseModel

from src.schemas.base.base import TimestampSchema, TenantSchema


class AcademicGradeBase(BaseModel):
    """Base schema for AcademicGrade model."""
    name: str
    description: Optional[str] = None
    is_active: bool = True
    sequence: int


class AcademicGradeCreate(AcademicGradeBase):
    """Schema for creating a new academic grade."""
    pass


class AcademicGradeUpdate(BaseModel):
    """Schema for updating an academic grade."""
    name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None
    sequence: Optional[int] = None


class AcademicGradeInDB(AcademicGradeBase, TenantSchema):
    """Schema for AcademicGrade model in database."""
    class Config:
        from_attributes = True


class AcademicGrade(AcademicGradeInDB):
    """Schema for AcademicGrade model response."""
    pass
