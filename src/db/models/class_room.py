from sqlalchemy import Column, String, Integer, ForeignKey, UniqueConstraint, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from src.db.models.base import TenantModel


class Class(TenantModel):
    """Class model with tenant isolation."""
    name = Column(String, nullable=False)
    grade_level = Column(String, nullable=False)
    subject = Column(String, nullable=False)
    room_number = Column(String, nullable=True)
    max_capacity = Column(Integer, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    teacher_id = Column(UUID(as_uuid=True), ForeignKey("teacher.id"), nullable=True)
    
    # Add unique constraint per tenant for class name and grade level
    __table_args__ = (
        UniqueConstraint('tenant_id', 'name', 'grade_level', name='uq_class_tenant_name_grade'),
    )
    
    # Relationships
    teacher = relationship("Teacher")
    
    def __repr__(self):
        return f"<Class {self.name} ({self.grade_level})>"