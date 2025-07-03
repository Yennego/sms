from sqlalchemy import Column, String, ForeignKey, Float, Integer, Date, Text, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
from datetime import date
import enum
# Remove this import as it's not available
# from sqlalchemy.sql.expression import foreign

from src.db.models.base import TenantModel

# Enum for grade types
class GradeType(str, enum.Enum):
    """Enum for grade types."""
    ASSIGNMENT = "assignment"
    QUIZ = "quiz"
    TEST = "test"
    EXAM = "exam"
    PROJECT = "project"
    PARTICIPATION = "participation"
    OTHER = "other"


class Grade(TenantModel):
    """Model representing a student's grade for a specific assessment.
    
    This model tracks a student's grade for an assignment, exam, or other assessment.
    
    Attributes:
        student_id (UUID): Foreign key to the student
        enrollment_id (UUID): Foreign key to the student's enrollment
        subject_id (UUID): Foreign key to the subject
        assessment_type (GradeType): Type of assessment (assignment, exam, etc.)
        assessment_id (UUID): Foreign key to the specific assessment (optional)
        score (Float): Numerical score achieved
        max_score (Float): Maximum possible score
        percentage (Float): Score as a percentage of max_score
        letter_grade (String): Letter grade (A, B, C, etc.)
        comments (Text): Additional comments about the grade
        graded_by (UUID): Foreign key to the teacher who graded the assessment
        graded_date (Date): Date when the assessment was graded
    """
    
    __tablename__ = "grades"
    
    # Relationships
    # In the Grade model
    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id"), nullable=False)
    student = relationship("Student", back_populates="grades", foreign_keys=[student_id])
    
    enrollment_id = Column(UUID(as_uuid=True), ForeignKey("enrollments.id"), nullable=False)
    enrollment = relationship("Enrollment", back_populates="grades")
    
    subject_id = Column(UUID(as_uuid=True), ForeignKey("subjects.id"), nullable=False)
    subject = relationship("Subject", back_populates="grades")
    
    # Assessment details
    assessment_type = Column(Enum(GradeType), nullable=False)
    # We need to remove the ForeignKey constraint since this can reference multiple tables
    assessment_id = Column(UUID(as_uuid=True), nullable=True)  # No explicit ForeignKey
    assessment_name = Column(String(255), nullable=False)
    assessment_date = Column(Date, nullable=False)
    
    # Grade details
    score = Column(Float, nullable=False)
    max_score = Column(Float, nullable=False)
    percentage = Column(Float, nullable=False)
    letter_grade = Column(String(10), nullable=True)
    comments = Column(Text, nullable=True)
    
    # Grading metadata
    graded_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    graded_date = Column(Date, nullable=False, default=date.today)
    
    # Fix the relationship to Assignment - use foreign_keys parameter
    assignment = relationship(
        "Assignment",
        primaryjoin="and_(Grade.assessment_type=='assignment', Grade.assessment_id==Assignment.id)",
        foreign_keys=[assessment_id],  # Explicitly specify the foreign key
        viewonly=True  # Make this a read-only relationship
    )
    
    # Similarly fix the relationship to Exam - use foreign_keys parameter
    exam = relationship(
        "Exam",
        primaryjoin="and_(Grade.assessment_type=='exam', Grade.assessment_id==Exam.id)",
        foreign_keys=[assessment_id],  # Explicitly specify the foreign key
        viewonly=True  # Make this a read-only relationship
    )
    
    def __repr__(self):
        return f"<Grade {self.student_id} - {self.subject_id} - {self.assessment_type} - {self.score}/{self.max_score}>"