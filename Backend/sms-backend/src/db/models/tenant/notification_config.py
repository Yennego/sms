from sqlalchemy import Column, String, Boolean, Text, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
from src.db.models.base import TenantModel

class TenantNotificationConfig(TenantModel):
    __tablename__ = "tenant_notification_configs"
    
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    
    # WhatsApp Configuration
    whatsapp_enabled = Column(Boolean, default=True)
    admin_whatsapp_number = Column(String, nullable=True)
    school_name = Column(String, nullable=False)
    
    # Message Templates
    teacher_welcome_template = Column(Text, nullable=True)
    student_welcome_template = Column(Text, nullable=True)
    parent_welcome_template = Column(Text, nullable=True)
    
    # Notification Settings
    notify_admin_on_user_creation = Column(Boolean, default=True)
    notify_parents_on_student_creation = Column(Boolean, default=True)
    
    # Relationships
    tenant = relationship("Tenant", back_populates="notification_config")