from typing import Any, Dict, List, Optional, Union
from sqlalchemy.orm import Session

from src.db.crud.base import TenantCRUDBase
from src.db.models.people import Teacher
from src.schemas.people.teacher import TeacherCreate, TeacherUpdate


class CRUDTeacher(TenantCRUDBase[Teacher, TeacherCreate, TeacherUpdate]):
    """CRUD operations for Teacher model."""
    
    def get_by_employee_id(self, db: Session, tenant_id: Any, employee_id: str) -> Optional[Teacher]:
        """Get a teacher by employee ID within a tenant."""
        return db.query(Teacher).filter(
            Teacher.tenant_id == tenant_id,
            Teacher.employee_id == employee_id
        ).first()
    
    def get_by_department(self, db: Session, tenant_id: Any, department: str) -> List[Teacher]:
        """Get teachers by department within a tenant."""
        return db.query(Teacher).filter(
            Teacher.tenant_id == tenant_id,
            Teacher.department == department
        ).all()
    
    def get_class_teachers(self, db: Session, tenant_id: Any) -> List[Teacher]:
        """Get all class teachers within a tenant."""
        return db.query(Teacher).filter(
            Teacher.tenant_id == tenant_id,
            Teacher.is_class_teacher == True
        ).all()


teacher = CRUDTeacher(Teacher)