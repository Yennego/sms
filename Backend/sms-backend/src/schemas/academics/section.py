from typing import Optional
from uuid import UUID
from pydantic import BaseModel

from src.schemas.base.base import TimestampSchema, TenantSchema


class SectionBase(BaseModel):
    """Base schema for Section model."""
    name: str
    description: Optional[str] = None
    is_active: bool = True
    capacity: int
    grade_id: UUID


class SectionCreate(SectionBase):
    """Schema for creating a new section."""
    pass


class SectionUpdate(BaseModel):
    """Schema for updating a section."""
    name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None
    capacity: Optional[int] = None
    grade_id: Optional[UUID] = None


class SectionInDB(SectionBase, TenantSchema):
    """Schema for Section model in database."""
    class Config:
        from_attributes = True


class Section(SectionInDB):
    """Schema for Section model response."""
    pass


class SectionWithDetails(Section):
    """Schema for Section with additional details."""
    grade_name: str