from typing import Any, Dict, List, Optional, Union
from sqlalchemy.orm import Session

from src.db.crud.base import TenantCRUDBase
from src.db.models.people import Student
from src.schemas.people.student import StudentCreate, StudentUpdate


class CRUDStudent(TenantCRUDBase[Student, StudentCreate, StudentUpdate]):
    """CRUD operations for Student model."""
    
    def get_by_admission_number(self, db: Session, tenant_id: Any, admission_number: str) -> Optional[Student]:
        """Get a student by admission number within a tenant."""
        return db.query(Student).filter(
            Student.tenant_id == tenant_id,
            Student.admission_number == admission_number
        ).first()
    
    def get_by_grade_section(self, db: Session, tenant_id: Any, grade: str, section: str) -> List[Student]:
        """Get students by grade and section within a tenant."""
        return db.query(Student).filter(
            Student.tenant_id == tenant_id,
            Student.grade == grade,
            Student.section == section
        ).all()
    
    def update_status(self, db: Session, tenant_id: Any, id: Any, status: str, reason: Optional[str] = None) -> Optional[Student]:
        """Update a student's status."""
        student = self.get_by_id(db, tenant_id, id)
        if not student:
            return None
            
        student.status = status
        if status == "withdrawn" and reason:
            student.withdrawal_reason = reason
            
        db.add(student)
        db.commit()
        db.refresh(student)
        return student


student = CRUDStudent(Student)

