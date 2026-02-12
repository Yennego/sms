from sqlalchemy import Column, String, Date, Boolean, Integer, ForeignKey
from sqlalchemy.orm import relationship
from src.db.models.base import TenantModel

class Semester(TenantModel):
    """Model representing an academic semester."""
    
    __tablename__ = "semesters"
    
    academic_year_id = Column(ForeignKey("academic_years.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(50), nullable=False)  # e.g., "1st Semester"
    semester_number = Column(Integer, nullable=False)  # 1 or 2
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    is_published = Column(Boolean, default=False)  # Global publication flag
    is_active = Column(Boolean, default=True)
    
    # Relationships
    academic_year = relationship("AcademicYear", back_populates="semesters")
    periods = relationship("Period", back_populates="semester", cascade="all, delete-orphan")
    grades = relationship("Grade", back_populates="semester_obj")
    
    def __repr__(self):
        return f"<Semester {self.name} ({self.semester_number})>"
