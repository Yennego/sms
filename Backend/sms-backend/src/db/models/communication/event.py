from sqlalchemy import Column, String, ForeignKey, Text, Boolean, DateTime, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import enum

from src.db.models.base import TenantModel


class EventType(enum.Enum):
    """Enum for event types."""
    ACADEMIC = "academic"  # Academic events like exams, quizzes
    CULTURAL = "cultural"  # Cultural events like festivals
    SPORTS = "sports"  # Sports events
    HOLIDAY = "holiday"  # Holidays
    OTHER = "other"  # Other events


class Event(TenantModel):
    """Model representing an event in the system.
    
    This model tracks events in the school calendar, including details about the event,
    its timing, location, and the user who created it.
    
    Attributes:
        title (String): Title of the event
        description (Text): Description of the event
        event_type (Enum): Type of event (academic, cultural, sports, etc.)
        organizer_id (UUID): Foreign key to the user who organized the event
        location (String): Location of the event
        start_datetime (DateTime): Start date and time of the event
        end_datetime (DateTime): End date and time of the event
        is_all_day (Boolean): Whether the event is an all-day event
        is_recurring (Boolean): Whether the event is recurring
        recurrence_pattern (String): Pattern for recurring events
        is_active (Boolean): Whether the event is active
    """
    
    __tablename__ = "events"
    
    # Event details
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    event_type = Column(Enum(EventType), nullable=False, default=EventType.OTHER)
    
    # Organizer relationship
    organizer_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    organizer = relationship("User")
    
    # Location and timing
    location = Column(String(255), nullable=True)
    start_datetime = Column(DateTime(timezone=True), nullable=False)
    end_datetime = Column(DateTime(timezone=True), nullable=True)
    is_all_day = Column(Boolean, nullable=False, default=False)
    
    # Recurrence
    is_recurring = Column(Boolean, nullable=False, default=False)
    recurrence_pattern = Column(String(255), nullable=True)  # Could be JSON in a real implementation
    
    # Status
    is_active = Column(Boolean, nullable=False, default=True)
    
    def __repr__(self):
        return f"<Event {self.id} - {self.title}>"