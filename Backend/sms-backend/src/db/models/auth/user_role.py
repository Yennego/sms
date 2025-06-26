from sqlalchemy import Column, String, ForeignKey, Table
from sqlalchemy.orm import relationship, Mapped
from sqlalchemy.dialects.postgresql import UUID
from src.db.models.base import TimestampMixin, UUIDMixin, Base
from typing import List

# Association table for many-to-many relationship between User and Role
user_role_association = Table(
    'user_role_association',
    Base.metadata,
    Column('user_id', UUID, ForeignKey('users.id', ondelete='CASCADE'), primary_key=True),
    Column('role_id', UUID, ForeignKey('user_roles.id', ondelete='CASCADE'), primary_key=True)
)

class UserRole(Base, TimestampMixin, UUIDMixin):
    """Model representing a user role in the system.
    
    Roles define what actions a user can perform in the system.
    Users can have multiple roles.
    
    Attributes:
        name (str): Name of the role (e.g., 'admin', 'teacher', 'student', 'parent')
        description (str): Description of the role
        users (List[User]): Users that have this role
        permissions (List[Permission]): Permissions associated with this role
    """
    
    __tablename__ = "user_roles"
    
    name = Column(String(50), nullable=False, unique=True, comment="Name of the role")
    description = Column(String(200), nullable=True, comment="Description of the role")
    
    # Relationships
    users = relationship("User", secondary=user_role_association, back_populates="roles")
    
    permissions = relationship(
        "Permission",
        secondary="permission_role",
        back_populates="roles"
    )

    def __init__(self, **kwargs):
        """Initialize a user role with validation.
        
        Args:
            name (str): Name of the role
            description (str, optional): Description of the role
            
        Raises:
            ValueError: If required fields are missing or invalid
        """
        if not kwargs.get("name"):
            raise ValueError("name is required for user role")
            
        super().__init__(**kwargs)
    
    def __repr__(self):
        return f"<UserRole {self.name}>"
