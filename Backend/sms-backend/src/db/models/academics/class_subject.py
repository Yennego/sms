from sqlalchemy import Column, String, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.ext.hybrid import hybrid_property
from sqlalchemy.dialects.postgresql import UUID

from src.db.models.base import TenantModel

class ClassSubject(TenantModel):
    """Model linking a Class to a Subject and its assigned Teacher.
    
    This model decouples subjects and teachers from the primary Class model,
    allowing a Class (Grade + Section) to have multiple subjects, each with
    its own assigned teacher and grading schema.
    """
    
    __tablename__ = "class_subjects"
    
    # Foreign Keys
    class_id = Column(UUID(as_uuid=True), ForeignKey("classes.id", ondelete="CASCADE"), nullable=False)
    subject_id = Column(UUID(as_uuid=True), ForeignKey("subjects.id", ondelete="CASCADE"), nullable=False)
    teacher_id = Column(UUID(as_uuid=True), ForeignKey("teachers.id", ondelete="SET NULL"), nullable=True)
    grading_schema_id = Column(UUID(as_uuid=True), ForeignKey("grading_schemas.id", ondelete="SET NULL"), nullable=True)
    
    # Relationships
    class_obj = relationship("Class", back_populates="subjects")
    subject = relationship("Subject", lazy="joined")
    teacher = relationship("Teacher", lazy="joined")
    grading_schema = relationship("GradingSchema", back_populates="class_subjects")
    
    # Computed properties for serialization
    @hybrid_property
    def subject_name(self) -> str:
        """Get the name of the subject."""
        return self.subject.name if self.subject else None
    
    @hybrid_property
    def teacher_name(self) -> str:
        """Get the full name of the teacher."""
        if self.teacher:
            return f"{self.teacher.first_name or ''} {self.teacher.last_name or ''}".strip() or None
        return None
    
    __table_args__ = (
        UniqueConstraint('class_id', 'subject_id', name='unique_class_subject'),
    )
    
    def __repr__(self):
        return f"<ClassSubject Class: {self.class_id} - Subject: {self.subject_id}>"

