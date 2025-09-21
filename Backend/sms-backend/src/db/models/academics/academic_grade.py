from sqlalchemy import Column, String, Text, Boolean, Integer
from sqlalchemy.orm import relationship

from src.db.models.base import TenantModel

class AcademicGrade(TenantModel):
    """Model representing a grade level in the school.
    
    This model tracks grade levels in the school, such as Grade 1, Grade 2, etc.
    
    Attributes:
        name (String): Name of the grade level
        description (Text): Detailed description of the grade level
        is_active (Boolean): Whether the grade level is currently active
        sequence (Integer): Sequence number for ordering grade levels
    """
    
    __tablename__ = "academic_grades"
    
    # Grade level details
    name = Column(String(50), nullable=False)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    sequence = Column(Integer, nullable=False)  # For ordering grade levels
    
    # Relationships to other models
    sections = relationship("Section", back_populates="grade")
    assignments = relationship("Assignment", back_populates="grade")
    exams = relationship("Exam", back_populates="grade")
    enrollments = relationship("Enrollment", back_populates="grade_obj")
    
    def __repr__(self):
        return f"<AcademicGrade {self.name} - Sequence: {self.sequence}>"