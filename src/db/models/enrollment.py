from sqlalchemy import Column, ForeignKey, UniqueConstraint, Date, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from src.db.models.base import TenantModel


class Enrollment(TenantModel):
    """Enrollment model with tenant isolation."""
    student_id = Column(UUID(as_uuid=True), ForeignKey("student.id"), nullable=False)
    class_room_id = Column(UUID(as_uuid=True), ForeignKey("class_room.id"), nullable=False)
    enrollment_date = Column(Date, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    
    # Add unique constraint per tenant for student and class room
    _additional_table_args = (
        UniqueConstraint('tenant_id', 'student_id', 'class_room_id', name='uq_enrollment_tenant_student_class'),
    )
    
    # Relationships
    student = relationship("Student")
    class_room = relationship("ClassRoom")
    
    def __repr__(self):
        return f"<Enrollment {self.student_id} in {self.class_room_id}>"