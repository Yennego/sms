from sqlalchemy import Column, String, ForeignKey, Text, Boolean, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
# from datetime import datetime
from sqlalchemy import DateTime, func

from src.db.models.base import Base, UUIDMixin


class Notification(Base, UUIDMixin):
    """Model representing a notification sent to users.
    
    This model tracks notifications sent to users, including details about the notification,
    its status, and the user it was sent to.
    
    Attributes:
        user_id (UUID): Foreign key to the user who received the notification
        title (String): Title of the notification
        message (Text): Content of the notification
        notification_type (String): Type of notification (e.g., 'email', 'sms', 'in-app')
        status (String): Status of the notification (e.g., 'sent', 'delivered', 'read')
        is_read (Boolean): Whether the notification has been read
        metadata (JSON): Additional metadata about the notification
    """
    
    __tablename__ = "notifications"
    
    # Notification details
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    user = relationship("User", back_populates="notifications")
    
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    notification_type = Column(String(50), nullable=False)  # email, sms, in-app
    status = Column(String(50), nullable=False, default="pending")  # pending, sent, delivered, read, failed
    is_read = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    notification_metadata = Column(JSON, nullable=True)  # Additional data like links, buttons, etc.
    
    def __repr__(self):
        return f"<Notification {self.id} - {self.title} - {self.notification_type}>"

