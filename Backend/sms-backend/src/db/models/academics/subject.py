from sqlalchemy import Column, String, ForeignKey, Text, Boolean, Integer
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID

from src.db.models.base import TenantModel

class Subject(TenantModel):
    """Model representing a subject taught in the school.
    
    This model tracks subjects taught in the school, including details about the subject,
    the grade levels it's taught in, and the teachers who teach it.
    
    Attributes:
        name (String): Name of the subject
        code (String): Subject code
        description (Text): Detailed description of the subject
        is_active (Boolean): Whether the subject is currently active
        credits (Integer): Number of credits for the subject
    """
    
    __tablename__ = "subjects"
    
    # Subject details
    name = Column(String(255), nullable=False)
    code = Column(String(50), nullable=False)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    credits = Column(Integer, nullable=False, default=1)
    
    # Relationships to other models
    assignments = relationship("Assignment", back_populates="subject")
    exams = relationship("Exam", back_populates="subject")
    grades = relationship("Grade", back_populates="subject")
    
    def __repr__(self):
        return f"<Subject {self.name} - {self.code}>"