from sqlalchemy.orm import Session
from typing import List, Optional
from src.db.models.subject import Subject
from src.schemas.subject import SubjectCreate, SubjectUpdate
from uuid import UUID

class SubjectCRUD:
    def list(self, db: Session, tenant_id: str) -> List[Subject]:
        return db.query(Subject).filter(Subject.tenant_id == tenant_id).all()

    def get_by_id(self, db: Session, subject_id: str, tenant_id: str) -> Optional[Subject]:
        return db.query(Subject).filter(Subject.id == subject_id, Subject.tenant_id == tenant_id).first()

    def create(self, db: Session, obj_in: SubjectCreate, tenant_id: str) -> Subject:
        db_obj = Subject(**obj_in.dict(), tenant_id=tenant_id)
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def update(self, db: Session, subject_id: str, obj_in: SubjectUpdate, tenant_id: str) -> Optional[Subject]:
        db_obj = self.get_by_id(db, subject_id, tenant_id)
        if not db_obj:
            return None
        for field, value in obj_in.dict(exclude_unset=True).items():
            setattr(db_obj, field, value)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def delete(self, db: Session, subject_id: str, tenant_id: str) -> None:
        db_obj = self.get_by_id(db, subject_id, tenant_id)
        if db_obj:
            db.delete(db_obj)
            db.commit()

    def bulk_create(self, db: Session, objs_in: List[SubjectCreate], tenant_id: str) -> List[Subject]:
        db_objs = [Subject(**obj.dict(), tenant_id=tenant_id) for obj in objs_in]
        db.add_all(db_objs)
        db.commit()
        for obj in db_objs:
            db.refresh(obj)
        return db_objs

    def bulk_delete(self, db: Session, ids: List[str], tenant_id: str) -> int:
        q = db.query(Subject).filter(Subject.id.in_(ids), Subject.tenant_id == tenant_id)
        count = q.count()
        q.delete(synchronize_session=False)
        db.commit()
        return count

SubjectCRUD = SubjectCRUD() 