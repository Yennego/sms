from typing import Any, Optional
from uuid import UUID
from fastapi import Depends
from sqlalchemy.orm import Session

from src.core.middleware.tenant import get_tenant_from_request
from src.db.session import get_db
from src.services.base.base import TenantBaseService
from src.db.crud.academics.promotion_status import promotion_status_crud
from src.db.models.academics.promotion_status import PromotionStatus
from src.schemas.academics.promotion import PromotionStatusCreate

class PromotionStatusService(TenantBaseService[PromotionStatus, PromotionStatusCreate, dict]):
    def __init__(self, tenant: Any = Depends(get_tenant_from_request), db: Session = Depends(get_db)):
        tenant_id = tenant.id if hasattr(tenant, "id") else tenant
        super().__init__(crud=promotion_status_crud, model=PromotionStatus, tenant_id=tenant_id, db=db)

    def upsert_status_from_eval(self, eval_result: dict) -> PromotionStatus:
        existing = promotion_status_crud.get_by_enrollment(
            self.db, tenant_id=self.tenant_id, enrollment_id=eval_result["enrollment_id"]
        )
        payload = PromotionStatusCreate(
            student_id=eval_result["student_id"],
            enrollment_id=eval_result["enrollment_id"],
            academic_year_id=self._resolve_enrollment_year(eval_result["enrollment_id"]),
            status=eval_result["status"],
            failed_subject_ids=eval_result.get("failed_subject_ids", []),
            total_score=eval_result.get("total_score"),
            notes=eval_result.get("notes"),
        )
        if existing:
            return self.update(id=existing.id, obj_in=payload.model_dump())
        return self.create(obj_in=payload)

    def _resolve_enrollment_year(self, enrollment_id: UUID) -> UUID:
        from src.db.models.academics.enrollment import Enrollment
        en = self.db.query(Enrollment).filter(Enrollment.tenant_id == self.tenant_id, Enrollment.id == enrollment_id).first()
        return en.academic_year_id if en else None

    def get_by_enrollment(self, enrollment_id: UUID) -> Optional[PromotionStatus]:
        return promotion_status_crud.get_by_enrollment(
            self.db, tenant_id=self.tenant_id, enrollment_id=enrollment_id
        )

    def get_by_student_year(self, student_id: UUID, academic_year_id: UUID) -> Optional[PromotionStatus]:
        from src.db.models.academics.promotion_status import PromotionStatus as PS
        return (
            self.db.query(PS)
            .filter(
                PS.tenant_id == self.tenant_id,
                PS.student_id == student_id,
                PS.academic_year_id == academic_year_id
            )
            .first()
        )