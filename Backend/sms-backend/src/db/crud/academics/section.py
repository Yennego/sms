from typing import List, Optional, Dict, Any
from uuid import UUID

from sqlalchemy.orm import Session

from src.db.models.academics.section import Section
from src.db.crud.base import TenantCRUDBase
from src.schemas.academics.section import SectionCreate, SectionUpdate


class CRUDSection(TenantCRUDBase[Section, SectionCreate, SectionUpdate]):
    def get_by_name(self, db: Session, *, tenant_id: UUID, name: str, grade_id: UUID) -> Optional[Section]:
        return db.query(Section).filter(
            Section.tenant_id == tenant_id, 
            Section.name == name,
            Section.grade_id == grade_id
        ).first()
    
    def get_active_sections(self, db: Session, *, tenant_id: UUID, grade_id: Optional[UUID] = None, skip: int = 0, limit: int = 100) -> List[Section]:
        query = db.query(Section).filter(Section.tenant_id == tenant_id, Section.is_active == True)
        
        if grade_id:
            query = query.filter(Section.grade_id == grade_id)
            
        return query.offset(skip).limit(limit).all()
    
    def get_by_grade(self, db: Session, *, tenant_id: UUID, grade_id: UUID) -> List[Section]:
        """Get all sections for a specific grade within a tenant."""
        return db.query(Section).filter(
            Section.tenant_id == tenant_id,
            Section.grade_id == grade_id
        ).all()


section = CRUDSection(Section)

