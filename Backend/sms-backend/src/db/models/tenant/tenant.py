from uuid import uuid4
from sqlalchemy import Column, String, Boolean, Index, LargeBinary, func
from sqlalchemy.orm import deferred, relationship
from sqlalchemy.dialects.postgresql import UUID
from src.db.models.base import TimestampMixin, UUIDMixin, Base
# from datetime import datetime, timezone

class Tenant(Base, TimestampMixin, UUIDMixin):
    """Model representing a tenant in the multi-tenant system.
    
    A tenant is a separate organization or entity that uses the system.
    Each tenant has its own isolated data and settings.
    
    Attributes:
        name (str): Name of the tenant
        code (str): Unique uppercase code for the tenant
        is_active (bool): Whether the tenant is active
        domain (str): Optional domain for the tenant
        subdomain (str): Optional subdomain for the tenant
        logo (str): Optional logo URL for the tenant
        primary_color (str): Optional primary color for branding
        secondary_color (str): Optional secondary color for branding
        settings (TenantSettings): One-to-one relationship with tenant settings
    """
    
    __tablename__ = "tenants"
    
    name = Column(String(100), nullable=False, comment="Name of the tenant")
    code = Column(String(10), nullable=False, comment="Unique uppercase code for the tenant")
    is_active = Column(Boolean, nullable=False, default=True, comment="Whether the tenant is active")
    
    # Additional fields for frontend compatibility
    domain = Column(String(255), unique=True, nullable=True, comment="Domain for the tenant")
    subdomain = Column(String(100), nullable=True, comment="Subdomain for the tenant")

    # School addresses are matched without regard to case, so they're unique that way too
    __table_args__ = (
        Index("uq_tenants_domain_lower", func.lower(domain), unique=True),
        Index("uq_tenants_subdomain_lower", func.lower(subdomain), unique=True),
    )
    logo = Column(String(500), nullable=True, comment="Logo URL for the tenant")
    # An uploaded logo (PNG, School profile page), served at GET /tenants/{id}/logo; logo then points there.
    # Deferred: tenants are loaded on every request and the bytes are only read by that endpoint.
    logo_image = deferred(Column(LargeBinary, nullable=True))
    primary_color = Column(String(7), nullable=True, comment="Primary color for branding (hex)")
    secondary_color = Column(String(7), nullable=True, comment="Secondary color for branding (hex)")

    # Billing (what the school pays the platform and its access state) is in
    # school_subscriptions and the platform_* tables (models/billing)

    # Relationships
    settings = relationship("TenantSettings", back_populates="tenant", uselist=False, cascade="all, delete-orphan")
    notification_config = relationship("TenantNotificationConfig", back_populates="tenant", uselist=False, cascade="all, delete-orphan")
    
    def __init__(self, **kwargs):
        """Initialize a tenant with the given attributes.
        
        Args:
            name (str): Name of the tenant
            code (str): Unique code for the tenant (will be converted to uppercase)
            is_active (bool, optional): Whether the tenant is active. Defaults to True.
            
        Raises:
            ValueError: If name or code is empty or invalid
        """
        if not kwargs.get("name"):
            raise ValueError("name is required for tenant")
        
        if not kwargs.get("code"):
            raise ValueError("code is required for tenant")
        
        # Validate name length
        if len(kwargs["name"]) < 3:
            raise ValueError("tenant name must be at least 3 characters long")
        
        # Convert code to uppercase
        kwargs["code"] = kwargs["code"].upper()
        
        # Validate code length
        if len(kwargs["code"]) < 2:
            raise ValueError("tenant code must be at least 2 characters long")
        
        # Validate code format (alphanumeric, no spaces)
        if not kwargs["code"].isalnum():
            raise ValueError("tenant code can only contain alphanumeric characters")
        
        super().__init__(**kwargs)
    
    def __repr__(self):
        return f"<Tenant {self.code}: {self.name}>"

        
