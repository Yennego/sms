from sqlalchemy import Column, String, ForeignKey, Text, Boolean, Integer, Date, Time
from sqlalchemy.engine import mock
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
from datetime import date

from src.db.models.base import TenantModel

class Class(TenantModel):
    """Model representing a class in the school system.
    
    A class is a combination of a grade level, section, subject, and teacher.
    It represents the actual teaching unit where a specific teacher teaches
    a specific subject to students in a specific grade and section.
    
    Attributes:
        name (String): Name of the class (optional, can be auto-generated)
        academic_year (String): The academic year (e.g., "2023-2024")
        grade_id (UUID): Foreign key to the grade level
        section_id (UUID): Foreign key to the section
        subject_id (UUID): Foreign key to the subject
        teacher_id (UUID): Foreign key to the teacher
        room (String): Room where the class is held
        is_active (Boolean): Whether the class is currently active
        start_date (Date): Date when the class starts
        end_date (Date): Date when the class ends
        description (Text): Additional description of the class
    """
    
    __tablename__ = "classes"
    
    # Class details
    name = Column(String(255), nullable=True)  # Can be auto-generated
    academic_year = Column(String(20), nullable=False, index=True)
    description = Column(Text, nullable=True)
    room = Column(String(50), nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    start_date = Column(Date, nullable=False, default=date.today)
    end_date = Column(Date, nullable=True)
    
    # Relationships
    grade_id = Column(UUID(as_uuid=True), ForeignKey("academic_grades.id"), nullable=False)
    grade = relationship("AcademicGrade", backref="classes")
    
    section_id = Column(UUID(as_uuid=True), ForeignKey("sections.id"), nullable=False)
    section = relationship("Section", backref="classes")
    
    subject_id = Column(UUID(as_uuid=True), ForeignKey("subjects.id"), nullable=False)
    subject = relationship("Subject", backref="classes")
    
    teacher_id = Column(UUID(as_uuid=True), ForeignKey("teachers.id"), nullable=False)
    teacher = relationship("Teacher", backref="classes")
    
    def __repr__(self):
        return f"<Class {self.name or f'{self.subject.name} - {self.grade.name}{self.section.name}'} - {self.academic_year}>"
    
    def generate_name(self):
        """Generate a name for the class if one is not provided."""
        if not self.name:
            self.name = f"{self.subject.name} - {self.grade.name}{self.section.name}"
        return self.name