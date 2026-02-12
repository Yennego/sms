from uuid import UUID


from sqlalchemy import Column, String, ForeignKey, Date, Boolean, Float
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
from src.db.models.base import TenantModel

class RemedialSession(TenantModel):
    __tablename__ = "remedial_sessions"

    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id"), nullable=False)
    enrollment_id = Column(UUID(as_uuid=True), ForeignKey("enrollments.id"), nullable=False)
    subject_id = Column(UUID(as_uuid=True), ForeignKey("subjects.id"), nullable=False)
    academic_year_id = Column(UUID(as_uuid=True), ForeignKey("academic_years.id"), nullable=False)

    scheduled_date = Column(Date, nullable=False)
    status = Column(String(20), nullable=False, default="scheduled")
    new_score = Column(Float, nullable=True)
    passed = Column(Boolean, nullable=True)

    # Relationships
    student = relationship("Student", backref="remedial_sessions")
    subject = relationship("Subject")
    enrollment = relationship("Enrollment")

    @property
    def student_name(self) -> str:
        return self.student.full_name if self.student else "Unknown"

    @property
    def subject_name(self) -> str:
        return self.subject.name if self.subject else "Unknown"