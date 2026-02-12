from datetime import date
from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel, Field, ConfigDict
from src.schemas.base.base import TimestampSchema, TenantSchema

class SemesterBase(BaseModel):
    name: str = Field(..., description="Semester name, e.g., '1st Semester'")
    semester_number: int = Field(..., description="Semester number (1 or 2)")
    start_date: date = Field(..., description="Semester start date")
    end_date: date = Field(..., description="Semester end date")
    is_published: bool = Field(default=False, description="Global publication flag")
    is_active: bool = Field(default=True, description="Whether this semester is active")

class SemesterCreate(SemesterBase):
    academic_year_id: UUID

class SemesterUpdate(BaseModel):
    name: Optional[str] = None
    semester_number: Optional[int] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    is_published: Optional[bool] = None
    is_active: Optional[bool] = None

class SemesterInDB(SemesterBase, TenantSchema):
    id: UUID
    academic_year_id: UUID
    model_config = ConfigDict(from_attributes=True)

class Semester(SemesterInDB):
    pass
