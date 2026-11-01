from sqlalchemy import Column, String, ForeignKey, Date, DateTime, Text, Enum, Index, cast, func
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
from datetime import date, datetime
import enum

from src.db.models.base import TenantModel

# Enum for attendance status
class AttendanceStatus(str, enum.Enum):
    """Enum for attendance status."""
    PRESENT = "present"
    ABSENT = "absent"
    LATE = "late"
    EXCUSED = "excused"
    SICK = "sick"
    TARDY = "tardy"

# Single source of truth for how statuses count toward attendance rates.
# Excused/sick days are left out of the denominator so they don't lower the rate.
PRESENT_STATUSES = frozenset({AttendanceStatus.PRESENT, AttendanceStatus.LATE, AttendanceStatus.TARDY})
EXCUSED_STATUSES = frozenset({AttendanceStatus.EXCUSED, AttendanceStatus.SICK})

def calculate_attendance_rate(status_counts: dict) -> float:
    """Attendance rate (%) from {AttendanceStatus|str: count}: present / (total - excused)."""
    present = excused = total = 0
    for status, count in status_counts.items():
        status = AttendanceStatus(getattr(status, "value", status))
        total += count
        if status in PRESENT_STATUSES:
            present += count
        elif status in EXCUSED_STATUSES:
            excused += count
    countable = total - excused
    return (present / countable * 100) if countable > 0 else 0.0

class Attendance(TenantModel):
    """Model representing student attendance for a specific date and class.
    
    This model tracks daily attendance for students in their classes.
    Now requires a class_id to ensure proper attendance tracking.
    
    Attributes:
        student_id (UUID): Foreign key to the student
        class_id (UUID): Foreign key to the class (REQUIRED)
        schedule_id (UUID): Foreign key to the specific schedule/period (optional)
        date (Date): Date of attendance
        status (AttendanceStatus): Attendance status
        marked_by (UUID): Foreign key to the teacher/user who marked attendance
        marked_at (DateTime): Timestamp when attendance was marked
        check_in_time (DateTime): Time when student checked in (optional)
        check_out_time (DateTime): Time when student checked out (optional)
        notes (Text): Additional notes about the attendance
        academic_year_id (UUID): Foreign key to academic year
        period (String): Period/class number for the day (optional)
    """
    
    __tablename__ = "attendances"
    
    # Core relationships
    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id"), nullable=False)
    student = relationship("Student", back_populates="attendances", foreign_keys=[student_id])
    
    # UPDATED: class_id is now required for proper attendance tracking
    class_id = Column(UUID(as_uuid=True), ForeignKey("classes.id"), nullable=False)
    class_obj = relationship("Class", back_populates="attendances")
    
    schedule_id = Column(UUID(as_uuid=True), ForeignKey("schedules.id"), nullable=True)
    schedule = relationship("Schedule", back_populates="attendances")
    
    academic_year_id = Column(UUID(as_uuid=True), ForeignKey("academic_years.id"), nullable=False)
    academic_year = relationship("AcademicYear", back_populates="attendances")
    
    # Attendance details
    date = Column(Date, nullable=False, index=True)
    status = Column(Enum(AttendanceStatus), nullable=False, default=AttendanceStatus.PRESENT)
    period = Column(String(10), nullable=True)  # Period/class number (e.g., "1", "2", "Morning")
    
    # Timing details
    check_in_time = Column(DateTime, nullable=True)
    check_out_time = Column(DateTime, nullable=True)
    
    # Marking metadata
    marked_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    marked_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    
    # Additional information
    notes = Column(Text, nullable=True)
    
    # Relationships for marked_by
    marked_by_user = relationship("User", foreign_keys=[marked_by])
    
    # One record per student per class per date per period. Without a schedule or
    # period the record covers the whole day ('day').
    __table_args__ = (
        Index(
            'uq_attendance_student_class_date_period',
            'tenant_id', 'student_id', 'class_id', 'date',
            func.coalesce(cast(schedule_id, String), period, 'day'),
            unique=True,
        ),
    )
    
    def __repr__(self):
        return f"<Attendance {self.student_id} - {self.class_id} - {self.date} - {self.status}>"
    
    @property
    def is_present(self) -> bool:
        """Check if student was present (including late/tardy)."""
        return self.status in PRESENT_STATUSES
    
    @property
    def duration_minutes(self) -> int:
        """Calculate attendance duration in minutes if check-in/out times are available."""
        if self.check_in_time and self.check_out_time:
            delta = self.check_out_time - self.check_in_time
            return int(delta.total_seconds() / 60)
        return 0