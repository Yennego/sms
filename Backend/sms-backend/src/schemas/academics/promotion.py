from typing import Optional, List, Dict, Literal
from uuid import UUID
from datetime import date
from pydantic import BaseModel, ConfigDict

# Criteria
class PromotionCriteriaBase(BaseModel):
    academic_year_id: UUID
    grade_id: UUID
    passing_mark: int = 70
    min_passed_subjects: Optional[int] = None
    require_core_pass: bool = True
    core_subject_ids: Optional[List[UUID]] = None
    weighting_schema: Optional[Dict[str, float]] = None
    aggregate_method: Literal["average", "weighted"] = "average"

class PromotionCriteriaCreate(PromotionCriteriaBase):
    pass

class PromotionCriteriaUpdate(BaseModel):
    passing_mark: Optional[int] = None
    min_passed_subjects: Optional[int] = None
    require_core_pass: Optional[bool] = None
    core_subject_ids: Optional[List[UUID]] = None
    weighting_schema: Optional[Dict[str, float]] = None
    aggregate_method: Optional[Literal["average", "weighted"]] = None

class PromotionCriteriaInDB(PromotionCriteriaBase):
    id: UUID
    tenant_id: UUID
    model_config = ConfigDict(from_attributes=True)

class PromotionCriteria(PromotionCriteriaInDB):
    pass

# Evaluation
class PromotionEvaluationRequest(BaseModel):
    enrollment_ids: Optional[List[UUID]] = None
    student_ids: Optional[List[UUID]] = None
    academic_year_id: Optional[UUID] = None
    grade_id: Optional[UUID] = None
    section_id: Optional[UUID] = None

class PromotionEvaluationResult(BaseModel):
    student_id: UUID
    enrollment_id: UUID
    status: Literal["Eligible", "Conditional", "Repeating"]
    failed_subject_ids: List[UUID]
    total_score: float
    student_name: Optional[str] = None
    section_id: Optional[UUID] = None
    notes: Optional[str] = None

# Status
class PromotionStatusBase(BaseModel):
    student_id: UUID
    enrollment_id: UUID
    academic_year_id: UUID
    status: Literal["Eligible", "Conditional", "Repeating", "Graduated", "Promoted", "Remedial"]
    next_grade_id: Optional[UUID] = None
    next_section_id: Optional[UUID] = None
    next_class_id: Optional[UUID] = None
    failed_subject_ids: Optional[List[UUID]] = None
    total_score: Optional[float] = None
    promotion_date: Optional[date] = None
    notes: Optional[str] = None

class PromotionStatusCreate(PromotionStatusBase):
    pass

class PromotionStatusUpdate(BaseModel):
    status: Optional[Literal["Eligible", "Conditional", "Repeating", "Graduated", "Promoted", "Remedial"]] = None
    next_grade_id: Optional[UUID] = None
    next_section_id: Optional[UUID] = None
    next_class_id: Optional[UUID] = None
    failed_subject_ids: Optional[List[UUID]] = None
    total_score: Optional[float] = None
    promotion_date: Optional[date] = None
    notes: Optional[str] = None

# Remedial
class RemedialSessionCreate(BaseModel):
    student_id: UUID
    enrollment_id: UUID
    subject_id: UUID
    academic_year_id: UUID
    scheduled_date: date

class RemedialSessionUpdate(BaseModel):
    status: Optional[Literal["scheduled", "completed"]] = None
    new_score: Optional[float] = None
    passed: Optional[bool] = None

class RemedialSessionInDB(RemedialSessionCreate):
    id: UUID
    tenant_id: UUID
    status: str
    new_score: Optional[float] = None
    passed: Optional[bool] = None
    model_config = ConfigDict(from_attributes=True)

class RemedialSession(RemedialSessionInDB):
    student_name: Optional[str] = None
    subject_name: Optional[str] = None
    # We can add more details if needed