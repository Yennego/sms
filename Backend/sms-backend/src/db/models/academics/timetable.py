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
    """Structure:
    {
        "time_slots": [
            {
                "name": "Period 1",
                "day_of_week": "monday",
                "start_time": "08:00",
                "end_time": "09:00",
                "class_id": "UUID"  # NOTE: Points to ClassSubject.id (Assignment)
            }
        ]
    }
    """
    
    # Relationships
    grade_id = Column(UUID(as_uuid=True), ForeignKey("academic_grades.id"), nullable=False, index=True)
    section_id = Column(UUID(as_uuid=True), ForeignKey("sections.id"), nullable=False, index=True)
    
    # Add academic year relationship
    academic_year = relationship("AcademicYear", backref="timetables", lazy="joined")
    grade = relationship("AcademicGrade", backref="timetables", lazy="joined")
    section = relationship("Section", backref="timetables", lazy="joined")
    
    def __repr__(self):
        return f"<Timetable {self.name}>"

    @property
    def grade_name(self):
        return self.grade.name if self.grade else None

    @property
    def section_name(self):
        return self.section.name if self.section else None

    @property
    def academic_year_name(self):
        return self.academic_year.name if self.academic_year else None