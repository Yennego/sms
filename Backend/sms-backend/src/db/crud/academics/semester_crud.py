from typing import List, Any
from sqlalchemy.orm import Session
from src.db.crud.base import TenantCRUDBase
from src.db.models.academics.semester import Semester
from src.schemas.academics.semester import SemesterCreate, SemesterUpdate

class CRUDSemester(TenantCRUDBase[Semester, SemesterCreate, SemesterUpdate]):
    """CRUD operations for Semester model."""
    
    def get_by_academic_year(self, db: Session, tenant_id: Any, academic_year_id: Any) -> List[Semester]:
        """Get all semesters for a specific academic year."""
        return db.query(Semester).filter(
            Semester.tenant_id == tenant_id,
            Semester.academic_year_id == academic_year_id
        ).order_by(Semester.semester_number).all()

semester_crud = CRUDSemester(Semester)
