from sqlalchemy import Column, String, Boolean, DateTime, JSON, ForeignKey, Table, Integer
from sqlalchemy.orm import relationship, Mapped
from sqlalchemy.sql import func
from sqlalchemy.dialects.postgresql import UUID
from src.db.models.base import Base, TimestampMixin, UUIDMixin
from src.db.models.auth.user_role import user_role_association
from src.db.models.communication.notification import Notification  # Add this import
from typing import List, Optional
import uuid

# Remove this redundant table definition
# user_role = Table(
#     'user_role',
#     Base.metadata,
#     Column('user_id', ForeignKey('users.id'), primary_key=True),
#     Column('role_id', ForeignKey('user_roles.id'), primary_key=True)
# )

# Remove this floating relationship definition
# roles = relationship("UserRole", secondary=user_role_association, back_populates="users")

class User(Base, TimestampMixin, UUIDMixin):
    """Model representing a user in the system.
    
    Users can be students, teachers, parents, or administrators.
    Each user has a unique email and can have multiple roles.
    
    Attributes:
        email (str): Unique email address
        password_hash (str): Hashed password
        first_name (str): User's first name
        last_name (str): User's last name
        is_active (bool): Whether the user is active
        last_login (datetime): Last login timestamp
        roles (list[UserRole]): User's roles
        tenant_id (UUID): ID of the tenant the user belongs to
    """
    
    __tablename__ = "users"
    
    # Primary key
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Tenant relationship
    tenant_id = Column(UUID(as_uuid=True), nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # User fields
    email = Column(String(255), nullable=False, unique=True, comment="User's email address")
    password_hash = Column(String(255), nullable=False)
    first_name = Column(String(100), nullable=False, comment="User's first name")
    last_name = Column(String(100), nullable=False, comment="User's last name")
    is_active = Column(Boolean, nullable=False, default=True, server_default='true', comment="Whether the user is active")
    is_first_login = Column(Boolean, nullable=False, default=True, server_default='true', comment="Whether this is the user's first login")
    last_login = Column(DateTime(timezone=True))
    profile_picture = Column(String(255))
    phone_number = Column(String(20))
    preferences = Column(JSON, default=dict)
    
    # Discriminator column for polymorphic inheritance
    type = Column(String(50), nullable=False)
    
    __mapper_args__ = {
        'polymorphic_identity': 'user',
        'polymorphic_on': type
    }
    
    # Relationships
    # Update this to use user_role_association
    roles = relationship("UserRole", secondary=user_role_association, back_populates="users")
    # In the relationships section
    notifications = relationship("Notification", back_populates="user")
    password_expiry_date = Column(DateTime, nullable=True, comment="Date when the password expires")

    def __init__(self, **kwargs):
        """Initialize a user with validation.
        
        Args:
            email (str): User's email address
            password_hash (str): Hashed password
            first_name (str): User's first name
            last_name (str): User's last name
            is_active (bool, optional): Whether the user is active. Defaults to True.
            tenant_id (UUID): ID of the tenant the user belongs to
            
        Raises:
            ValueError: If required fields are missing or invalid
        """
        if not kwargs.get("email"):
            raise ValueError("email is required for user")
        if not kwargs.get("password_hash"):
            raise ValueError("password_hash is required for user")
        if not kwargs.get("first_name"):
            raise ValueError("first_name is required for user")
        if not kwargs.get("last_name"):
            raise ValueError("last_name is required for user")
        if not kwargs.get("tenant_id"):
            raise ValueError("tenant_id is required for user")
            
        # Set default value for is_active if not provided
        if 'is_active' not in kwargs:
            kwargs['is_active'] = True
            
        super().__init__(**kwargs)
    
    def __repr__(self):
        return f"<User {self.email}>"


