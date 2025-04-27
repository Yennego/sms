from sqlalchemy import Column, String, Integer, ForeignKey, UniqueConstraint, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from sqlalchemy import event
from sqlalchemy.orm import Session

from src.db.models.base import TenantModel


class ClassRoom(TenantModel):
    """ClassRoom model with tenant isolation."""
    __tablename__ = "classroom"
    name = Column(String, nullable=False)
    grade_level = Column(String, nullable=False)
    subject = Column(String, nullable=False)
    room_number = Column(String, nullable=True)
    max_capacity = Column(Integer, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    teacher_id = Column(UUID(as_uuid=True), ForeignKey("teacher.id"), nullable=True)
    
    # Add unique constraint per tenant for class name and grade level
    _additional_table_args = (
        UniqueConstraint('tenant_id', 'name', 'grade_level', name='uq_class_room_tenant_name_grade'),
    )
    
    # Relationships
    teacher = relationship("Teacher")
    
    def __repr__(self):
        return f"<ClassRoom {self.name} ({self.grade_level})>"

    # id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

@event.listens_for(Session, 'after_begin')
def receive_after_begin(session, transaction, connection):
    connection.engine.dispose()