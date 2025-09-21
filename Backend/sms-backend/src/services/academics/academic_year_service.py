from typing import List, Optional, Any
from uuid import UUID
from fastapi import Depends
from sqlalchemy.orm import Session
from datetime import date

from src.db.crud.academics.academic_year_crud import academic_year_crud
from src.db.models.academics.academic_year import AcademicYear
from src.schemas.academics.academic_year import AcademicYearCreate, AcademicYearUpdate
from src.services.base.base import TenantBaseService, SuperAdminBaseService
from src.core.exceptions.business import EntityNotFoundError, DuplicateEntityError, BusinessRuleViolationError
from src.db.session import get_db, get_super_admin_db
from src.core.middleware.tenant import get_tenant_from_request


class AcademicYearService(TenantBaseService[AcademicYear, AcademicYearCreate, AcademicYearUpdate]):
    """Service for managing academic years within a tenant."""
    
    def __init__(
        self,
        tenant_id: Any = Depends(get_tenant_from_request),
        db: Session = Depends(get_db)
    ):
        super().__init__(crud=academic_year_crud, model=AcademicYear, tenant_id=tenant_id, db=db)
    
    def get_current(self) -> Optional[AcademicYear]:
        """Get the current academic year."""
        return academic_year_crud.get_current(self.db, tenant_id=self.tenant_id)
    
    def get_by_name(self, name: str) -> Optional[AcademicYear]:
        """Get an academic year by name."""
        return academic_year_crud.get_by_name(self.db, tenant_id=self.tenant_id, name=name)
    
    def get_active_years(self, skip: int = 0, limit: int = 100) -> List[AcademicYear]:
        """Get all active academic years."""
        return academic_year_crud.get_active_years(self.db, tenant_id=self.tenant_id, skip=skip, limit=limit)
    
    def create(self, *, obj_in: AcademicYearCreate) -> AcademicYear:
        """Create a new academic year with validation."""
        # Check for duplicate academic year name
        existing = self.get_by_name(obj_in.name)
        if existing:
            raise DuplicateEntityError("AcademicYear", "name", obj_in.name)
        
        # Validate semester dates
        self._validate_semester_dates(obj_in)
        
        # If this is set as current, unset other current years
        if obj_in.is_current:
            self._unset_current_years()
        
        # Create the academic year
        return super().create(obj_in=obj_in)
    
    def update(self, *, db_obj: AcademicYear, obj_in: AcademicYearUpdate) -> AcademicYear:
        """Update an academic year with validation."""
        # Check for duplicate name if name is being updated
        if obj_in.name and obj_in.name != db_obj.name:
            existing = self.get_by_name(obj_in.name)
            if existing:
                raise DuplicateEntityError("AcademicYear", "name", obj_in.name)
        
        # Validate semester dates if any are being updated
        if any([obj_in.semester_1_start, obj_in.semester_1_end, obj_in.semester_2_start, obj_in.semester_2_end]):
            # Create a temporary object for validation
            temp_obj = AcademicYearCreate(
                name=obj_in.name or db_obj.name,
                start_date=obj_in.start_date or db_obj.start_date,
                end_date=obj_in.end_date or db_obj.end_date,
                semester_1_start=obj_in.semester_1_start or db_obj.semester_1_start,
                semester_1_end=obj_in.semester_1_end or db_obj.semester_1_end,
                semester_2_start=obj_in.semester_2_start or db_obj.semester_2_start,
                semester_2_end=obj_in.semester_2_end or db_obj.semester_2_end
            )
            self._validate_semester_dates(temp_obj)
        
        # If setting as current, unset other current years
        if obj_in.is_current and not db_obj.is_current:
            self._unset_current_years()
        
        return super().update(db_obj=db_obj, obj_in=obj_in)
    
    def set_current_year(self, academic_year_id: UUID) -> AcademicYear:
        """Set a specific academic year as current."""
        academic_year = self.get(academic_year_id)
        if not academic_year:
            raise EntityNotFoundError("AcademicYear", academic_year_id)
        
        return academic_year_crud.set_current_year(self.db, tenant_id=self.tenant_id, academic_year_id=academic_year_id)
    
    def advance_semester(self, academic_year_id: UUID) -> AcademicYear:
        """Advance to the next semester within the academic year."""
        academic_year = self.get(academic_year_id)
        if not academic_year:
            raise EntityNotFoundError("AcademicYear", academic_year_id)
        
        if academic_year.current_semester == 1:
            # Check if we can advance to semester 2
            today = date.today()
            if today >= academic_year.semester_2_start:
                academic_year.current_semester = 2
                self.db.commit()
                self.db.refresh(academic_year)
            else:
                raise BusinessRuleViolationError("Cannot advance to semester 2 before its start date")
        else:
            raise BusinessRuleViolationError("Already in the final semester of the academic year")
        
        return academic_year
    
    def _validate_semester_dates(self, obj_in: AcademicYearCreate) -> None:
        """Validate semester dates are logical."""
        if obj_in.start_date >= obj_in.end_date:
            raise BusinessRuleViolationError("Academic year start date must be before end date")
        
        if obj_in.semester_1_start >= obj_in.semester_1_end:
            raise BusinessRuleViolationError("Semester 1 start date must be before end date")
        
        if obj_in.semester_2_start >= obj_in.semester_2_end:
            raise BusinessRuleViolationError("Semester 2 start date must be before end date")
        
        if obj_in.semester_1_end >= obj_in.semester_2_start:
            raise BusinessRuleViolationError("Semester 1 must end before Semester 2 starts")
        
        if obj_in.semester_1_start < obj_in.start_date or obj_in.semester_2_end > obj_in.end_date:
            raise BusinessRuleViolationError("Semester dates must be within academic year dates")
    
    def _unset_current_years(self) -> None:
        """Unset all current academic years for the tenant."""
        self.db.query(AcademicYear).filter(
            AcademicYear.tenant_id == self.tenant_id,
            AcademicYear.is_current == True
        ).update({"is_current": False})
        self.db.commit()


class SuperAdminAcademicYearService(SuperAdminBaseService[AcademicYear, AcademicYearCreate, AcademicYearUpdate]):
    """Super-admin service for managing academic years across all tenants."""
    
    def __init__(self, db: Session = Depends(get_super_admin_db)):
        super().__init__(crud=academic_year_crud, model=AcademicYear, db=db)
    
    def get_all_years(self, skip: int = 0, limit: int = 100,
                     is_active: Optional[bool] = None,
                     is_current: Optional[bool] = None,
                     tenant_id: Optional[UUID] = None) -> List[AcademicYear]:
        """Get all academic years across all tenants with filtering."""
        query = self.db.query(AcademicYear)
        
        # Apply filters
        if is_active is not None:
            query = query.filter(AcademicYear.is_active == is_active)
        if is_current is not None:
            query = query.filter(AcademicYear.is_current == is_current)
        if tenant_id:
            query = query.filter(AcademicYear.tenant_id == tenant_id)
        
        return query.offset(skip).limit(limit).all()