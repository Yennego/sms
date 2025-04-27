from sqlalchemy import Column, String, Date, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from src.db.models.base import TenantModel


class Student(TenantModel):
    """Student model with tenant isolation."""
    first_name = Column(String, nullable=False)
    last_name = Column(String, nullable=False)
    date_of_birth = Column(Date, nullable=True)
    enrollment_date = Column(Date, nullable=True)
    grade_level = Column(String, nullable=True)
    student_id = Column(String, nullable=False, index=True)  # School-assigned ID
    parent_email = Column(String, nullable=True)
    parent_phone = Column(String, nullable=True)
    address = Column(String, nullable=True)
    
    # Add unique constraint per tenant for student_id
    _additional_table_args = (
        UniqueConstraint('tenant_id', 'student_id', name='uq_student_tenant_student_id'),
    )
    
    def __repr__(self):
        return f"<Student {self.first_name} {self.last_name}>"