from sqlalchemy import Column, String, ForeignKey, Integer, Boolean, Enum
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship

from src.db.models.base import TenantModel

class AggregateMethod(str, Enum):
    average = "average"
    weighted = "weighted"

class PromotionCriteria(TenantModel):
    __tablename__ = "promotion_criteria"

    academic_year_id = Column(UUID(as_uuid=True), ForeignKey("academic_years.id"), nullable=False)
    grade_id = Column(UUID(as_uuid=True), ForeignKey("academic_grades.id"), nullable=False)

    passing_mark = Column(Integer, nullable=False, default=70)
    min_passed_subjects = Column(Integer, nullable=True)
    require_core_pass = Column(Boolean, nullable=False, default=True)

    core_subject_ids = Column(JSONB, nullable=True)        # [UUID, ...]
    weighting_schema = Column(JSONB, nullable=True)        # {"assignment": 0.1, "exam": 0.6, ...}
    aggregate_method = Column(String(20), nullable=False, default="average")

    academic_year = relationship("AcademicYear", back_populates="promotion_criteria", foreign_keys=[academic_year_id])
    grade = relationship("AcademicGrade", back_populates="promotion_criteria", foreign_keys=[grade_id])