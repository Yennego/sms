from datetime import datetime
from typing import Optional, Literal
from uuid import UUID
from pydantic import BaseModel

from src.schemas.base.base import TimestampSchema, TenantSchema


class AnnouncementBase(BaseModel):
    """Base schema for Announcement model."""
    title: str
    content: str
    author_id: UUID
    target_type: Literal["all", "students", "teachers", "parents", "grade", "section", "custom"]
    target_id: Optional[UUID] = None
    is_active: bool = True
    is_pinned: bool = False
    publish_date: datetime
    expiry_date: Optional[datetime] = None


class AnnouncementCreate(AnnouncementBase):
    """Schema for creating a new announcement."""
    publish_date: datetime = datetime.now()


class AnnouncementUpdate(BaseModel):
    """Schema for updating an announcement."""
    title: Optional[str] = None
    content: Optional[str] = None
    author_id: Optional[UUID] = None
    target_type: Optional[Literal["all", "students", "teachers", "parents", "grade", "section", "custom"]] = None
    target_id: Optional[UUID] = None
    is_active: Optional[bool] = None
    is_pinned: Optional[bool] = None
    publish_date: Optional[datetime] = None
    expiry_date: Optional[datetime] = None


class AnnouncementInDB(AnnouncementBase, TenantSchema):
    """Schema for Announcement model in database."""
    class Config:
        from_attributes = True


class Announcement(AnnouncementInDB):
    """Schema for Announcement model response."""
    pass


class AnnouncementWithDetails(Announcement):
    """Schema for Announcement with additional details."""
    author_name: str
    target_name: Optional[str] = None

