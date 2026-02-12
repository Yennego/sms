from typing import List, Optional, Any
from uuid import UUID
from fastapi import Depends
from sqlalchemy.orm import Session
from src.db.crud.academics.semester_crud import semester_crud
from src.db.models.academics.semester import Semester
from src.schemas.academics.semester import SemesterCreate, SemesterUpdate
from src.services.base.base import TenantBaseService
from src.db.session import get_db
from src.core.middleware.tenant import get_tenant_from_request

class SemesterService(TenantBaseService[Semester, SemesterCreate, SemesterUpdate]):
    """Service for managing academic semesters."""
    
    def __init__(
        self,
        tenant: Any = Depends(get_tenant_from_request),
        db: Session = Depends(get_db)
    ):
        tenant_id = tenant.id if hasattr(tenant, 'id') else tenant
        super().__init__(crud=semester_crud, model=Semester, tenant_id=tenant_id, db=db)
    
    async def get_by_academic_year(self, academic_year_id: UUID) -> List[Semester]:
        """Get all semesters for an academic year."""
        return semester_crud.get_by_academic_year(self.db, self.tenant_id, academic_year_id)
    
    async def toggle_publication(self, semester_id: UUID) -> Semester:
        """Toggle the global publication flag for a semester."""
        semester = await self.get(semester_id)
        if not semester:
            from src.core.exceptions.business import EntityNotFoundError
            raise EntityNotFoundError("Semester", semester_id)
        
        semester.is_published = not semester.is_published
        self.db.commit()
        self.db.refresh(semester)
        return semester
