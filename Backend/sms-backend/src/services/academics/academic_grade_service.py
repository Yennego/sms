from typing import List, Optional, Dict, Any, Union
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


from src.core.cache import cached
from src.core.redis import cache

from sqlalchemy import delete
from src.db.models.academics.promotion_criteria import PromotionCriteria


class AcademicGradeService(TenantBaseService[AcademicGrade, AcademicGradeCreate, AcademicGradeUpdate]):
    """Service for managing academic grades within a tenant."""
    
    def __init__(
        self,
        tenant: Any = Depends(get_tenant_from_request),
        db: Session = Depends(get_db)
    ):
        # Extract tenant_id from the Tenant object
        tenant_id = tenant.id if hasattr(tenant, 'id') else tenant
        super().__init__(crud=academic_grade_crud, model=AcademicGrade, tenant_id=tenant_id, db=db)

    @cached(prefix="academic_grades:get", expire=600)
    async def get(self, id: Any) -> Optional[AcademicGrade]:
        """Get a specific academic grade (Cached)."""
        return await super().get(id=id)

    async def update(self, id: Any, obj_in: Union[AcademicGradeUpdate, Dict[str, Any]]) -> Optional[AcademicGrade]:
        """Update an academic grade and invalidate cache."""
        result = await super().update(id=id, obj_in=obj_in)
        if result:
            await cache.delete(f"academic_grades:get:id={id}:tenant={self.tenant_id}")
            await cache.delete_pattern(f"academic_grades:list*:tenant={self.tenant_id}")
            await cache.delete_pattern(f"academic_grades:active*:tenant={self.tenant_id}")
        return result
    
    @cached(prefix="academic_grades:name", expire=600)
    async def get_by_name(self, name: str) -> Optional[AcademicGrade]:
        """Get an academic grade by name."""
        return academic_grade_crud.get_by_name(self.db, tenant_id=self.tenant_id, name=name)
    
    @cached(prefix="academic_grades:active", expire=600)
    async def get_active_grades(self, skip: int = 0, limit: int = 100) -> List[AcademicGrade]:
        """Get all active academic grades."""
        return academic_grade_crud.get_active_grades(self.db, tenant_id=self.tenant_id, skip=skip, limit=limit)

    @cached(prefix="academic_grades:list", expire=600)
    async def list(self, *, skip: int = 0, limit: int = 100, filters: Dict = {}) -> List[AcademicGrade]:
        """List records with tenant filtering and caching."""
        return await super().list(skip=skip, limit=limit, filters=filters)
    
    async def create(self, *, obj_in: AcademicGradeCreate) -> AcademicGrade:
        """Create a new academic grade with validation and cache invalidation."""
        # Check for duplicate grade name
        existing = await self.get_by_name(obj_in.name)
        if existing:
            raise DuplicateEntityError("AcademicGrade", "name", obj_in.name)
        
        # Invalidate list caches (using pattern to catch all arg variations)
        await cache.delete_pattern(f"academic_grades:list*:tenant={self.tenant_id}")
        await cache.delete_pattern(f"academic_grades:active*:tenant={self.tenant_id}")
        
        # Create the academic grade
        return await super().create(obj_in=obj_in)

    async def delete(self, id: Any) -> Optional[AcademicGrade]:
        """Delete an academic grade + cleanup dependencies (promotion criteria, sections, tickets)."""
        # 1. Clean up Promotion Criteria (which has nullable=False foreign key)
        stmt_criteria = delete(PromotionCriteria).where(
            PromotionCriteria.grade_id == id,
            PromotionCriteria.tenant_id == self.tenant_id
        )
        self.db.execute(stmt_criteria)

        # 2. Clean up Sections and their Timetables (Cascading delete manually)
        from src.db.models.academics.section import Section
        from src.db.models.academics.timetable import Timetable

        # 2a. Fetch all sections to get their IDs
        sections = self.db.query(Section).filter(
            Section.grade_id == id,
            Section.tenant_id == self.tenant_id
        ).all()
        
        section_ids = [s.id for s in sections]
        
        if section_ids:
            # 2b. Delete Timetables for these sections
            stmt_timetables = delete(Timetable).where(
                Timetable.section_id.in_(section_ids),
                Timetable.tenant_id == self.tenant_id
            )
            self.db.execute(stmt_timetables)

            # 2c. Delete the Sections themselves
            stmt_sections = delete(Section).where(
                Section.id.in_(section_ids),
                Section.tenant_id == self.tenant_id
            )
            self.db.execute(stmt_sections)

        # Flush to ensure criteria/sections are gone before grade deletion triggers constraint check
        self.db.flush()

        # 3. Invalidate caches
        await cache.delete(f"academic_grades:get:id={id}:tenant={self.tenant_id}")
        await cache.delete_pattern(f"academic_grades:list*:tenant={self.tenant_id}")
        await cache.delete_pattern(f"academic_grades:active*:tenant={self.tenant_id}")

        # 4. Perform the actual grade deletion
        return await super().delete(id=id)


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