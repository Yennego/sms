from sqlalchemy import Column, String, ForeignKey, Text, Boolean, DateTime, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import enum

from src.db.models.base import TenantModel


class AnnouncementTargetType(enum.Enum):
    """Enum for announcement target types."""
    ALL = "all"  # All users
    STUDENTS = "students"  # All students
    TEACHERS = "teachers"  # All teachers
    PARENTS = "parents"  # All parents
    GRADE = "grade"  # Specific grade
    SECTION = "section"  # Specific section
    CUSTOM = "custom"  # Custom list of users


class Announcement(TenantModel):
    """Model representing an announcement in the system.
    
    This model tracks announcements made to users, including details about the announcement,
    its status, target audience, and the user who created it.
    
    Attributes:
        title (String): Title of the announcement
        content (Text): Content of the announcement
        author_id (UUID): Foreign key to the user who created the announcement
        target_type (Enum): Type of target audience (all, students, teachers, etc.)
        target_id (UUID): ID of the specific target (e.g., grade ID if target_type is GRADE)
        is_active (Boolean): Whether the announcement is active
        is_pinned (Boolean): Whether the announcement is pinned
        publish_date (DateTime): Date when the announcement was published
        expiry_date (DateTime): Date when the announcement expires
    """
    
    __tablename__ = "announcements"
    
    # Announcement details
    title = Column(String(255), nullable=False)
    content = Column(Text, nullable=False)
    
    # Author relationship
    author_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    author = relationship("User")
    
    # Target audience
    target_type = Column(Enum(AnnouncementTargetType), nullable=False)
    target_id = Column(UUID(as_uuid=True), nullable=True)  # Nullable for ALL, STUDENTS, TEACHERS, PARENTS
    
    # Status
    is_active = Column(Boolean, nullable=False, default=True)
    is_pinned = Column(Boolean, nullable=False, default=False)
    
    # Dates
    publish_date = Column(DateTime(timezone=True), nullable=False, default=func.now())
    expiry_date = Column(DateTime(timezone=True), nullable=True)
    
    def __repr__(self):
        return f"<Announcement {self.id} - {self.title}>"

        