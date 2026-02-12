from uuid import UUID
from sqlalchemy.orm import Session
from src.db.crud.base import TenantCRUDBase
from src.db.models.academics.assessment import Assessment
from src.schemas.academics.assessment import AssessmentCreate, AssessmentUpdate

class CRUDAssessment(TenantCRUDBase[Assessment, AssessmentCreate, AssessmentUpdate]):
    def get_by_subject(self, db: Session, *, tenant_id: UUID, subject_id: UUID) -> list[Assessment]:
        return db.query(self.model).filter(
            self.model.tenant_id == tenant_id,
            self.model.subject_id == subject_id
        ).all()

    def get_by_grade(self, db: Session, *, tenant_id: UUID, grade_id: UUID) -> list[Assessment]:
        return db.query(self.model).filter(
            self.model.tenant_id == tenant_id,
            self.model.grade_id == grade_id
        ).all()

assessment_crud = CRUDAssessment(Assessment)
