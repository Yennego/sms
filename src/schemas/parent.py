from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel, ConfigDict

from src.schemas.base import BaseSchema

class ParentBase(BaseSchema):
    """Base schema for Parent model."""
    first_name: str
    last_name: str
    email: str
    phone: str
    is_active: bool = True

class ParentCreate(ParentBase):
    """Schema for creating a new parent."""
    pass

class ParentUpdate(BaseSchema):
    """Schema for updating a parent."""
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    is_active: Optional[bool] = None

class ParentInDBBase(ParentBase):
    """Base schema for Parent in DB."""
    id: UUID

class Parent(ParentInDBBase):
    """Schema for Parent response."""
    pass

class ParentWithStudents(Parent):
    """Schema for Parent with students."""
    students: List[str] = []

class ParentList(BaseModel):
    parents: List[Parent]
    total: int 