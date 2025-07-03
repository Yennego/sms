from sqlalchemy import Column, String, ForeignKey, Text, Integer, DateTime, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import enum

from src.db.models.base import TenantModel


class FeedbackType(enum.Enum):
    """Enum for feedback types."""
    GENERAL = "general"  # General feedback
    ACADEMIC = "academic"  # Academic feedback
    FACILITY = "facility"  # Facility feedback
    STAFF = "staff"  # Staff feedback
    OTHER = "other"  # Other feedback


class FeedbackStatus(enum.Enum):
    """Enum for feedback status."""
    SUBMITTED = "submitted"  # Feedback submitted
    UNDER_REVIEW = "under_review"  # Feedback under review
    RESOLVED = "resolved"  # Feedback resolved
    CLOSED = "closed"  # Feedback closed


class Feedback(TenantModel):
    """Model representing feedback in the system.
    
    This model tracks feedback submitted by users, including details about the feedback,
    its status, and the user who submitted it.
    
    Attributes:
        subject (String): Subject of the feedback
        content (Text): Content of the feedback
        feedback_type (Enum): Type of feedback (general, academic, facility, etc.)
        submitter_id (UUID): Foreign key to the user who submitted the feedback
        assignee_id (UUID): Foreign key to the user assigned to handle the feedback
        status (Enum): Status of the feedback (submitted, under_review, resolved, closed)
        rating (Integer): Rating given by the submitter (1-5)
        submission_date (DateTime): Date when the feedback was submitted
        resolution_date (DateTime): Date when the feedback was resolved
    """
    
    __tablename__ = "feedbacks"
    
    # Feedback details
    subject = Column(String(255), nullable=False)
    content = Column(Text, nullable=False)
    feedback_type = Column(Enum(FeedbackType), nullable=False, default=FeedbackType.GENERAL)
    
    # Submitter relationship
    submitter_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    submitter = relationship("User", foreign_keys=[submitter_id])
    
    # Assignee relationship
    assignee_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    assignee = relationship("User", foreign_keys=[assignee_id])
    
    # Status and rating
    status = Column(Enum(FeedbackStatus), nullable=False, default=FeedbackStatus.SUBMITTED)
    rating = Column(Integer, nullable=True)  # 1-5 rating
    
    # Dates
    submission_date = Column(DateTime(timezone=True), nullable=False, default=func.now())
    resolution_date = Column(DateTime(timezone=True), nullable=True)
    
    def __repr__(self):
        return f"<Feedback {self.id} - {self.subject}>"

        