from sqlalchemy import Column, String, ForeignKey, Text, Boolean, Integer
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID

from src.db.models.base import TenantModel

class Section(TenantModel):
    """Model representing a section within a grade level.
    
    This model tracks sections within grade levels, such as Grade 1A, Grade 1B, etc.
    
    Attributes:
        name (String): Name of the section
        grade_id (UUID): Foreign key to the grade level
        description (Text): Detailed description of the section
        is_active (Boolean): Whether the section is currently active
        capacity (Integer): Maximum number of students in the section
    """
    
    __tablename__ = "sections"
    
    # Section details
    name = Column(String(50), nullable=False)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    capacity = Column(Integer, nullable=False, default=30)
    
    # Relationships
    grade_id = Column(UUID(as_uuid=True), ForeignKey("academic_grades.id"), nullable=False)
    grade = relationship("AcademicGrade", back_populates="sections")
    
    # Relationships to other models
    assignments = relationship("Assignment", back_populates="section")
    exams = relationship("Exam", back_populates="section")
    enrollments = relationship("Enrollment", back_populates="section_obj")
    
    def __repr__(self):
        return f"<Section {self.name} - Grade ID: {self.grade_id}>"