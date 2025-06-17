from datetime import datetime
from typing import Optional, Literal
from uuid import UUID
from pydantic import BaseModel

from src.schemas.base.base import TimestampSchema, TenantSchema


class FeedbackBase(BaseModel):
    """Base schema for Feedback model."""
    subject: str
    content: str
    feedback_type: Literal["suggestion", "complaint", "appreciation", "bug", "other"]
    submitter_id: UUID
    assignee_id: Optional[UUID] = None
    status: Literal["pending", "in_progress", "resolved", "rejected"] = "pending"
    rating: Optional[int] = None
    submission_date: datetime
    resolution_date: Optional[datetime] = None


class FeedbackCreate(FeedbackBase):
    """Schema for creating a new feedback."""
    submission_date: datetime = datetime.now()


class FeedbackUpdate(BaseModel):
    """Schema for updating a feedback."""
    subject: Optional[str] = None
    content: Optional[str] = None
    feedback_type: Optional[Literal["suggestion", "complaint", "appreciation", "bug", "other"]] = None
    assignee_id: Optional[UUID] = None
    status: Optional[Literal["pending", "in_progress", "resolved", "rejected"]] = None
    rating: Optional[int] = None
    resolution_date: Optional[datetime] = None


class FeedbackInDB(FeedbackBase, TenantSchema):
    """Schema for Feedback model in database."""
    class Config:
        from_attributes = True


class Feedback(FeedbackInDB):
    """Schema for Feedback model response."""
    pass


class FeedbackWithDetails(Feedback):
    """Schema for Feedback with additional details."""
    submitter_name: str
    assignee_name: Optional[str] = None