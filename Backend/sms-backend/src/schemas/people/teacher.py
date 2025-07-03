from datetime import date
from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel

from src.schemas.auth.user import UserBase, UserCreate, UserUpdate, User


class TeacherBase(UserBase):
    """Base schema for Teacher model."""
    employee_id: str
    department: Optional[str] = None
    qualification: Optional[str] = None
    joining_date: Optional[date] = None
    is_class_teacher: bool = False
    address: Optional[str] = None
    city: Optional[str] = None
    county: Optional[str] = None
    country: Optional[str] = None
    gender: Optional[str] = None
    whatsapp_number: Optional[str] = None
    status: str = "active"


class TeacherCreate(UserCreate):
    """Schema for creating a new teacher."""
    employee_id: str
    department: Optional[str] = None
    qualification: Optional[str] = None
    joining_date: Optional[date] = None
    is_class_teacher: bool = False
    address: Optional[str] = None
    city: Optional[str] = None
    county: Optional[str] = None
    country: Optional[str] = None
    gender: Optional[str] = None
    whatsapp_number: Optional[str] = None
    status: str = "active"


class TeacherUpdate(UserUpdate):
    """Schema for updating a teacher."""
    employee_id: Optional[str] = None
    department: Optional[str] = None
    qualification: Optional[str] = None
    joining_date: Optional[date] = None
    is_class_teacher: Optional[bool] = None
    address: Optional[str] = None
    city: Optional[str] = None
    county: Optional[str] = None
    country: Optional[str] = None
    gender: Optional[str] = None
    whatsapp_number: Optional[str] = None
    status: Optional[str] = None
    exit_date: Optional[date] = None
    retirement_date: Optional[date] = None
    resignation_date: Optional[date] = None
    resignation_reason: Optional[str] = None


class Teacher(User):
    """Schema for Teacher model response."""
    employee_id: str
    department: Optional[str] = None
    qualification: Optional[str] = None
    joining_date: Optional[date] = None
    is_class_teacher: bool
    address: Optional[str] = None
    city: Optional[str] = None
    county: Optional[str] = None
    country: Optional[str] = None
    gender: Optional[str] = None
    whatsapp_number: Optional[str] = None
    status: str
    exit_date: Optional[date] = None
    retirement_date: Optional[date] = None
    resignation_date: Optional[date] = None
    resignation_reason: Optional[str] = None

    class Config:
        from_attributes = True

