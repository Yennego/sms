from typing import Any, List, Optional
from uuid import UUID
from fastapi import Depends
from sqlalchemy.orm import Session

from src.core.middleware.tenant import get_tenant_from_request
from src.db.session import get_db
from src.services.base.base import TenantBaseService
from src.db.crud.academics.assessment_crud import assessment_crud
from src.db.models.academics.assessment import Assessment
from src.schemas.academics.assessment import AssessmentCreate, AssessmentUpdate
from src.services.academics.grading_service import GradingService
from src.core.exceptions.business import BusinessRuleViolationError, EntityNotFoundError

class AssessmentService(TenantBaseService[Assessment, AssessmentCreate, AssessmentUpdate]):
    def __init__(self, tenant: Any = Depends(get_tenant_from_request), db: Session = Depends(get_db)):
        tenant_id = tenant.id if hasattr(tenant, "id") else tenant
        self.grading_service = GradingService(db, tenant_id)
        super().__init__(crud=assessment_crud, model=Assessment, tenant_id=tenant_id, db=db)

    async def create(self, *, obj_in: AssessmentCreate) -> Assessment:
        """Create a new assessment with mark allocation validation."""
        if obj_in.class_id and obj_in.grading_category_id:
            # Validate that this assessment doesn't exceed the category weight
            await self.grading_service.validate_assessment_allocation(
                class_id=obj_in.class_id,
                category_id=obj_in.grading_category_id,
                max_score=obj_in.max_score
            )
        
        return await super().create(obj_in=obj_in)

    async def get_by_subject(self, subject_id: Any) -> list[Assessment]:
        return self.crud.get_by_subject(self.db, tenant_id=self.tenant_id, subject_id=subject_id)

    async def get_by_grade(self, grade_id: Any) -> list[Assessment]:
        return self.crud.get_by_grade(self.db, tenant_id=self.tenant_id, grade_id=grade_id)
