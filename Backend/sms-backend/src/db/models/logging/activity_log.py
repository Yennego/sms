from sqlalchemy import Column, String, ForeignKey, JSON, Text
from sqlalchemy.dialects.postgresql import UUID

from src.db.models.base import TenantModel


class ActivityLog(TenantModel):
    """Model representing an activity log entry.
    
    This model tracks user activities and system events within a tenant.
    
    Attributes:
        user_id (UUID): Foreign key to the user who performed the action (optional)
        action (String): The action performed (e.g., 'create', 'update', 'delete', 'login')
        entity_type (String): The type of entity affected (e.g., 'user', 'student', 'grade')
        entity_id (UUID): The ID of the entity affected (optional)
        old_values (JSON): The previous values of the entity (for updates)
        new_values (JSON): The new values of the entity (for creates and updates)
        ip_address (String): The IP address of the user
        user_agent (Text): The user agent of the user's browser
    """
    
    __tablename__ = "activity_logs"
    
    # Activity details
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    action = Column(String(50), nullable=False)  # create, update, delete, login, etc.
    entity_type = Column(String(50), nullable=False)  # user, student, grade, etc.
    entity_id = Column(UUID(as_uuid=True), nullable=True)
    old_values = Column(JSON, nullable=True)
    new_values = Column(JSON, nullable=True)
    ip_address = Column(String(50), nullable=True)
    user_agent = Column(Text, nullable=True)
    
    def __repr__(self):
        return f"<ActivityLog {self.id} - {self.action} - {self.entity_type}>"