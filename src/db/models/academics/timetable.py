from sqlalchemy import Column, String, ForeignKey, Text, Boolean, Date, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
from datetime import date

from src.db.models.base import TenantModel


class Timetable(TenantModel):
    """Model representing a complete timetable for a grade and section.
    
    This model represents a complete timetable for a specific grade and section,
    including all scheduled classes for the week.
    
    Attributes:
        name (String): Name of the timetable
        academic_year (String): The academic year (e.g., "2023-2024")
        grade_id (UUID): Foreign key to the grade level
        section_id (UUID): Foreign key to the section
        is_active (Boolean): Whether the timetable is currently active
        effective_from (Date): Date from which the timetable is effective
        effective_until (Date): Date until which the timetable is effective
        description (Text): Additional description of the timetable
        timetable_data (JSON): JSON representation of the timetable
    """
    
    __tablename__ = "timetables"
    
    # Timetable details
    name = Column(String(255), nullable=False)
    academic_year = Column(String(20), nullable=False, index=True)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    effective_from = Column(Date, nullable=False, default=date.today)
    effective_until = Column(Date, nullable=True)
    timetable_data = Column(JSON, nullable=True)  # For storing a JSON representation of the timetable
    
    # Relationships
    grade_id = Column(UUID(as_uuid=True), ForeignKey("academic_grades.id"), nullable=False)
    grade = relationship("AcademicGrade", backref="timetables")
    
    section_id = Column(UUID(as_uuid=True), ForeignKey("sections.id"), nullable=False)
    section = relationship("Section", backref="timetables")
    
    def __repr__(self):
        return f"<Timetable {self.name} - {self.grade.name}{self.section.name} - {self.academic_year}>"