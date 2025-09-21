from sqlalchemy import Column, String, ForeignKey, Date, Boolean, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
from datetime import date

from src.db.models.base import TenantModel

class ClassEnrollment(TenantModel):
    """Model representing a student's enrollment in a specific class.
    
    This model creates a many-to-many relationship between students and classes,
    allowing proper tracking of which students are enrolled in which classes
    for attendance and academic purposes.
    
    Attributes:
        student_id (UUID): Foreign key to the student
        class_id (UUID): Foreign key to the class
        academic_year_id (UUID): Foreign key to the academic year
        enrollment_date (Date): Date when the student was enrolled in the class
        status (String): Enrollment status (active, dropped, completed)
        is_active (Boolean): Whether the enrollment is currently active
        drop_date (Date): Date when the student dropped the class (if applicable)
        completion_date (Date): Date when the student completed the class
    """
    
    __tablename__ = "class_enrollments"
    
    # Core relationships
    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id"), nullable=False)
    class_id = Column(UUID(as_uuid=True), ForeignKey("classes.id"), nullable=False)
    academic_year_id = Column(UUID(as_uuid=True), ForeignKey("academic_years.id"), nullable=False)
    
    # Enrollment details
    enrollment_date = Column(Date, nullable=False, default=date.today)
    status = Column(String(20), nullable=False, default="active")  # active, dropped, completed
    is_active = Column(Boolean, nullable=False, default=True)
    
    # Optional dates for status changes
    drop_date = Column(Date, nullable=True)
    completion_date = Column(Date, nullable=True)
    
    # Relationships
    student = relationship("Student", back_populates="class_enrollments")
    class_obj = relationship("Class", back_populates="student_enrollments")
    academic_year = relationship("AcademicYear", back_populates="class_enrollments")
    
    # Ensure a student can only be enrolled once per class per academic year
    __table_args__ = (
        UniqueConstraint('student_id', 'class_id', 'academic_year_id', name='unique_student_class_year'),
    )
    
    def drop_class(self, drop_date: date = None):
        """Mark the enrollment as dropped."""
        self.status = "dropped"
        self.is_active = False
        self.drop_date = drop_date or date.today()
    
    def complete_class(self, completion_date: date = None):
        """Mark the enrollment as completed."""
        self.status = "completed"
        self.is_active = False
        self.completion_date = completion_date or date.today()
    
    def reactivate(self):
        """Reactivate a dropped enrollment."""
        if self.status == "dropped":
            self.status = "active"
            self.is_active = True
            self.drop_date = None
    
    def __repr__(self):
        return f"<ClassEnrollment Student:{self.student_id} Class:{self.class_id} Status:{self.status}>"