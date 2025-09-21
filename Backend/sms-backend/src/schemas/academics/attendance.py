from datetime import date, datetime
from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel, Field

from src.schemas.base import TenantSchema
from src.db.models.academics.attendance import AttendanceStatus

class AttendanceBase(BaseModel):
    """Base schema for Attendance model."""
    student_id: UUID
    class_id: Optional[UUID] = None
    schedule_id: Optional[UUID] = None
    academic_year_id: UUID
    date: date
    status: AttendanceStatus = AttendanceStatus.PRESENT
    period: Optional[str] = None
    check_in_time: Optional[datetime] = None
    check_out_time: Optional[datetime] = None
    notes: Optional[str] = None

class AttendanceCreate(AttendanceBase):
    """Schema for creating a new attendance record."""
    marked_by: UUID
    marked_at: Optional[datetime] = None

class AttendanceUpdate(BaseModel):
    """Schema for updating an attendance record."""
    status: Optional[AttendanceStatus] = None
    check_in_time: Optional[datetime] = None
    check_out_time: Optional[datetime] = None
    notes: Optional[str] = None
    marked_by: Optional[UUID] = None
    marked_at: Optional[datetime] = None

class AttendanceInDB(AttendanceBase, TenantSchema):
    """Schema for Attendance model in database."""
    marked_by: UUID
    marked_at: datetime
    
    class Config:
        from_attributes = True

class Attendance(AttendanceInDB):
    """Schema for Attendance model response."""
    is_present: bool = Field(..., description="Whether student was present (including late/tardy)")
    duration_minutes: int = Field(0, description="Duration in minutes if check-in/out available")

class AttendanceWithDetails(Attendance):
    """Schema for Attendance with student and class details."""
    student_name: str
    student_admission_number: str
    class_name: Optional[str] = None
    subject_name: Optional[str] = None
    teacher_name: Optional[str] = None
    marked_by_name: str

class AttendanceSummary(BaseModel):
    """Schema for attendance summary statistics."""
    date: date
    total_students: int
    present_count: int
    absent_count: int
    late_count: int
    excused_count: int
    attendance_percentage: float

class BulkAttendanceCreate(BaseModel):
    """Schema for bulk attendance creation."""
    class_id: Optional[UUID] = None
    schedule_id: Optional[UUID] = None
    academic_year_id: UUID
    date: date
    period: Optional[str] = None
    marked_by: UUID
    attendances: List[dict] = Field(..., description="List of {student_id: UUID, status: AttendanceStatus}")

class AttendanceReport(BaseModel):
    """Schema for attendance reports."""
    student_id: UUID
    student_name: str
    student_admission_number: str
    total_days: int
    present_days: int
    absent_days: int
    late_days: int
    excused_days: int
    attendance_percentage: float
    class_name: Optional[str] = None