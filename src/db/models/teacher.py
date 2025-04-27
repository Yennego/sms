from sqlalchemy import Column, String, Date, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from src.db.models.base import TenantModel


class Teacher(TenantModel):
    """Teacher model with tenant isolation."""
    first_name = Column(String, nullable=False)
    last_name = Column(String, nullable=False)
    email = Column(String, nullable=False, index=True)
    phone = Column(String, nullable=True)
    hire_date = Column(Date, nullable=True)
    subject_specialty = Column(String, nullable=True)
    teacher_id = Column(String, nullable=False, index=True)  # School-assigned ID
    
    # Add unique constraint per tenant for teacher_id and email
    __table_args__ = (
        UniqueConstraint('tenant_id', 'teacher_id', name='uq_teacher_tenant_teacher_id'),
        UniqueConstraint('tenant_id', 'email', name='uq_teacher_tenant_email'),
    )
    
    def __repr__(self):
        return f"<Teacher {self.first_name} {self.last_name}>"