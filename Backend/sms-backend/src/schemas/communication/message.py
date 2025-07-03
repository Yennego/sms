from datetime import datetime
from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel

from src.schemas.base.base import TimestampSchema, TenantSchema


class MessageRecipientBase(BaseModel):
    """Base schema for message recipient."""
    recipient_id: UUID
    is_read: bool = False
    read_at: Optional[datetime] = None


class MessageBase(BaseModel):
    """Base schema for Message model."""
    subject: str
    content: str
    sender_id: UUID
    parent_id: Optional[UUID] = None
    is_draft: bool = False
    sent_at: Optional[datetime] = None
    recipients: List[MessageRecipientBase] = []


class MessageCreate(MessageBase):
    """Schema for creating a new message."""
    sent_at: datetime = datetime.now()


class MessageUpdate(BaseModel):
    """Schema for updating a message."""
    subject: Optional[str] = None
    content: Optional[str] = None
    is_draft: Optional[bool] = None
    sent_at: Optional[datetime] = None


class MessageRecipientUpdate(BaseModel):
    """Schema for updating a message recipient."""
    is_read: Optional[bool] = None
    read_at: Optional[datetime] = None


class MessageRecipientInDB(MessageRecipientBase):
    """Schema for MessageRecipient in database."""
    message_id: UUID

    class Config:
        from_attributes = True


class MessageInDB(MessageBase, TenantSchema):
    """Schema for Message model in database."""
    class Config:
        from_attributes = True


class Message(MessageInDB):
    """Schema for Message model response."""
    pass


class MessageWithDetails(Message):
    """Schema for Message with additional details."""
    sender_name: str
    recipient_names: List[str] = []
    parent_subject: Optional[str] = None

