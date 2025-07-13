from sqlalchemy import Column, String, ForeignKey, Date, Boolean, Integer, Text
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
from datetime import date

from src.db.models.base import TenantModel

class Enrollment(TenantModel):
    """Enhanced enrollment model with semester support."""
    
    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id"), nullable=False)
    academic_year = Column(String(20), nullable=False)  # e.g., "2025-2026"
    academic_year_id = Column(UUID(as_uuid=True), ForeignKey("academic_years.id"), nullable=True)
    semester = Column(Integer, nullable=False, default=1)  # 1 or 2
    grade = Column(String(50), nullable=False)
    section = Column(String(10), nullable=False)
    enrollment_date = Column(Date, default=date.today)
    roll_number = Column(Integer)
    status = Column(String(20), default="active")  # active, completed, withdrawn, graduated
    is_active = Column(Boolean, default=True)
    withdrawal_date = Column(Date)
    withdrawal_reason = Column(Text)
    comments = Column(Text)
    
    # Semester-specific fields
    semester_1_status = Column(String(20), default="pending")  # pending, active, completed, failed
    semester_2_status = Column(String(20), default="pending")
    semester_1_completion_date = Column(Date)
    semester_2_completion_date = Column(Date)
    
    # Relationships
    student = relationship("Student", back_populates="enrollments")
    academic_year_obj = relationship("AcademicYear", back_populates="enrollments")
    grades = relationship("Grade", back_populates="enrollment")
    
    def can_promote_to_next_semester(self) -> bool:
        """Check if student can be promoted to next semester."""
        if self.semester == 1:
            return self.semester_1_status == "completed"
        return False  # Already in semester 2
    
    def can_promote_to_next_grade(self) -> bool:
        """Check if student can be promoted to next grade."""
        return (self.semester == 2 and 
                self.semester_1_status == "completed" and 
                self.semester_2_status == "completed")

        