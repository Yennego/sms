from sqlalchemy import Column, String, ForeignKey, Integer, Time, Enum, Index
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
import enum

from src.db.models.base import TenantModel

class DayOfWeek(str, enum.Enum):
    """Enum for days of the week."""
    MONDAY = "monday"
    TUESDAY = "tuesday"
    WEDNESDAY = "wednesday"
    THURSDAY = "thursday"
    FRIDAY = "friday"
    SATURDAY = "saturday"
    SUNDAY = "sunday"


class Schedule(TenantModel):
    """Model representing a schedule for a class.
    
    This model tracks when a class is scheduled during the week.
    
    Attributes:
        class_id (UUID): Foreign key to the class
        day_of_week (DayOfWeek): Day of the week
        start_time (Time): Time when the class starts
        end_time (Time): Time when the class ends
        period (Integer): Period number in the day (e.g., 1st period, 2nd period)
    """
    
    __tablename__ = "schedules"
    
    # Schedule details
    # Timing details
    day_of_week = Column(Enum(DayOfWeek), nullable=False)
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)
    period = Column(Integer, nullable=True)  # Period number (1st, 2nd, etc.)
    
    # Relationships
    class_id = Column(UUID(as_uuid=True), ForeignKey("class_subjects.id", ondelete="CASCADE"), nullable=False)
    class_obj = relationship("ClassSubject", backref="schedules")
    attendances = relationship("Attendance", back_populates="schedule")
    
    def __repr__(self):
        return f"<Schedule {self.class_id} - {self.day_of_week} {self.start_time}-{self.end_time}>"

    __table_args__ = (
        Index('idx_schedules_lookup', 'tenant_id', 'day_of_week', 'start_time', 'end_time'),
    )