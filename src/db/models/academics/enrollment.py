from sqlalchemy import Column, String, ForeignKey, Date, Boolean, Integer, Text
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
from datetime import date

from src.db.models.base import TenantModel

class Enrollment(TenantModel):
    """Model representing a student's enrollment in a specific academic year, grade, and section.
    
    This model tracks a student's enrollment status, including the academic year,
    grade, section, enrollment date, and any withdrawal information.
    
    Attributes:
        student_id (UUID): Foreign key to the student
        academic_year (str): The academic year (e.g., "2023-2024")
        grade (str): The grade level (e.g., "Grade 10")
        section (str): The section within the grade (e.g., "A")
        enrollment_date (Date): Date when the student was enrolled
        status (str): Current enrollment status
        is_active (bool): Whether this enrollment is currently active
        withdrawal_date (Date): Date when the student withdrew (if applicable)
        withdrawal_reason (str): Reason for withdrawal (if applicable)
        comments (str): Additional comments about the enrollment
    """
    
    __tablename__ = "enrollments"
    
    # Relationships
    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id"), nullable=False)
    student = relationship("Student", back_populates="enrollments")
    grades = relationship("Grade", back_populates="enrollment")
    
    # Enrollment details
    academic_year = Column(String(20), nullable=False, index=True)
    grade = Column(String(20), nullable=False, index=True)
    section = Column(String(10), nullable=False, index=True)
    enrollment_date = Column(Date, nullable=False, default=date.today)
    roll_number = Column(Integer, nullable=True)
    
    # Status tracking
    status = Column(
        String(20),
        nullable=False,
        default="active",
        comment="One of: active, completed, withdrawn, transferred"
    )
    is_active = Column(Boolean, nullable=False, default=True)
    withdrawal_date = Column(Date, nullable=True)
    withdrawal_reason = Column(String(255), nullable=True)
    comments = Column(Text, nullable=True)
    
    def __repr__(self):
        return f"<Enrollment {self.student_id} - {self.academic_year} - {self.grade} {self.section}>"