from typing import Optional, List, Any
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
    
    def get_active_years(self, db: Session, tenant_id: Any, skip: int = 0, limit: int = 100) -> List[AcademicYear]:
        """Get all active academic years."""
        return db.query(AcademicYear).filter(
            AcademicYear.tenant_id == tenant_id,
            AcademicYear.is_active == True
        ).offset(skip).limit(limit).all()
    
    def set_current_year(self, db: Session, tenant_id: Any, academic_year_id: Any) -> Optional[AcademicYear]:
        """Set a specific academic year as current (and unset others)."""
        # First, unset all current years
        db.query(AcademicYear).filter(
            AcademicYear.tenant_id == tenant_id,
            AcademicYear.is_current == True
        ).update({"is_current": False})
        
        # Set the specified year as current
        academic_year = db.query(AcademicYear).filter(
            AcademicYear.tenant_id == tenant_id,
            AcademicYear.id == academic_year_id
        ).first()
        
        if academic_year:
            academic_year.is_current = True
            db.commit()
            db.refresh(academic_year)
        
        return academic_year

academic_year_crud = CRUDAcademicYear(AcademicYear)