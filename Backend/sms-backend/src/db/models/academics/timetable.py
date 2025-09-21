from sqlalchemy import Column, String, ForeignKey, Text, Boolean, Date, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
from datetime import date

from src.db.models.base import TenantModel

class Timetable(TenantModel):
    # Core fields
    name = Column(String(255), nullable=False)
    # Remove: academic_year = Column(String(20), nullable=False, index=True)
    # Add: academic_year_id as foreign key
    academic_year_id = Column(UUID(as_uuid=True), ForeignKey("academic_years.id"), nullable=False, index=True)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    effective_from = Column(Date, nullable=False, default=date.today)
    effective_until = Column(Date, nullable=True)
    timetable_data = Column(JSON, nullable=True)  # Flexible JSON storage
    
    # Relationships
    grade_id = Column(UUID(as_uuid=True), ForeignKey("academic_grades.id"), nullable=False)
    section_id = Column(UUID(as_uuid=True), ForeignKey("sections.id"), nullable=False)
    
    # Add academic year relationship
    academic_year = relationship("AcademicYear", backref="timetables")
    grade = relationship("AcademicGrade", backref="timetables")
    section = relationship("Section", backref="timetables")
    
    def __repr__(self):
        return f"<Timetable {self.name} - {self.grade.name}{self.section.name} - {self.academic_year.name}>"