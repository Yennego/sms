from typing import Any, Optional, List
from uuid import UUID
from fastapi import Depends
from sqlalchemy.orm import Session

from src.core.middleware.tenant import get_tenant_from_request
from src.db.session import get_db
from src.services.base.base import TenantBaseService
from src.db.crud.academics.promotion_criteria import promotion_criteria_crud
from src.db.models.academics.promotion_criteria import PromotionCriteria
from src.schemas.academics.promotion import PromotionCriteriaCreate, PromotionCriteriaUpdate

class PromotionCriteriaService(TenantBaseService[PromotionCriteria, PromotionCriteriaCreate, PromotionCriteriaUpdate]):
    def __init__(self, tenant: Any = Depends(get_tenant_from_request), db: Session = Depends(get_db)):
        tenant_id = tenant.id if hasattr(tenant, "id") else tenant
        super().__init__(crud=promotion_criteria_crud, model=PromotionCriteria, tenant_id=tenant_id, db=db)

    def get_by_year_and_grade(self, *, academic_year_id: UUID, grade_id: UUID) -> Optional[PromotionCriteria]:
        return promotion_criteria_crud.get_by_year_and_grade(
            self.db, tenant_id=self.tenant_id, academic_year_id=academic_year_id, grade_id=grade_id
        )

    def list_by_grade(self, *, grade_id: UUID, skip: int = 0, limit: int = 100) -> List[PromotionCriteria]:
        return promotion_criteria_crud.list_by_grade(
            self.db, tenant_id=self.tenant_id, grade_id=grade_id, skip=skip, limit=limit
        )