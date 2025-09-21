from typing import Any, Dict, List, Optional, Union
from uuid import UUID
from sqlalchemy.orm import Session

from src.db.crud.base import TenantCRUDBase
from src.db.models.academics.timetable import Timetable
from src.schemas.academics.timetable import TimetableCreate, TimetableUpdate


class CRUDTimetable(TenantCRUDBase[Timetable, TimetableCreate, TimetableUpdate]):
    """CRUD operations for Timetable model."""
    
    def get_by_name(self, db: Session, tenant_id: Any, name: str) -> Optional[Timetable]:
        """Get a timetable by name within a tenant."""
        return db.query(Timetable).filter(
            Timetable.tenant_id == tenant_id,
            Timetable.name == name
        ).first()
    
    def get_by_academic_year_id(self, db: Session, tenant_id: Any, academic_year_id: UUID) -> List[Timetable]:
        """Get timetables by academic year ID within a tenant."""
        return db.query(Timetable).filter(
            Timetable.tenant_id == tenant_id,
            Timetable.academic_year_id == academic_year_id
        ).all()
    
    def get_by_grade_and_section(self, db: Session, tenant_id: Any, grade_id: UUID, section_id: UUID = None) -> List[Timetable]:
        """Get timetables by grade and optional section within a tenant."""
        query = db.query(Timetable).filter(
            Timetable.tenant_id == tenant_id,
            Timetable.grade_id == grade_id
        )
        
        if section_id:
            query = query.filter(Timetable.section_id == section_id)
            
        return query.all()
    
    def get_active_timetables(self, db: Session, tenant_id: Any) -> List[Timetable]:
        """Get all active timetables within a tenant."""
        return db.query(Timetable).filter(
            Timetable.tenant_id == tenant_id,
            Timetable.is_active == True
        ).all()
    
    def get_current_timetables(self, db: Session, tenant_id: Any, current_date) -> List[Timetable]:
        """Get timetables effective on the current date within a tenant."""
        return db.query(Timetable).filter(
            Timetable.tenant_id == tenant_id,
            Timetable.effective_from <= current_date,
            (Timetable.effective_until >= current_date) | (Timetable.effective_until.is_(None))
        ).all()


timetable_crud = CRUDTimetable(Timetable)

