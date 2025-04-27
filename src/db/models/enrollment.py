from sqlalchemy import Column, ForeignKey, UniqueConstraint, Date, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from src.db.models.base import TenantModel


class Enrollment(TenantModel):
    """Enrollment model to establish many-to-many relationship between students and classes with tenant isolation."""
    student_id = Column(UUID(as_uuid=True), ForeignKey("student.id"), nullable=False)
    class_id = Column(UUID(as_uuid=True), ForeignKey("class.id"), nullable=False)  # Note: class.id works because the table name is 'class' despite the file name being class_room.py
    enrollment_date = Column(Date, nullable=False)
    status = Column(String, nullable=False, default="active")  # active, inactive, completed
    
    # Add unique constraint per tenant for student-class combination
    __table_args__ = (
        UniqueConstraint('tenant_id', 'student_id', 'class_id', name='uq_enrollment_tenant_student_class'),
    )
    
    # Relationships
    student = relationship("Student")
    class_ = relationship("Class")  # References the Class model in class_room.py
    
    def __repr__(self):
        return f"<Enrollment {self.student_id} in {self.class_id}>"