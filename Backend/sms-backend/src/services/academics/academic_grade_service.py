from typing import List, Optional, Dict, Any
from uuid import UUID
from fastapi import Depends
from sqlalchemy.orm import Session

from src.db.crud.academics import academic_grade as academic_grade_crud
from src.db.models.academics.academic_grade import AcademicGrade
from src.schemas.academics.academic_grade import AcademicGradeCreate, AcademicGradeUpdate
from src.services.base.base import TenantBaseService, SuperAdminBaseService
from src.core.exceptions.business import EntityNotFoundError, DuplicateEntityError
from src.db.session import get_db, get_super_admin_db
from src.core.middleware.tenant import get_tenant_from_request


class AcademicGradeService(TenantBaseService[AcademicGrade, AcademicGradeCreate, AcademicGradeUpdate]):
    """Service for managing academic grades within a tenant."""
    
    def __init__(
        self,
        tenant_id: Any = Depends(get_tenant_from_request),
        db: Session = Depends(get_db)
    ):
        super().__init__(crud=academic_grade_crud, model=AcademicGrade, tenant_id=tenant_id, db=db)
    
    def get_by_name(self, name: str) -> Optional[AcademicGrade]:
        """Get an academic grade by name."""
        return academic_grade_crud.get_by_name(self.db, tenant_id=self.tenant_id, name=name)
    
    def get_active_grades(self, skip: int = 0, limit: int = 100) -> List[AcademicGrade]:
        """Get all active academic grades."""
        return academic_grade_crud.get_active_grades(self.db, tenant_id=self.tenant_id, skip=skip, limit=limit)
    
    def create(self, *, obj_in: AcademicGradeCreate) -> AcademicGrade:
        """Create a new academic grade with validation."""
        # Check for duplicate grade name
        existing = self.get_by_name(obj_in.name)
        if existing:
            raise DuplicateEntityError("AcademicGrade", "name", obj_in.name)
        
        # Create the academic grade
        return super().create(obj_in=obj_in)


class SuperAdminAcademicGradeService(SuperAdminBaseService[AcademicGrade, AcademicGradeCreate, AcademicGradeUpdate]):
    """Super-admin service for managing academic grades across all tenants."""
    
    def __init__(self, db: Session = Depends(get_super_admin_db)):
        super().__init__(crud=academic_grade_crud, model=AcademicGrade, db=db)
    
    def get_all_grades(self, skip: int = 0, limit: int = 100,
                      is_active: Optional[bool] = None,
                      tenant_id: Optional[UUID] = None) -> List[AcademicGrade]:
        """Get all academic grades across all tenants with filtering."""
        query = self.db.query(AcademicGrade)
        
        # Apply filters
        if is_active is not None:
            query = query.filter(AcademicGrade.is_active == is_active)
        if tenant_id:
            query = query.filter(AcademicGrade.tenant_id == tenant_id)
        
        return query.offset(skip).limit(limit).all()