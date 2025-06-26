from typing import Any, Dict, List, Optional, Union
from sqlalchemy.orm import Session

from src.db.crud.base import TenantCRUDBase
from src.db.models.people import Parent, Student
from src.schemas.people.parent import ParentCreate, ParentUpdate


class CRUDParent(TenantCRUDBase[Parent, ParentCreate, ParentUpdate]):
    """CRUD operations for Parent model."""
    
    def get_by_student(self, db: Session, tenant_id: Any, student_id: Any) -> List[Parent]:
        """Get parents of a specific student within a tenant."""
        return db.query(Parent).join(
            Parent.students
        ).filter(
            Parent.tenant_id == tenant_id,
            Student.id == student_id
        ).all()
    
    def add_student(self, db: Session, tenant_id: Any, parent_id: Any, student_id: Any) -> Optional[Parent]:
        """Add a student to a parent's list of students."""
        parent = self.get_by_id(db, tenant_id, parent_id)
        if not parent:
            return None
            
        student = db.query(Student).filter(
            Student.tenant_id == tenant_id,
            Student.id == student_id
        ).first()
        
        if not student:
            return None
            
        parent.add_student(student)
        db.add(parent)
        db.commit()
        db.refresh(parent)
        return parent
    
    def remove_student(self, db: Session, tenant_id: Any, parent_id: Any, student_id: Any) -> Optional[Parent]:
        """Remove a student from a parent's list of students."""
        parent = self.get_by_id(db, tenant_id, parent_id)
        if not parent:
            return None
            
        student = db.query(Student).filter(
            Student.tenant_id == tenant_id,
            Student.id == student_id
        ).first()
        
        if not student:
            return None
            
        parent.remove_student(student)
        db.add(parent)
        db.commit()
        db.refresh(parent)
        return parent


parent = CRUDParent(Parent)