from typing import Optional, List
from uuid import UUID
from sqlalchemy.orm import Session

from src.db.crud.base import TenantCRUDBase
from src.db.models.academics.promotion_criteria import PromotionCriteria
from src.schemas.academics.promotion import PromotionCriteriaCreate, PromotionCriteriaUpdate

class CRUDPromotionCriteria(TenantCRUDBase[PromotionCriteria, PromotionCriteriaCreate, PromotionCriteriaUpdate]):
    def get_by_year_and_grade(
        self, db: Session, *, tenant_id: UUID, academic_year_id: UUID, grade_id: UUID
    ) -> Optional[PromotionCriteria]:
        return (
            db.query(PromotionCriteria)
            .filter(
                PromotionCriteria.tenant_id == tenant_id,
                PromotionCriteria.academic_year_id == academic_year_id,
                PromotionCriteria.grade_id == grade_id
            )
            .first()
        )

    def list_by_grade(
        self, db: Session, *, tenant_id: UUID, grade_id: UUID, skip: int = 0, limit: int = 100
    ) -> List[PromotionCriteria]:
        return (
            db.query(PromotionCriteria)
            .filter(
                PromotionCriteria.tenant_id == tenant_id,
                PromotionCriteria.grade_id == grade_id
            )
            .offset(skip).limit(limit).all()
        )

promotion_criteria_crud = CRUDPromotionCriteria(PromotionCriteria)