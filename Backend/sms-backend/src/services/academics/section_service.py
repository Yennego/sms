from typing import List, Optional, Dict, Any
from uuid import UUID
from fastapi import Depends
from sqlalchemy.orm import Session

from src.db.crud.academics import section as section_crud
from src.db.models.academics.section import Section
from src.schemas.academics.section import SectionCreate, SectionUpdate
from src.services.base.base import TenantBaseService, SuperAdminBaseService
from src.core.exceptions.business import EntityNotFoundError, DuplicateEntityError
from src.db.session import get_db, get_super_admin_db
from src.core.middleware.tenant import get_tenant_from_request


class SectionService(TenantBaseService[Section, SectionCreate, SectionUpdate]):
    """Service for managing sections within a tenant."""
    
    def __init__(
        self,
        tenant_id: Any = Depends(get_tenant_from_request),
        db: Session = Depends(get_db)
    ):
        super().__init__(crud=section_crud, model=Section, tenant_id=tenant_id, db=db)
    
    def get_by_name(self, name: str, grade_id: UUID) -> Optional[Section]:
        """Get a section by name and grade."""
        return section_crud.get_by_name(self.db, tenant_id=self.tenant_id, name=name, grade_id=grade_id)
    
    def get_active_sections(self, skip: int = 0, limit: int = 100) -> List[Section]:
        """Get all active sections."""
        return section_crud.get_active_sections(self.db, tenant_id=self.tenant_id, skip=skip, limit=limit)
    
    def get_by_grade(self, grade_id: UUID) -> List[Section]:
        """Get sections by grade."""
        return section_crud.get_by_grade(self.db, tenant_id=self.tenant_id, grade_id=grade_id)
    
    def create(self, *, obj_in: SectionCreate) -> Section:
        """Create a new section with validation."""
        # Check for duplicate section name within the same grade
        existing = self.get_by_name(obj_in.name, obj_in.grade_id)
        if existing:
            raise DuplicateEntityError("Section", "name", obj_in.name)
        
        # Create the section
        return super().create(obj_in=obj_in)


class SuperAdminSectionService(SuperAdminBaseService[Section, SectionCreate, SectionUpdate]):
    """Super-admin service for managing sections across all tenants."""
    
    def __init__(self, db: Session = Depends(get_super_admin_db)):
        super().__init__(crud=section_crud, model=Section, db=db)
    
    def get_all_sections(self, skip: int = 0, limit: int = 100,
                        is_active: Optional[bool] = None,
                        grade_id: Optional[UUID] = None,
                        tenant_id: Optional[UUID] = None) -> List[Section]:
        """Get all sections across all tenants with filtering."""
        query = self.db.query(Section)
        
        # Apply filters
        if is_active is not None:
            query = query.filter(Section.is_active == is_active)
        if grade_id:
            query = query.filter(Section.grade_id == grade_id)
        if tenant_id:
            query = query.filter(Section.tenant_id == tenant_id)
        
        return query.offset(skip).limit(limit).all()