from sqlalchemy import Column, String, ForeignKey, Float, Integer, Date, Text, Boolean, Time
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB
from datetime import date, time

from src.db.models.base import TenantModel


class Exam(TenantModel):
    """Model representing an exam given to students.
    
    This model tracks exams given to students, including details about the exam,
    dates, times, and grading criteria.
    
    Attributes:
        title (String): Title of the exam
        description (Text): Detailed description of the exam
        subject_id (UUID): Foreign key to the subject
        teacher_id (UUID): Foreign key to the teacher who created the exam
        grade_id (UUID): Foreign key to the grade level
        section_id (UUID): Foreign key to the section (optional)
        exam_date (Date): Date when the exam will be held
        start_time (Time): Time when the exam starts
        end_time (Time): Time when the exam ends
        max_score (Float): Maximum possible score for the exam
        weight (Float): Weight of the exam in the overall grade calculation
        is_published (Boolean): Whether the exam is published to students
        location (String): Location where the exam will be held
        instructions (Text): Instructions for the exam
    """
    
    __tablename__ = "exams"
    
    # Exam details
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    
    # Relationships
    subject_id = Column(UUID(as_uuid=True), ForeignKey("subjects.id"), nullable=False)
    subject = relationship("Subject", back_populates="exams")
    
    teacher_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    teacher = relationship("User", foreign_keys=[teacher_id])
    
    grade_id = Column(UUID(as_uuid=True), ForeignKey("academic_grades.id"), nullable=False)
    grade = relationship("AcademicGrade", back_populates="exams")
    
    section_id = Column(UUID(as_uuid=True), ForeignKey("sections.id"), nullable=True)
    section = relationship("Section", back_populates="exams")
    
    # Dates and times
    exam_date = Column(Date, nullable=False)
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)
    
    # Grading details
    max_score = Column(Float, nullable=False)
    weight = Column(Float, nullable=False, default=1.0)  # Default weight of 1
    
    # Publication status
    is_published = Column(Boolean, nullable=False, default=False)
    
    # Additional details
    location = Column(String(255), nullable=True)
    instructions = Column(Text, nullable=True)
    
    # Fix the relationship to Grade - use remote_side parameter
    grades = relationship(
        "Grade",
        primaryjoin="and_(Grade.assessment_type=='exam', Grade.assessment_id==Exam.id)",
        foreign_keys="[Grade.assessment_id]",  # Specify the foreign key as a string
        viewonly=True  # Make this a read-only relationship
    )
    
    def __repr__(self):
        return f"<Exam {self.title} - {self.subject_id} - Date: {self.exam_date}>"