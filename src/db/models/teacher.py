from sqlalchemy import Column, String, Date, ForeignKey, UniqueConstraint, Boolean
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from sqlalchemy.orm import relationship

from src.db.models.base import TenantModel


class Teacher(TenantModel):
    """Teacher model with tenant isolation."""
    first_name = Column(String, nullable=False)
    last_name = Column(String, nullable=False)
    email = Column(String, nullable=False)
    phone = Column(String, nullable=True)
    subjects = Column(ARRAY(String), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    
    # Add unique constraint per tenant for email
    _additional_table_args = (
        UniqueConstraint('tenant_id', 'email', name='uq_teacher_tenant_email'),
    )
    
    # Relationships
    classes = relationship("ClassRoom", back_populates="teacher")
    
    def __repr__(self):
        return f"<Teacher {self.first_name} {self.last_name}>"