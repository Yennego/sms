from typing import Optional, List, Any, Dict
from sqlalchemy import Column, String, ForeignKey, Float, Integer, Date, Text, Boolean, Index
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB
from datetime import date, datetime
# from sqlalchemy.sql.expression import foreign

from src.db.models.base import TenantModel
from src.db.models.academics.academic_year import AcademicYear


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
    
    academic_year_id = Column(UUID(as_uuid=True), ForeignKey("academic_years.id"), nullable=False)
    academic_year = relationship("AcademicYear")
    
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
    
    @property
    def subject_name(self) -> str:
        return self.subject.name if self.subject else "Unknown"

    @property
    def teacher_name(self) -> str:
        if self.teacher:
            return self.teacher.full_name or f"{self.teacher.first_name} {self.teacher.last_name}".strip() or "Unknown"
        return "Unknown"

    @property
    def grade_name(self) -> str:
        return self.grade.name if self.grade else "Unknown"

    @property
    def section_name(self) -> Optional[str]:
        return self.section.name if self.section else None

    def __repr__(self):
        return f"<Assignment {self.title} - {self.subject_id} - Due: {self.due_date}>"

    __table_args__ = (
        Index('ix_assignments_tenant_grade_section', 'tenant_id', 'grade_id', 'section_id'),
        Index('ix_assignments_tenant_teacher', 'tenant_id', 'teacher_id'),
        Index('ix_assignments_tenant_academic_year', 'tenant_id', 'academic_year_id'),
        Index('ix_assignments_tenant_published', 'tenant_id', 'is_published'),
    )