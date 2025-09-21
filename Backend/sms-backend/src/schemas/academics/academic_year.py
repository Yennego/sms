from datetime import date
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, Field

from src.schemas.base.base import TimestampSchema, TenantSchema


class AcademicYearBase(BaseModel):
    """Base schema for AcademicYear model."""
    name: str = Field(..., description="Academic year name, e.g., '2025-2026'")
    start_date: date = Field(..., description="Academic year start date")
    end_date: date = Field(..., description="Academic year end date")
    is_current: bool = Field(default=False, description="Whether this is the current academic year")
    is_active: bool = Field(default=True, description="Whether this academic year is active")
    description: Optional[str] = Field(None, description="Optional description")
    
    # Semester information
    current_semester: int = Field(default=1, description="Current semester (1 or 2)")
    semester_1_start: date = Field(..., description="Semester 1 start date")
    semester_1_end: date = Field(..., description="Semester 1 end date")
    semester_2_start: date = Field(..., description="Semester 2 start date")
    semester_2_end: date = Field(..., description="Semester 2 end date")


class AcademicYearCreate(AcademicYearBase):
    """Schema for creating a new academic year."""
    pass


class AcademicYearUpdate(BaseModel):
    """Schema for updating an academic year."""
    name: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    is_current: Optional[bool] = None
    is_active: Optional[bool] = None
    description: Optional[str] = None
    current_semester: Optional[int] = None
    semester_1_start: Optional[date] = None
    semester_1_end: Optional[date] = None
    semester_2_start: Optional[date] = None
    semester_2_end: Optional[date] = None


class AcademicYearInDB(AcademicYearBase, TenantSchema):
    """Schema for AcademicYear model in database."""
    class Config:
        from_attributes = True


class AcademicYear(AcademicYearInDB):
    """Schema for AcademicYear model response."""
    
    def get_current_semester(self) -> int:
        """Get the current semester based on current date."""
        from datetime import date as dt
        today = dt.today()
        
        if self.semester_1_start <= today <= self.semester_1_end:
            return 1
        elif self.semester_2_start <= today <= self.semester_2_end:
            return 2
        else:
            return self.current_semester
    
    def is_semester_active(self, semester: int) -> bool:
        """Check if a specific semester is currently active."""
        from datetime import date as dt
        today = dt.today()
        
        if semester == 1:
            return self.semester_1_start <= today <= self.semester_1_end
        elif semester == 2:
            return self.semester_2_start <= today <= self.semester_2_end
        return False


class AcademicYearWithDetails(AcademicYear):
    """Schema for AcademicYear with additional details."""
    total_enrollments: Optional[int] = None
    active_classes: Optional[int] = None