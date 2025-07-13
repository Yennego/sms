from typing import Optional, List
from sqlalchemy.orm import Session
from src.db.crud.base import TenantCRUDBase
from src.db.models.academics.academic_year import AcademicYear
from src.schemas.academics.academic_year import AcademicYearCreate, AcademicYearUpdate

class CRUDAcademicYear(TenantCRUDBase[AcademicYear, AcademicYearCreate, AcademicYearUpdate]):
    """CRUD operations for AcademicYear model."""
    
    def get_current(self, db: Session, tenant_id: Any) -> Optional[AcademicYear]:
        """Get the current academic year."""
        return db.query(AcademicYear).filter(
            AcademicYear.tenant_id == tenant_id,
            AcademicYear.is_current == True
        ).first()
    
    def get_by_name(self, db: Session, tenant_id: Any, name: str) -> Optional[AcademicYear]:
        """Get academic year by name."""
        return db.query(AcademicYear).filter(
            AcademicYear.tenant_id == tenant_id,
            AcademicYear.name == name
        ).first()

academic_year_crud = CRUDAcademicYear(AcademicYear)