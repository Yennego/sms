from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from src.db.models.parent import Parent
from src.schemas.parent import ParentCreate, ParentUpdate

class ParentCRUD:
    def get_by_id(self, db: Session, parent_id: str) -> Optional[Parent]:
        return db.query(Parent).filter(Parent.id == parent_id).first()

    def list(self, db: Session, skip: int = 0, limit: int = 100) -> List[Parent]:
        return db.query(Parent).offset(skip).limit(limit).all()

    def create(self, db: Session, obj_in: ParentCreate) -> Parent:
        db_obj = Parent(**obj_in.model_dump())
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def update(self, db: Session, parent_id: str, obj_in: ParentUpdate) -> Optional[Parent]:
        db_obj = self.get_by_id(db, parent_id)
        if not db_obj:
            return None
        update_data = obj_in.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_obj, field, value)
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def delete(self, db: Session, parent_id: str) -> None:
        db_obj = self.get_by_id(db, parent_id)
        if db_obj:
            db.delete(db_obj)
            db.commit()

    def bulk_create(self, db: Session, objs_in: List[ParentCreate]) -> List[Parent]:
        db_objs = [Parent(**obj.model_dump()) for obj in objs_in]
        db.add_all(db_objs)
        db.commit()
        for obj in db_objs:
            db.refresh(obj)
        return db_objs

ParentCRUD = ParentCRUD() 