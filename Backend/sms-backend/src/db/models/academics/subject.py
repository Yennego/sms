from sqlalchemy import Column, String, ForeignKey, Text, Boolean, Integer, UniqueConstraint, Index
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
from src.db.models.base import TenantModel

class Subject(TenantModel):
    """Model representing a subject taught in the school."""
    __tablename__ = "subjects"
    __table_args__ = (
        UniqueConstraint('tenant_id', 'name', name='uq_subject_tenant_name'),
        Index('ix_subject_tenant_active_name', 'tenant_id', 'is_active', 'name'),
    )

    name = Column(String(255), nullable=False)
    code = Column(String(50), nullable=False)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    credits = Column(Integer, nullable=False, default=1)
    
    # Relationships to other models
    assignments = relationship("Assignment", back_populates="subject")
    exams = relationship("Exam", back_populates="subject")
    grades = relationship("Grade", back_populates="subject")
    
    def __repr__(self):
        return f"<Subject {self.name} - {self.code}>"