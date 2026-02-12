from typing import List, Optional, Dict, Any
from uuid import UUID
from fastapi import Depends
from sqlalchemy.orm import Session
from sqlalchemy import delete

from src.db.crud.academics import class_crud
from src.db.models.academics.class_model import Class
from src.db.models.academics.schedule import Schedule
from src.schemas.academics.class_schema import ClassCreate, ClassUpdate
from src.services.base.base import TenantBaseService, SuperAdminBaseService
from src.core.exceptions.business import EntityNotFoundError, DuplicateEntityError
from src.db.session import get_db, get_super_admin_db
from src.core.middleware.tenant import get_tenant_from_request
from src.core.exceptions.business import BusinessRuleViolationError
from src.db.crud.academics.academic_grade import academic_grade as grade_crud
from src.db.crud.academics.section import section as section_crud
from src.db.crud.academics.subject import subject as subject_crud
from src.db.crud import teacher as teacher_crud


class ClassService(TenantBaseService[Class, ClassCreate, ClassUpdate]):
    """Service for managing classes within a tenant."""
    
    def __init__(
        self,
        tenant: Any = Depends(get_tenant_from_request),
        db: Session = Depends(get_db)
    ):
        tenant_id = tenant.id if hasattr(tenant, 'id') else tenant
        super().__init__(crud=class_crud, model=Class, tenant_id=tenant_id, db=db)
    
    async def get_by_name(self, name: str) -> Optional[Class]:
        """Get a class by name."""
        return class_crud.get_by_name(self.db, tenant_id=self.tenant_id, name=name)
    
    async def get_by_academic_year(self, academic_year_id: UUID) -> List[Class]:
        """Get classes by academic year ID."""
        return class_crud.get_by_academic_year(self.db, tenant_id=self.tenant_id, academic_year_id=academic_year_id)
    
    async def get_by_grade_and_section(self, grade_id: UUID, section_id: UUID) -> List[Class]:
        """Get classes by grade and section."""
        return class_crud.get_by_grade_and_section(self.db, tenant_id=self.tenant_id, grade_id=grade_id, section_id=section_id)
    
    async def get_by_teacher(self, teacher_id: UUID) -> List[Class]:
        """Get classes where a teacher is the Class Sponsor."""
        return class_crud.get_by_teacher(self.db, tenant_id=self.tenant_id, teacher_id=teacher_id)
    
    async def get_by_subject(self, subject_id: UUID) -> List[Class]:
        """Get classes that have a specific subject."""
        return class_crud.get_by_subject(self.db, tenant_id=self.tenant_id, subject_id=subject_id)
    
    async def get_active_classes(self) -> List[Class]:
        """Get all active classes."""
        return class_crud.get_active_classes(self.db, tenant_id=self.tenant_id)
    
    async def create(self, *, obj_in: ClassCreate) -> Class:
        """Create a new class container with validation."""
        # Check for duplicate class name if provided
        if obj_in.name:
            existing = await self.get_by_name(obj_in.name)
            if existing:
                raise DuplicateEntityError("Class", "name", obj_in.name)
        
        # Validate academic year
        from src.db.crud.academics.academic_year_crud import academic_year_crud
        ay = academic_year_crud.get_by_id(self.db, tenant_id=self.tenant_id, id=obj_in.academic_year_id)
        if not ay:
            raise EntityNotFoundError("AcademicYear", obj_in.academic_year_id)

        # Validate grade
        gr = grade_crud.get_by_id(self.db, tenant_id=self.tenant_id, id=obj_in.grade_id)
        if not gr:
            raise EntityNotFoundError("AcademicGrade", obj_in.grade_id)
            
        # Validate section and relationship to grade
        sec = section_crud.get_by_id(self.db, tenant_id=self.tenant_id, id=obj_in.section_id)
        if not sec:
            raise EntityNotFoundError("Section", obj_in.section_id)
        if sec.grade_id != obj_in.grade_id:
            raise BusinessRuleViolationError("Section does not belong to the specified grade")
            
        # Validate Class Sponsor if provided
        if obj_in.class_teacher_id:
            tch = teacher_crud.get_by_id(self.db, tenant_id=self.tenant_id, id=obj_in.class_teacher_id)
            if not tch:
                raise EntityNotFoundError("Teacher", obj_in.class_teacher_id)

        # Duplicate identity check (tenant + academic_year_id + grade + section)
        existing_identity = class_crud.get_by_identity(
            self.db,
            tenant_id=self.tenant_id,
            academic_year_id=obj_in.academic_year_id,
            grade_id=obj_in.grade_id,
            section_id=obj_in.section_id,
        )
        if existing_identity:
            raise DuplicateEntityError(
                "Class",
                "identity",
                f"Year:{obj_in.academic_year_id}/Grade:{obj_in.grade_id}/Section:{obj_in.section_id}"
            )

        # Auto-generate name if not provided
        if not obj_in.name:
            obj_in.name = f"{gr.name} - {sec.name}"

        # Validate dates
        if obj_in.end_date and obj_in.end_date < obj_in.start_date:
            raise BusinessRuleViolationError("end_date must be on or after start_date")
            
        # Create the class
        return await super().create(obj_in=obj_in)
    
    async def delete(self, *, id: UUID) -> Optional[Class]:
        """Delete a class and handle related schedules to avoid foreign key constraint violations."""
        # First get the class to ensure it exists
        class_obj = await self.get(id=id)
        if not class_obj:
            return None
        
        # Delete all schedules associated with this class to avoid foreign key constraint violations
        # Since Schedule.class_id has nullable=False, we must delete the schedules first
        delete_stmt = delete(Schedule).where(
            Schedule.tenant_id == self.tenant_id,
            Schedule.class_id == id
        )
        self.db.execute(delete_stmt)
        
        # Now delete the class using the parent implementation
        return await super().delete(id=id)


class SuperAdminClassService(SuperAdminBaseService[Class, ClassCreate, ClassUpdate]):
    """Super-admin service for managing classes across all tenants."""
    
    def __init__(self, db: Session = Depends(get_super_admin_db)):
        super().__init__(crud=class_crud, model=Class, db=db)
    
    def get_all_classes(self, skip: int = 0, limit: int = 100,
                       academic_year: Optional[str] = None,
                       is_active: Optional[bool] = None,
                       tenant_id: Optional[UUID] = None) -> List[Class]:
        """Get all classes across all tenants with filtering."""
        query = self.db.query(Class)
        
        # Apply filters
        if academic_year:
            query = query.filter(Class.academic_year == academic_year)
        if is_active is not None:
            query = query.filter(Class.is_active == is_active)
        if tenant_id:
            query = query.filter(Class.tenant_id == tenant_id)
        
        return query.offset(skip).limit(limit).all()

