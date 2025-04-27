from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel, ConfigDict

from src.schemas.base import BaseSchema

class SubjectBase(BaseSchema):
    """Base schema for Subject model."""
    name: str
    description: str
    is_active: bool = True

class SubjectCreate(SubjectBase):
    """Schema for creating a new subject."""
    pass

class SubjectUpdate(BaseSchema):
    """Schema for updating a subject."""
    name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None

class SubjectInDBBase(SubjectBase):
    """Base schema for Subject in DB."""
    id: UUID

class Subject(SubjectInDBBase):
    """Schema for Subject response."""
    pass

class SubjectWithClasses(Subject):
    """Schema for Subject with classes."""
    classes: List[str] = [] 