from sqlalchemy import Column, String, ForeignKey, Text, Boolean, DateTime, Table
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from src.db.models.base import TenantModel, Base


# Association table for message recipients
message_recipient = Table(
    'message_recipients',
    Base.metadata,
    Column('message_id', UUID(as_uuid=True), ForeignKey('messages.id'), primary_key=True),
    Column('recipient_id', UUID(as_uuid=True), ForeignKey('users.id'), primary_key=True),
    Column('is_read', Boolean, nullable=False, default=False),
    Column('read_at', DateTime(timezone=True), nullable=True)
)


class Message(TenantModel):
    """Model representing a message in the system.
    
    This model tracks messages sent between users, including details about the message,
    its status, and the users involved.
    
    Attributes:
        subject (String): Subject of the message
        content (Text): Content of the message
        sender_id (UUID): Foreign key to the user who sent the message
        parent_id (UUID): Foreign key to the parent message (for threaded conversations)
        is_draft (Boolean): Whether the message is a draft
        sent_at (DateTime): Date when the message was sent
    """
    
    __tablename__ = "messages"
    
    # Message details
    subject = Column(String(255), nullable=False)
    content = Column(Text, nullable=False)
    
    # Sender relationship
    sender_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    sender = relationship("User")
    
    # Parent message for threaded conversations
    parent_id = Column(UUID(as_uuid=True), ForeignKey("messages.id"), nullable=True)
    replies = relationship("Message", backref="parent", remote_side="Message.id")
    
    # Recipients through association table
    recipients = relationship("User", secondary=message_recipient)
    
    # Status and dates
    is_draft = Column(Boolean, nullable=False, default=False)
    sent_at = Column(DateTime(timezone=True), nullable=True)
    
    def __repr__(self):
        return f"<Message {self.id} - {self.subject}>"