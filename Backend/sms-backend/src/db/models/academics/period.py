from sqlalchemy import Column, String, Date, Boolean, Integer, ForeignKey
from sqlalchemy.orm import relationship
from src.db.models.base import TenantModel

class Period(TenantModel):
    """Model representing an academic period within a semester."""
    
    __tablename__ = "periods"
    
    semester_id = Column(ForeignKey("semesters.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(50), nullable=False)  # e.g., "P1", "1st Period"
    period_number = Column(Integer, nullable=False)  # 1 to 6
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    is_published = Column(Boolean, default=False)  # Global publication flag
    is_active = Column(Boolean, default=True)
    
    # Relationships
    semester = relationship("Semester", back_populates="periods")
    grades = relationship("Grade", back_populates="period_obj")
    
    def __repr__(self):
        return f"<Period {self.name} ({self.period_number})>"
