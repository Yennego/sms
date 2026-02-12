from typing import List, Optional
from uuid import UUID
from sqlalchemy.orm import Session

from src.db.crud.base import TenantCRUDBase
from src.db.models.academics.class_subject import ClassSubject
from src.schemas.academics.class_subject_schema import ClassSubjectCreate, ClassSubjectUpdate

class CRUDClassSubject(TenantCRUDBase[ClassSubject, ClassSubjectCreate, ClassSubjectUpdate]):
    """CRUD operations for ClassSubject model."""
    
    def get_by_class(self, db: Session, tenant_id: UUID, class_id: UUID) -> List[ClassSubject]:
        """Get all subjects for a specific class."""
        return db.query(ClassSubject).filter(
            ClassSubject.tenant_id == tenant_id,
            ClassSubject.class_id == class_id
        ).all()

    def get_by_teacher(self, db: Session, tenant_id: UUID, teacher_id: UUID) -> List[ClassSubject]:
        """Get all subjects assigned to a specific teacher."""
        return db.query(ClassSubject).filter(
            ClassSubject.tenant_id == tenant_id,
            ClassSubject.teacher_id == teacher_id
        ).all()

class_subject_crud = CRUDClassSubject(ClassSubject)
