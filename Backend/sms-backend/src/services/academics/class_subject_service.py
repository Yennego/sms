from typing import Any, List, Optional
from uuid import UUID
from fastapi import Depends
from sqlalchemy.orm import Session

from src.db.crud.base import TenantCRUDBase
from src.db.models.academics.class_subject import ClassSubject
from src.schemas.academics.class_subject_schema import ClassSubjectCreate, ClassSubjectUpdate
from src.services.base.base import TenantBaseService
from src.db.session import get_db
from src.core.middleware.tenant import get_tenant_from_request

class ClassSubjectCRUD(TenantCRUDBase[ClassSubject, ClassSubjectCreate, ClassSubjectUpdate]):
    def get_by_class_and_subject(self, db: Session, tenant_id: Any, class_id: UUID, subject_id: UUID) -> Optional[ClassSubject]:
        return db.query(ClassSubject).filter(
            ClassSubject.tenant_id == tenant_id,
            ClassSubject.class_id == class_id,
            ClassSubject.subject_id == subject_id
        ).first()

    def get_by_class(self, db: Session, tenant_id: Any, class_id: UUID) -> List[ClassSubject]:
        return db.query(ClassSubject).filter(
            ClassSubject.tenant_id == tenant_id,
            ClassSubject.class_id == class_id
        ).all()

class_subject_crud = ClassSubjectCRUD(ClassSubject)

class ClassSubjectService(TenantBaseService[ClassSubject, ClassSubjectCreate, ClassSubjectUpdate]):
    def __init__(
        self,
        tenant: Any = Depends(get_tenant_from_request),
        db: Session = Depends(get_db)
    ):
        tenant_id = tenant.id if hasattr(tenant, 'id') else tenant
        super().__init__(crud=class_subject_crud, model=ClassSubject, tenant_id=tenant_id, db=db)

    def add_subject_to_class(self, class_id: UUID, subject_in: ClassSubjectCreate) -> ClassSubject:
        # Check if already exists
        existing = class_subject_crud.get_by_class_and_subject(self.db, self.tenant_id, class_id, subject_in.subject_id)
        if existing:
            return self.update(id=existing.id, obj_in=ClassSubjectUpdate(**subject_in.model_dump(exclude={'subject_id'})))
        
        # Create new
        data = subject_in.model_dump()
        data['class_id'] = class_id
        data['tenant_id'] = self.tenant_id
        return self.crud.create(self.db, obj_in=data)

    def remove_subject_from_class(self, class_id: UUID, subject_id: UUID):
        existing = class_subject_crud.get_by_class_and_subject(self.db, self.tenant_id, class_id, subject_id)
        if existing:
            return self.delete(id=existing.id)
        return None
