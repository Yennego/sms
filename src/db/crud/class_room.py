from typing import Any, Dict, Optional, Union, List
from uuid import UUID

from sqlalchemy.orm import Session

from src.db.crud.base import CRUDBase
from src.db.models.class_room import ClassRoom
from src.core.exceptions import ResourceNotFoundError


class CRUDClassRoom(CRUDBase[ClassRoom, Any, Any]):
    """CRUD operations for ClassRoom model with tenant isolation."""
    
    def get_by_name_and_grade(self, db: Session, tenant_id: UUID, name: str, grade_level: str) -> Optional[ClassRoom]:
        """Get a class room by name and grade level with tenant isolation."""
        return db.query(ClassRoom).filter(
            ClassRoom.name == name,
            ClassRoom.grade_level == grade_level,
            ClassRoom.tenant_id == tenant_id
        ).first()
    
    def get_by_teacher(self, db: Session, tenant_id: UUID, teacher_id: UUID) -> List[ClassRoom]:
        """Get all class rooms taught by a specific teacher with tenant isolation."""
        return db.query(ClassRoom).filter(
            ClassRoom.teacher_id == teacher_id,
            ClassRoom.tenant_id == tenant_id
        ).all()
    
    def get_active_class_rooms(self, db: Session, tenant_id: UUID) -> List[ClassRoom]:
        """Get all active class rooms with tenant isolation."""
        return db.query(ClassRoom).filter(
            ClassRoom.is_active == True,
            ClassRoom.tenant_id == tenant_id
        ).all()
    
    def bulk_create(self, db: Session, *, objs_in: List[Dict[str, Any]], tenant_id: UUID) -> List[ClassRoom]:
        """Bulk create class rooms."""
        db_objs = []
        for obj_in in objs_in:
            obj_in["tenant_id"] = tenant_id
            db_obj = ClassRoom(**obj_in)
            db.add(db_obj)
            db_objs.append(db_obj)
        db.commit()
        for db_obj in db_objs:
            db.refresh(db_obj)
        return db_objs
    
    def bulk_delete(self, db: Session, *, ids: List[UUID], tenant_id: UUID) -> None:
        """Bulk delete class rooms."""
        db.query(ClassRoom).filter(
            ClassRoom.id.in_(ids),
            ClassRoom.tenant_id == tenant_id
        ).delete(synchronize_session=False)
        db.commit()


class_room = CRUDClassRoom(ClassRoom)