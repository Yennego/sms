from typing import Any, Dict, List, Optional, Union
from uuid import UUID
from sqlalchemy.orm import Session

from src.db.crud.base import TenantCRUDBase
from src.db.models.academics.class_model import Class
from src.schemas.academics.class_schema import ClassCreate, ClassUpdate


class CRUDClass(TenantCRUDBase[Class, ClassCreate, ClassUpdate]):
    """CRUD operations for Class model."""
    
    def get_by_name(self, db: Session, tenant_id: Any, name: str) -> Optional[Class]:
        """Get a class by name within a tenant."""
        return db.query(Class).filter(
            Class.tenant_id == tenant_id,
            Class.name == name
        ).first()
    
    def get_by_academic_year(self, db: Session, tenant_id: Any, academic_year: str) -> List[Class]:
        """Get classes by academic year within a tenant."""
        return db.query(Class).filter(
            Class.tenant_id == tenant_id,
            Class.academic_year == academic_year
        ).all()
    
    def get_by_grade_and_section(self, db: Session, tenant_id: Any, grade_id: UUID, section_id: UUID) -> List[Class]:
        """Get classes by grade and section within a tenant."""
        return db.query(Class).filter(
            Class.tenant_id == tenant_id,
            Class.grade_id == grade_id,
            Class.section_id == section_id
        ).all()
    
    def get_by_teacher(self, db: Session, tenant_id: Any, teacher_id: UUID) -> List[Class]:
        """Get classes by teacher within a tenant."""
        return db.query(Class).filter(
            Class.tenant_id == tenant_id,
            Class.teacher_id == teacher_id
        ).all()
    
    def get_by_subject(self, db: Session, tenant_id: Any, subject_id: UUID) -> List[Class]:
        """Get classes by subject within a tenant."""
        return db.query(Class).filter(
            Class.tenant_id == tenant_id,
            Class.subject_id == subject_id
        ).all()
    
    def get_active_classes(self, db: Session, tenant_id: Any) -> List[Class]:
        """Get all active classes within a tenant."""
        return db.query(Class).filter(
            Class.tenant_id == tenant_id,
            Class.is_active == True
        ).all()


class_crud = CRUDClass(Class)