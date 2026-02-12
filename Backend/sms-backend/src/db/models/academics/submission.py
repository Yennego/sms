from sqlalchemy import Column, String, ForeignKey, Text, DateTime, Enum, Index, Float
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB
from datetime import datetime
import enum

from src.db.models.base import TenantModel

class SubmissionStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    SUBMITTED = "SUBMITTED"
    GRADED = "GRADED"
    RETURNED = "RETURNED"

class Submission(TenantModel):
    """Model representing a student's submission for an assignment."""
    
    __tablename__ = "submissions"
    
    assignment_id = Column(UUID(as_uuid=True), ForeignKey("assignments.id"), nullable=False)
    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id"), nullable=False)
    
    content = Column(Text, nullable=True) # For text-based submissions
    attachment_url = Column(String, nullable=True) # For file attachment URL
    
    status = Column(Enum(SubmissionStatus), nullable=False, default=SubmissionStatus.SUBMITTED)
    submitted_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    
    # Grading fields
    score = Column(Float, nullable=True)  # Teacher's awarded score
    feedback = Column(Text, nullable=True)  # Teacher's feedback/comments
    
    # Relationships
    assignment = relationship("Assignment", backref="submissions")
    student = relationship("Student", backref="submissions")
    
    # If a grade is created for this submission, we can link it back or find it via Grade model
    # The Grade model already has assessment_id, which points to Assignment. 
    # We might want to link Grade to Submission directly too, but let's keep it simple for now.

    __table_args__ = (
        Index('ix_submissions_assignment_student', 'assignment_id', 'student_id'),
        Index('ix_submissions_tenant_assignment', 'tenant_id', 'assignment_id'),
    )
