from sqlalchemy import Column, String, ForeignKey, Float, Integer, Date, Text, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB
from datetime import date, datetime
# Remove this import as it's not available
# from sqlalchemy.sql.expression import foreign

from src.db.models.base import TenantModel


class Assignment(TenantModel):
    """Model representing an assignment given to students.
    
    This model tracks assignments given to students, including details about the assignment,
    due dates, and grading criteria.
    
    Attributes:
        title (String): Title of the assignment
        description (Text): Detailed description of the assignment
        subject_id (UUID): Foreign key to the subject
        teacher_id (UUID): Foreign key to the teacher who created the assignment
        grade_id (UUID): Foreign key to the grade level
        section_id (UUID): Foreign key to the section (optional)
        assigned_date (Date): Date when the assignment was assigned
        due_date (Date): Date when the assignment is due
        max_score (Float): Maximum possible score for the assignment
        weight (Float): Weight of the assignment in the overall grade calculation
        is_published (Boolean): Whether the assignment is published to students
        submission_type (String): Type of submission (online, physical, etc.)
        attachment_url (String): URL to any attached files
        rubric (JSONB): Rubric for grading the assignment
    """
    
    __tablename__ = "assignments"
    
    # Assignment details
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    
    # Relationships
    subject_id = Column(UUID(as_uuid=True), ForeignKey("subjects.id"), nullable=False)
    subject = relationship("Subject", back_populates="assignments")
    
    teacher_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    teacher = relationship("User", foreign_keys=[teacher_id])
    
    grade_id = Column(UUID(as_uuid=True), ForeignKey("academic_grades.id"), nullable=False)
    grade = relationship("AcademicGrade", back_populates="assignments")
    
    section_id = Column(UUID(as_uuid=True), ForeignKey("sections.id"), nullable=True)
    section = relationship("Section", back_populates="assignments")
    
    # Dates
    assigned_date = Column(Date, nullable=False, default=date.today)
    due_date = Column(Date, nullable=False)
    
    # Grading details
    max_score = Column(Float, nullable=False)
    weight = Column(Float, nullable=False, default=1.0)  # Default weight of 1
    
    # Publication status
    is_published = Column(Boolean, nullable=False, default=False)
    
    # Submission details
    submission_type = Column(String(50), nullable=False, default="online")
    attachment_url = Column(String(255), nullable=True)
    rubric = Column(JSONB, nullable=True)
    
    # Fix the relationship to Grade - use remote_side parameter
    grades = relationship(
        "Grade",
        primaryjoin="and_(Grade.assessment_type=='assignment', Grade.assessment_id==Assignment.id)",
        foreign_keys="[Grade.assessment_id]",  # Specify the foreign key as a string
        viewonly=True  # Make this a read-only relationship
    )
    
    def __repr__(self):
        return f"<Assignment {self.title} - {self.subject_id} - Due: {self.due_date}>"