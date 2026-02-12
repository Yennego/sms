from typing import Optional, Any, List
from sqlalchemy import Column, String, ForeignKey, Date, Boolean, Integer, Text, UniqueConstraint, Index
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
from datetime import date

from src.db.models.base import TenantModel

class Enrollment(TenantModel):
    """Enhanced enrollment model with semester support and proper foreign key relationships.
    
    This model represents a student's enrollment in a specific grade and section
    for an academic year. It now uses proper foreign keys instead of string fields.
    """
    
    __tablename__ = "enrollments"
    
    # Core relationships
    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id"), nullable=False)
    academic_year_id = Column(UUID(as_uuid=True), ForeignKey("academic_years.id"), nullable=False)
    
    # UPDATED: Use foreign keys instead of string fields
    grade_id = Column(UUID(as_uuid=True), ForeignKey("academic_grades.id"), nullable=False)
    section_id = Column(UUID(as_uuid=True), ForeignKey("sections.id"), nullable=False)
    
    # Enrollment details
    semester = Column(Integer, nullable=False, default=1)  # 1 or 2
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
    
    # DEPRECATED: Keep for backward compatibility during migration
    academic_year = Column(String(20), nullable=True)  # Will be removed after migration
    grade = Column(String(50), nullable=True)  # Will be removed after migration
    section = Column(String(10), nullable=True)  # Will be removed after migration
    
    # Relationships
    student = relationship("Student", back_populates="enrollments")
    academic_year_obj = relationship("AcademicYear", back_populates="enrollments")
    grade_obj = relationship("AcademicGrade", back_populates="enrollments")
    section_obj = relationship("Section", back_populates="enrollments")
    
    # New: Relationship to promotion status
    promotion_status = relationship("PromotionStatus", backref="enrollment", uselist=False)
    
    # FIXED: Relationship to assessment grades (not grade levels)
    assessment_grades = relationship("Grade", back_populates="enrollment", foreign_keys="Grade.enrollment_id")
    
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
    
    @property
    def grade_name(self) -> str:
        """Get the grade name from the related AcademicGrade object."""
        return self.grade_obj.name if self.grade_obj else self.grade or "Unknown"
    
    @property
    def student_name(self) -> str:
        """Get the student full name from the related Student object."""
        if self.student:
            return self.student.full_name or f"{self.student.first_name} {self.student.last_name}".strip() or "Unknown"
        return "Unknown"

    @property
    def section_name(self) -> str:
        """Get the section name from the related Section object."""
        return self.section_obj.name if self.section_obj else self.section or "Unknown"

    def __repr__(self):
        return f"<Enrollment {self.student_id} - {self.grade_name} {self.section_name} - {self.academic_year or 'Current'}>"
    
    __table_args__ = (
        UniqueConstraint(
            'tenant_id', 'student_id', 'academic_year_id',
            name='unique_enrollment_student_year'
        ),
        Index(
            'ix_enrollments_active_student',
            'tenant_id', 'student_id', 'is_active', 'status'
        ),
        Index('ix_enrollments_tenant_grade_year', 'tenant_id', 'grade_id', 'academic_year_id'),
        Index('ix_enrollments_tenant_section', 'tenant_id', 'section_id'),
    )

        