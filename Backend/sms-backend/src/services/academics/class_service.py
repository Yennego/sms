from typing import List, Optional, Dict, Any
from uuid import UUID

from src.db.crud.academics import class_crud
from src.db.models.academics.class_model import Class
from src.schemas.academics.class_schema import ClassCreate, ClassUpdate
from src.services.base.base import TenantBaseService, SuperAdminBaseService
from src.core.exceptions.business import EntityNotFoundError, DuplicateEntityError


class ClassService(TenantBaseService[Class, ClassCreate, ClassUpdate]):
    """Service for managing classes within a tenant."""
    
    def __init__(self, *args, **kwargs):
        super().__init__(crud=class_crud, model=Class, *args, **kwargs)
    
    def get_by_name(self, name: str) -> Optional[Class]:
        """Get a class by name."""
        return class_crud.get_by_name(self.db, tenant_id=self.tenant_id, name=name)
    
    def get_by_academic_year(self, academic_year: str) -> List[Class]:
        """Get classes by academic year."""
        return class_crud.get_by_academic_year(self.db, tenant_id=self.tenant_id, academic_year=academic_year)
    
    def get_by_grade_and_section(self, grade_id: UUID, section_id: UUID) -> List[Class]:
        """Get classes by grade and section."""
        return class_crud.get_by_grade_and_section(self.db, tenant_id=self.tenant_id, grade_id=grade_id, section_id=section_id)
    
    def get_by_teacher(self, teacher_id: UUID) -> List[Class]:
        """Get classes by teacher."""
        return class_crud.get_by_teacher(self.db, tenant_id=self.tenant_id, teacher_id=teacher_id)
    
    def get_by_subject(self, subject_id: UUID) -> List[Class]:
        """Get classes by subject."""
        return class_crud.get_by_subject(self.db, tenant_id=self.tenant_id, subject_id=subject_id)
    
    def get_active_classes(self) -> List[Class]:
        """Get all active classes."""
        return class_crud.get_active_classes(self.db, tenant_id=self.tenant_id)
    
    def create(self, *, obj_in: ClassCreate) -> Class:
        """Create a new class with validation."""
        # Check for duplicate class name if provided
        if obj_in.name:
            existing = self.get_by_name(obj_in.name)
            if existing:
                raise DuplicateEntityError("Class", "name", obj_in.name)
        
        # Create the class
        return super().create(obj_in=obj_in)


class SuperAdminClassService(SuperAdminBaseService[Class, ClassCreate, ClassUpdate]):
    """Super-admin service for managing classes across all tenants."""
    
    def __init__(self, *args, **kwargs):
        super().__init__(crud=class_crud, model=Class, *args, **kwargs)
    
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

