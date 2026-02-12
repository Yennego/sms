from typing import Optional
from uuid import UUID
from sqlalchemy.orm import Session

from src.db.crud.base import TenantCRUDBase
from src.db.models.academics.promotion_status import PromotionStatus
from src.schemas.academics.promotion import PromotionStatusCreate, PromotionStatusUpdate

class CRUDPromotionStatus(TenantCRUDBase[PromotionStatus, PromotionStatusCreate, PromotionStatusUpdate]):
    def get_by_enrollment(self, db: Session, *, tenant_id: UUID, enrollment_id: UUID) -> Optional[PromotionStatus]:
        return db.query(PromotionStatus).filter(PromotionStatus.tenant_id == tenant_id, PromotionStatus.enrollment_id == enrollment_id).first()

promotion_status_crud = CRUDPromotionStatus(PromotionStatus)