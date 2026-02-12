from sqlalchemy import Column, String, ForeignKey, Float, Date, Text, Boolean, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
from datetime import date

from src.db.models.base import TenantModel
from src.db.models.academics.grade import GradeType


class Assessment(TenantModel):
    """Model representing a generic academic assessment (Quiz, Test, Project, etc.).
    
    This model tracks assessments that aren't strictly 'Assignments' or 'Exams',
    allowing for flexible grading within the academic system.
    """
    
    __tablename__ = "assessments"
    
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    type = Column(Enum(GradeType), nullable=False, default=GradeType.QUIZ)
    
    # Relationships
    subject_id = Column(UUID(as_uuid=True), ForeignKey("subjects.id"), nullable=False)
    subject = relationship("Subject")
    
    teacher_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    teacher = relationship("User")
    
    academic_year_id = Column(UUID(as_uuid=True), ForeignKey("academic_years.id"), nullable=False)
    academic_year = relationship("AcademicYear")
    
    grade_id = Column(UUID(as_uuid=True), ForeignKey("academic_grades.id"), nullable=False)
    grade = relationship("AcademicGrade")
    
    section_id = Column(UUID(as_uuid=True), ForeignKey("sections.id"), nullable=True)
    section = relationship("Section")
    
    class_id = Column(UUID(as_uuid=True), ForeignKey("classes.id"), nullable=True)
    class_obj = relationship("Class", backref="assessments")
    
    grading_category_id = Column(UUID(as_uuid=True), ForeignKey("grading_categories.id"), nullable=True)
    grading_category = relationship("GradingCategory", backref="assessments")
    
    # Details
    assessment_date = Column(Date, nullable=False, default=date.today)
    max_score = Column(Float, nullable=False, default=100.0)
    is_published = Column(Boolean, nullable=False, default=False)
    
    # Relationship to Grade records
    grades = relationship(
        "Grade",
        primaryjoin="and_(Grade.assessment_type == Assessment.type, Grade.assessment_id == Assessment.id)",
        foreign_keys="[Grade.assessment_id]",
        viewonly=True
    )
    
    def __repr__(self):
        return f"<Assessment {self.title} ({self.type}) - {self.subject_id}>"
