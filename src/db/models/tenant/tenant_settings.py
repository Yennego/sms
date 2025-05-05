from uuid import uuid4
from sqlalchemy import Column, String, ForeignKey, JSON, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
from src.db.models.base import TimestampMixin, UUIDMixin, Base

class TenantSettings(Base, TimestampMixin, UUIDMixin):
    """Model representing settings for a tenant.
    
    Each tenant has its own settings that control various aspects of the system.
    Settings are stored in a JSON field for flexibility.
    
    Attributes:
        tenant_id (UUID): Foreign key to the tenant
        theme (str): UI theme for the tenant
        settings (dict): JSON field containing all tenant settings
        is_active (bool): Whether the tenant settings are active
        tenant (Tenant): Back reference to the tenant
    """
    
    __tablename__ = "tenant_settings"
    
    tenant_id = Column(UUID, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    theme = Column(String(20), nullable=False, default="light")
    settings = Column(JSON, nullable=False, default=dict)
    is_active = Column(Boolean, nullable=False, default=True)
    
    # Relationships
    tenant = relationship("Tenant", back_populates="settings")
    
    # Valid themes
    VALID_THEMES = ["light", "dark", "system"]
    
    # Default settings structure
    DEFAULT_SETTINGS = {
        "academic_year": {
            "start_month": 9,
            "end_month": 6
        },
        "features": {
            "enable_parent_portal": True,
            "enable_sms_notifications": False
        },
        "system": {
            "timezone": "UTC"
        }
    }
    
    def __init__(self, **kwargs):
        """Initialize tenant settings with validation.
        
        Args:
            tenant_id (UUID): ID of the tenant
            theme (str, optional): UI theme. Must be one of VALID_THEMES
            settings (dict, optional): Additional settings
            is_active (bool, optional): Whether the settings are active. Defaults to True.
            
        Raises:
            ValueError: If tenant_id is missing or theme is invalid
        """
        if not kwargs.get("tenant_id"):
            raise ValueError("tenant_id is required for tenant settings")
            
        if "theme" in kwargs and kwargs["theme"] not in self.VALID_THEMES:
            raise ValueError(f"theme must be one of: {', '.join(self.VALID_THEMES)}")
            
        # Initialize default settings
        if "settings" not in kwargs:
            kwargs["settings"] = self.DEFAULT_SETTINGS.copy()
        else:
            # Merge provided settings with defaults
            settings = self.DEFAULT_SETTINGS.copy()
            settings.update(kwargs["settings"])
            kwargs["settings"] = settings
            
        super().__init__(**kwargs)
    
    def update_setting(self, section: str, key: str, value: any) -> None:
        """Update a specific setting.
        
        Args:
            section (str): Settings section (e.g., "features", "system")
            key (str): Setting key within the section
            value (any): New value for the setting
            
        Raises:
            ValueError: If section or key is invalid
        """
        if section not in self.settings:
            raise ValueError("Invalid settings section")
            
        if key not in self.settings[section]:
            raise ValueError("Invalid setting key")
            
        self.settings[section][key] = value
    
    def __repr__(self):
        return f"<TenantSettings for tenant {self.tenant_id}>"
