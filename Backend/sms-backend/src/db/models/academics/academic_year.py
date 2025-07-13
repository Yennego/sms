from sqlalchemy import Column, String, Date, Boolean, Text, Integer
from sqlalchemy.orm import relationship
from datetime import date
from src.db.models.base import TenantModel

class AcademicYear(TenantModel):
    """Model representing an academic year with semester support."""
    
    name = Column(String(20), nullable=False)  # e.g., "2025-2026"
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    is_current = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    description = Column(Text)
    
    # Semester information
    current_semester = Column(Integer, default=1)  # 1 or 2
    semester_1_start = Column(Date, nullable=False)
    semester_1_end = Column(Date, nullable=False)
    semester_2_start = Column(Date, nullable=False)
    semester_2_end = Column(Date, nullable=False)
    
    # Relationships
    enrollments = relationship("Enrollment", back_populates="academic_year_obj")
    
    def get_current_semester(self) -> int:
        """Determine current semester based on current date."""
        today = date.today()
        if self.semester_1_start <= today <= self.semester_1_end:
            return 1
        elif self.semester_2_start <= today <= self.semester_2_end:
            return 2
        return self.current_semester  # fallback
    
    def is_semester_active(self, semester: int) -> bool:
        """Check if a specific semester is currently active."""
        today = date.today()
        if semester == 1:
            return self.semester_1_start <= today <= self.semester_1_end
        elif semester == 2:
            return self.semester_2_start <= today <= self.semester_2_end
        return False
    
    __table_args__ = (
        # Ensure only one current academic year per tenant
        # This would be handled at application level
    )