from sqlalchemy import Column, String, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
from src.db.models.auth.user import User
import uuid

class Admin(User):
    """Model representing an administrator in the system.
    
    Administrators have special privileges to manage the system.
    This class extends the base User class with admin-specific attributes.
    
    Attributes:
        department (str): The department this admin belongs to
        admin_level (str): The level of administrative access
    """
    
    __tablename__ = "admins"
    
    # Link to parent table
    id = Column(UUID(as_uuid=True), ForeignKey("users.id"), primary_key=True)
    
    # Admin-specific fields
    department = Column(String(100), nullable=True)
    admin_level = Column(String(50), nullable=True)
    
    __mapper_args__ = {
        "polymorphic_identity": "admin",
    }
    
    def __repr__(self):
        return f"<Admin {self.email}>"