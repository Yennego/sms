from typing import List, Optional, Dict, Any
from uuid import UUID
from fastapi import Depends
from sqlalchemy.orm import Session

from src.db.crud.academics import subject as subject_crud
from src.db.models.academics.subject import Subject
from src.schemas.academics.subject import SubjectCreate, SubjectUpdate
from src.services.base.base import TenantBaseService, SuperAdminBaseService
from src.core.exceptions.business import EntityNotFoundError, DuplicateEntityError
from src.db.session import get_db, get_super_admin_db
from src.core.middleware.tenant import get_tenant_from_request


class SubjectService(TenantBaseService[Subject, SubjectCreate, SubjectUpdate]):
    """Service for managing subjects within a tenant."""
    
    def __init__(
        self,
        tenant_id: Any = Depends(get_tenant_from_request),
        db: Session = Depends(get_db)
    ):
        super().__init__(crud=subject_crud, model=Subject, tenant_id=tenant_id, db=db)
    
    def get_by_code(self, code: str) -> Optional[Subject]:
        """Get a subject by code."""
        return subject_crud.get_by_code(self.db, tenant_id=self.tenant_id, code=code)
    
    def get_active_subjects(self, skip: int = 0, limit: int = 100) -> List[Subject]:
        """Get all active subjects."""
        return subject_crud.get_active_subjects(self.db, tenant_id=self.tenant_id, skip=skip, limit=limit)
    
    def create(self, *, obj_in: SubjectCreate) -> Subject:
        """Create a new subject with validation."""
        # Check for duplicate subject code
        existing = self.get_by_code(obj_in.code)
        if existing:
            raise DuplicateEntityError("Subject", "code", obj_in.code)
        
        # Create the subject
        return super().create(obj_in=obj_in)


class SuperAdminSubjectService(SuperAdminBaseService[Subject, SubjectCreate, SubjectUpdate]):
    """Super-admin service for managing subjects across all tenants."""
    
    def __init__(self, db: Session = Depends(get_super_admin_db)):
        super().__init__(crud=subject_crud, model=Subject, db=db)
    
    def get_all_subjects(self, skip: int = 0, limit: int = 100,
                        is_active: Optional[bool] = None,
                        tenant_id: Optional[UUID] = None) -> List[Subject]:
        """Get all subjects across all tenants with filtering."""
        query = self.db.query(Subject)
        
        # Apply filters
        if is_active is not None:
            query = query.filter(Subject.is_active == is_active)
        if tenant_id:
            query = query.filter(Subject.tenant_id == tenant_id)
        
        return query.offset(skip).limit(limit).all()