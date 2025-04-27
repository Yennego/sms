from typing import Any, Dict, Optional, Union, List
from uuid import UUID

from sqlalchemy.orm import Session

from src.db.crud.base import CRUDBase
from src.db.models.student import Student
from src.core.exceptions import ResourceNotFoundError


class CRUDStudent(CRUDBase[Student, Any, Any]):
    """CRUD operations for Student model with tenant isolation."""
    
    def get_by_student_id(self, db: Session, tenant_id: UUID, student_id: str) -> Optional[Student]:
        """Get a student by school-assigned student ID with tenant isolation."""
        return db.query(Student).filter(
            Student.student_id == student_id,
            Student.tenant_id == tenant_id
        ).first()
    
    def get_by_grade_level(self, db: Session, tenant_id: UUID, grade_level: str) -> List[Student]:
        """Get all students in a specific grade level with tenant isolation."""
        return db.query(Student).filter(
            Student.grade_level == grade_level,
            Student.tenant_id == tenant_id
        ).all()


student = CRUDStudent(Student)