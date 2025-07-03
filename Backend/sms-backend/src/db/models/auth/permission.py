from sqlalchemy import Column, String, Table, ForeignKey
from sqlalchemy.orm import relationship, Mapped
from typing import List
from src.db.models.auth.user_role import UserRole
from src.db.models.base import Base, TimestampMixin, UUIDMixin

# Association table for many-to-many relationship between permissions and roles
permission_role = Table(
    'permission_role',
    Base.metadata,
    Column('permission_id', ForeignKey('permissions.id'), primary_key=True),
    Column('role_id', ForeignKey('user_roles.id'), primary_key=True)
)

class Permission(Base, TimestampMixin, UUIDMixin):
    """
    Permission model for defining access control permissions in the system.
    """
    __tablename__ = 'permissions'

    name: Mapped[str] = Column(String(100), unique=True, nullable=False)
    description: Mapped[str] = Column(String(255), nullable=True)

    # Relationships
    roles: Mapped[List["UserRole"]] = relationship(
        "UserRole",
        secondary=permission_role,
        back_populates="permissions"
    )

    def __init__(self, **kwargs):
        """Initialize a permission with validation.
        
        Args:
            name (str): Name of the permission
            description (str, optional): Description of the permission
            
        Raises:
            ValueError: If required fields are missing or invalid
        """
        if not kwargs.get("name"):
            raise ValueError("name is required for permission")
            
        super().__init__(**kwargs)
    
    def __repr__(self):
        return f"<Permission {self.name}>" 

