from sqlalchemy import Column, String, ForeignKey, JSON, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from src.db.models.base import Base, TimestampMixin, UUIDMixin


class SuperAdminActivityLog(Base, TimestampMixin, UUIDMixin):
    """Model representing super-admin activity log entries.
    
    This model tracks super-admin activities across the entire platform,
    without tenant isolation. Super-admin operations are logged separately
    from regular tenant-based activities.
    
    Attributes:
        user_id (UUID): Foreign key to the super-admin user who performed the action
        action (String): The action performed (e.g., 'create_tenant', 'delete_user', 'view_logs')
        entity_type (String): The type of entity affected (e.g., 'tenant', 'user', 'system')
        entity_id (UUID): The ID of the entity affected (optional)
        target_tenant_id (UUID): Which tenant was affected by the action (optional)
        old_values (JSON): The previous values of the entity (for updates)
        new_values (JSON): The new values of the entity (for creates and updates)
        ip_address (String): The IP address of the super-admin
        user_agent (Text): The user agent of the super-admin's browser
        details (Text): Additional details about the action
    """
    
    __tablename__ = "super_admin_activity_logs"
    
    # Activity details
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    action = Column(String(50), nullable=False)  # create_tenant, delete_user, view_logs, etc.
    entity_type = Column(String(50), nullable=False)  # tenant, user, system, etc.
    entity_id = Column(UUID(as_uuid=True), nullable=True)
    target_tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=True)  # Which tenant was affected
    old_values = Column(JSON, nullable=True)
    new_values = Column(JSON, nullable=True)
    ip_address = Column(String(50), nullable=True)
    user_agent = Column(Text, nullable=True)
    details = Column(Text, nullable=True)  # Additional context
    
    # Relationships
    user = relationship("User", foreign_keys=[user_id])
    target_tenant = relationship("Tenant", foreign_keys=[target_tenant_id])
    
    def __repr__(self):
        return f"<SuperAdminActivityLog {self.id} - {self.action} - {self.entity_type}>"