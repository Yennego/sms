from sqlalchemy import Column, String, ForeignKey, Date, DateTime, Text, Enum, UniqueConstraint
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
    
    # Ensure one attendance record per student per class per date
    __table_args__ = (
        UniqueConstraint('student_id', 'class_id', 'date', name='unique_student_class_date_attendance'),
    )
    
    def __repr__(self):
        return f"<Attendance {self.student_id} - {self.class_id} - {self.date} - {self.status}>"
    
    @property
    def is_present(self) -> bool:
        """Check if student was present (including late/tardy)."""
        return self.status in [AttendanceStatus.PRESENT, AttendanceStatus.LATE, AttendanceStatus.TARDY]
    
    @property
    def duration_minutes(self) -> int:
        """Calculate attendance duration in minutes if check-in/out times are available."""
        if self.check_in_time and self.check_out_time:
            delta = self.check_out_time - self.check_in_time
            return int(delta.total_seconds() / 60)
        return 0
    
    @classmethod
    def validate_student_enrollment(cls, student_id, class_id, academic_year_id):
        """Validate that a student is enrolled in the class before marking attendance."""
        from src.db.models.academics.class_enrollment import ClassEnrollment
        from sqlalchemy.orm import sessionmaker
        
        # This would be called from the service layer with proper session management
        # For now, this is a placeholder for the validation logic
        return True  # Implementation would check ClassEnrollment table