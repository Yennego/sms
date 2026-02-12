from sqlalchemy import Column, String, ForeignKey, Date, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from datetime import date

from src.db.models.base import TenantModel

class PromotionStatus(TenantModel):
    __tablename__ = "promotion_status"

    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id"), nullable=False)
    enrollment_id = Column(UUID(as_uuid=True), ForeignKey("enrollments.id"), nullable=False)
    academic_year_id = Column(UUID(as_uuid=True), ForeignKey("academic_years.id"), nullable=False)

    status = Column(String(20), nullable=False)  # Eligible, Conditional, Repeating, Graduated, Promoted, Remedial
    next_grade_id = Column(UUID(as_uuid=True), ForeignKey("academic_grades.id"), nullable=True)
    next_section_id = Column(UUID(as_uuid=True), ForeignKey("sections.id"), nullable=True)
    next_class_id = Column(UUID(as_uuid=True), ForeignKey("classes.id"), nullable=True)

    failed_subject_ids = Column(JSONB, nullable=True)
    total_score = Column(String(32), nullable=True)
    promotion_date = Column(Date, default=date.today, nullable=True)
    notes = Column(Text, nullable=True)