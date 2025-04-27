from typing import Any, Dict, Optional, Union, List
from uuid import UUID

from sqlalchemy.orm import Session

from src.db.crud.base import CRUDBase
from src.db.models.teacher import Teacher
from src.core.exceptions import ResourceNotFoundError


class CRUDTeacher(CRUDBase[Teacher, Any, Any]):
    """CRUD operations for Teacher model with tenant isolation."""
    
    def get_by_email(self, db: Session, tenant_id: UUID, email: str) -> Optional[Teacher]:
        """Get a teacher by email with tenant isolation."""
        return db.query(Teacher).filter(
            Teacher.email == email,
            Teacher.tenant_id == tenant_id
        ).first()
    
    def get_by_teacher_id(self, db: Session, tenant_id: UUID, teacher_id: str) -> Optional[Teacher]:
        """Get a teacher by school-assigned teacher ID with tenant isolation."""
        return db.query(Teacher).filter(
            Teacher.teacher_id == teacher_id,
            Teacher.tenant_id == tenant_id
        ).first()
    
    def get_by_subject(self, db: Session, tenant_id: UUID, subject: str) -> List[Teacher]:
        """Get all teachers teaching a specific subject with tenant isolation."""
        return db.query(Teacher).filter(
            Teacher.subject_specialty == subject,
            Teacher.tenant_id == tenant_id
        ).all()


teacher = CRUDTeacher(Teacher)