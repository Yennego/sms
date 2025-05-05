from datetime import date
from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel

from src.schemas.auth.user import UserBase, UserCreate, UserUpdate, User
from src.schemas.people.student import Student


class ParentBase(UserBase):
    """Base schema for Parent model."""
    relationship_type: str
    occupation: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    county: Optional[str] = None
    country: Optional[str] = None
    whatsapp_number: Optional[str] = None
    status: str = "active"


class ParentCreate(UserCreate):
    """Schema for creating a new parent."""
    relationship_type: str
    occupation: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    county: Optional[str] = None
    country: Optional[str] = None
    whatsapp_number: Optional[str] = None
    status: str = "active"
    student_ids: Optional[List[UUID]] = None


class ParentUpdate(UserUpdate):
    """Schema for updating a parent."""
    relationship_type: Optional[str] = None
    occupation: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    county: Optional[str] = None
    country: Optional[str] = None
    whatsapp_number: Optional[str] = None
    status: Optional[str] = None
    deactivated_date: Optional[date] = None
    deactivation_reason: Optional[str] = None
    student_ids: Optional[List[UUID]] = None


class Parent(User):
    """Schema for Parent model response."""
    relationship_type: str
    occupation: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    county: Optional[str] = None
    country: Optional[str] = None
    whatsapp_number: Optional[str] = None
    status: str
    deactivated_date: Optional[date] = None
    deactivation_reason: Optional[str] = None
    students: List[Student] = []

    class Config:
        from_attributes = True