from sqlalchemy.orm import declared_attr, relationship

class RelationshipMixin:
    """Mixin for handling relationships in models.
    
    This mixin provides common relationship declarations that can be reused
    across different models.
    """
    
    @declared_attr
    def roles(cls):
        """Relationship with UserRole model."""
        return relationship("UserRole", secondary="user_role_association", back_populates="users")
    
    @declared_attr
    def student(cls):
        """One-to-one relationship with Student model."""
        return relationship("Student", back_populates="user", uselist=False)
    
    @declared_attr
    def teacher(cls):
        """One-to-one relationship with Teacher model."""
        return relationship("Teacher", back_populates="user", uselist=False)
    
    @declared_attr
    def parent(cls):
        """One-to-one relationship with Parent model."""
        return relationship("Parent", back_populates="user", uselist=False) 