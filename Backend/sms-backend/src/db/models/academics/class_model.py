from sqlalchemy import Column, String, ForeignKey, Text, Boolean, Integer, Date, Time, UniqueConstraint, Index
from sqlalchemy.engine import mock
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
from datetime import date

from src.db.models.base import TenantModel
from src.db.models.academics.class_enrollment import ClassEnrollment


class Class(TenantModel):
    """Model representing a class in the school system.
    
    A class is a unique container defined by Grade, Section, and Academic Year.
    It represents the actual teaching unit where a Class Sponsor (Main Teacher)
    manages the students, while individual subjects are handled via ClassSubject.
    
    Attributes:
        name (String): Name of the class (auto-generated)
        academic_year_id (UUID): Foreign key to the academic year
        grade_id (UUID): Foreign key to the grade level
        section_id (UUID): Foreign key to the section
        class_teacher_id (UUID): Foreign key to the Teacher who is the Class Sponsor
        room (String): Room where the class is held
        capacity (Integer): Maximum number of students per class
        is_active (Boolean): Whether the class is currently active
    """
    
    __tablename__ = "classes"
    
    # Class details
    name = Column(String(255), nullable=True)
    academic_year_id = Column(UUID(as_uuid=True), ForeignKey("academic_years.id"), nullable=False, index=True)
    room = Column(String(50), nullable=True)
    capacity = Column(Integer, nullable=False, default=30)
    is_active = Column(Boolean, nullable=False, default=True)
    start_date = Column(Date, nullable=False, default=date.today)
    end_date = Column(Date, nullable=True)
    description = Column(Text, nullable=True)
    
    # Relationships
    grade_id = Column(UUID(as_uuid=True), ForeignKey("academic_grades.id"), nullable=False)
    section_id = Column(UUID(as_uuid=True), ForeignKey("sections.id"), nullable=False)
    class_teacher_id = Column(UUID(as_uuid=True), ForeignKey("teachers.id"), nullable=True)
    
    # Navigation properties
    academic_year = relationship("AcademicYear")
    grade = relationship("AcademicGrade", backref="classes")
    section = relationship("Section", backref="classes")
    class_teacher = relationship("Teacher", backref="sponsored_classes")
    
    # Link to multiple subjects
    subjects = relationship("ClassSubject", back_populates="class_obj", lazy="selectin", cascade="all, delete-orphan")
    
    # Student management
    student_enrollments = relationship("ClassEnrollment", back_populates="class_obj", lazy="dynamic")
    attendances = relationship("Attendance", back_populates="class_obj")
    
    # Deprecated academic_year string removed
    # academic_year_str = Column("academic_year", String(20), nullable=True)
    
    def __repr__(self):
        grade_name = self.grade.name if self.grade else "Unknown"
        section_name = self.section.name if self.section else "Unknown"
        return f"<Class {grade_name} - {section_name} ({self.academic_year.name if self.academic_year else 'N/A'})>"
    
    def generate_name(self):
        """Generate a name for the class if one is not provided."""
        if not self.name and self.grade and self.section:
            self.name = f"{self.grade.name} - {self.section.name}"
        return self.name
    
    __table_args__ = (
        UniqueConstraint(
            'tenant_id', 'academic_year_id', 'grade_id', 'section_id',
            name='unique_class_identity'
        ),
        Index('idx_classes_tenant_ay_grade', 'tenant_id', 'academic_year_id', 'grade_id'),
    )
