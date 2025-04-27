from typing import Any, Dict, Optional, Union, List
from uuid import UUID

from sqlalchemy.orm import Session

from src.db.crud.base import CRUDBase
from src.db.models.class_room import Class
from src.core.exceptions import ResourceNotFoundError


class CRUDClass(CRUDBase[Class, Any, Any]):
    """CRUD operations for Class model with tenant isolation."""
    
    def get_by_name_and_grade(self, db: Session, tenant_id: UUID, name: str, grade_level: str) -> Optional[Class]:
        """Get a class by name and grade level with tenant isolation."""
        return db.query(Class).filter(
            Class.name == name,
            Class.grade_level == grade_level,
            Class.tenant_id == tenant_id
        ).first()
    
    def get_by_teacher(self, db: Session, tenant_id: UUID, teacher_id: UUID) -> List[Class]:
        """Get all classes taught by a specific teacher with tenant isolation."""
        return db.query(Class).filter(
            Class.teacher_id == teacher_id,
            Class.tenant_id == tenant_id
        ).all()
    
    def get_active_classes(self, db: Session, tenant_id: UUID) -> List[Class]:
        """Get all active classes with tenant isolation."""
        return db.query(Class).filter(
            Class.is_active == True,
            Class.tenant_id == tenant_id
        ).all()


class_room = CRUDClass(Class)