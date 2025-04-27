from sqlalchemy.orm import Session
from uuid import UUID
from typing import List, Optional
from src.db.models.enrollment import Enrollment
from src.schemas.enrollment import EnrollmentCreate, EnrollmentUpdate
from src.db.crud.base import CRUDBase

class EnrollmentCRUD(CRUDBase[Enrollment, EnrollmentCreate, EnrollmentUpdate]):
    def get_by_student_and_class(self, db: Session, *, tenant_id: UUID, student_id: UUID, class_id: UUID) -> Optional[Enrollment]:
        return db.query(self.model).filter(
            self.model.tenant_id == tenant_id,
            self.model.student_id == student_id,
            self.model.class_id == class_id
        ).first()

    def list_by_class(self, db: Session, *, tenant_id: UUID, class_id: UUID, skip: int = 0, limit: int = 100) -> List[Enrollment]:
        return db.query(self.model).filter(
            self.model.tenant_id == tenant_id,
            self.model.class_id == class_id
        ).offset(skip).limit(limit).all()

    def list_by_student(self, db: Session, *, tenant_id: UUID, student_id: UUID, skip: int = 0, limit: int = 100) -> List[Enrollment]:
        return db.query(self.model).filter(
            self.model.tenant_id == tenant_id,
            self.model.student_id == student_id
        ).offset(skip).limit(limit).all()

EnrollmentCRUD = EnrollmentCRUD(Enrollment) 