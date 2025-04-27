from sqlalchemy.orm import Session
from typing import List, Optional
from src.db.crud.subject import SubjectCRUD
from src.schemas.subject import SubjectCreate, SubjectUpdate
from src.db.models.subject import Subject

crud = SubjectCRUD()

class SubjectService:
    def list(self, db: Session, tenant_id: str) -> List[Subject]:
        return crud.list(db, tenant_id)

    def get(self, db: Session, subject_id: str, tenant_id: str) -> Optional[Subject]:
        return crud.get_by_id(db, subject_id, tenant_id)

    def create(self, db: Session, obj_in: SubjectCreate, tenant_id: str) -> Subject:
        return crud.create(db, obj_in, tenant_id)

    def update(self, db: Session, subject_id: str, obj_in: SubjectUpdate, tenant_id: str) -> Optional[Subject]:
        return crud.update(db, subject_id, obj_in, tenant_id)

    def delete(self, db: Session, subject_id: str, tenant_id: str) -> None:
        return crud.delete(db, subject_id, tenant_id)

    def bulk_create(self, db: Session, objs_in: List[SubjectCreate], tenant_id: str) -> List[Subject]:
        return crud.bulk_create(db, objs_in, tenant_id)

    def bulk_delete(self, db: Session, ids: List[str], tenant_id: str) -> int:
        return crud.bulk_delete(db, ids, tenant_id)

subject_service = SubjectService() 