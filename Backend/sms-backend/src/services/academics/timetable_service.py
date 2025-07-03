from typing import List, Optional, Dict, Any
from uuid import UUID
from datetime import date

from src.db.crud.academics import timetable_crud
from src.db.models.academics.timetable import Timetable
from src.schemas.academics.timetable import TimetableCreate, TimetableUpdate
from src.services.base.base import TenantBaseService, SuperAdminBaseService
from src.core.exceptions.business import EntityNotFoundError, DuplicateEntityError


class TimetableService(TenantBaseService[Timetable, TimetableCreate, TimetableUpdate]):
    """Service for managing timetables within a tenant."""
    
    def __init__(self, *args, **kwargs):
        super().__init__(crud=timetable_crud, model=Timetable, *args, **kwargs)
    
    def get_by_name(self, name: str) -> Optional[Timetable]:
        """Get a timetable by name."""
        return timetable_crud.get_by_name(self.db, tenant_id=self.tenant_id, name=name)
    
    def get_by_academic_year(self, academic_year: str) -> List[Timetable]:
        """Get timetables by academic year."""
        return timetable_crud.get_by_academic_year(self.db, tenant_id=self.tenant_id, academic_year=academic_year)
    
    def get_by_grade_and_section(self, grade_id: UUID, section_id: UUID = None) -> List[Timetable]:
        """Get timetables by grade and optional section."""
        return timetable_crud.get_by_grade_and_section(
            self.db, tenant_id=self.tenant_id, grade_id=grade_id, section_id=section_id
        )
    
    def get_active_timetables(self) -> List[Timetable]:
        """Get all active timetables."""
        return timetable_crud.get_active_timetables(self.db, tenant_id=self.tenant_id)
    
    def get_current_timetables(self, current_date: date = None) -> List[Timetable]:
        """Get timetables effective on the current date."""
        if current_date is None:
            current_date = date.today()
        return timetable_crud.get_current_timetables(self.db, tenant_id=self.tenant_id, current_date=current_date)
    
    def create(self, *, obj_in: TimetableCreate) -> Timetable:
        """Create a new timetable with validation."""
        # Check for duplicate timetable name
        existing = self.get_by_name(obj_in.name)
        if existing:
            raise DuplicateEntityError("Timetable", "name", obj_in.name)
        
        # Create the timetable
        return super().create(obj_in=obj_in)


class SuperAdminTimetableService(SuperAdminBaseService[Timetable, TimetableCreate, TimetableUpdate]):
    """Super-admin service for managing timetables across all tenants."""
    
    def __init__(self, *args, **kwargs):
        super().__init__(crud=timetable_crud, model=Timetable, *args, **kwargs)
    
    def get_all_timetables(self, skip: int = 0, limit: int = 100,
                          academic_year: Optional[str] = None,
                          is_active: Optional[bool] = None,
                          tenant_id: Optional[UUID] = None) -> List[Timetable]:
        """Get all timetables across all tenants with filtering."""
        query = self.db.query(Timetable)
        
        # Apply filters
        if academic_year:
            query = query.filter(Timetable.academic_year == academic_year)
        if is_active is not None:
            query = query.filter(Timetable.is_active == is_active)
        if tenant_id:
            query = query.filter(Timetable.tenant_id == tenant_id)
        
        return query.offset(skip).limit(limit).all()

