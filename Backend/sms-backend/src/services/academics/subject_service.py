from typing import List, Optional, Dict, Any, Union
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


from sqlalchemy import text

class SubjectService(TenantBaseService[Subject, SubjectCreate, SubjectUpdate]):
    """Service for managing subjects within a tenant."""
    
    def __init__(
        self,
        tenant: Any = Depends(get_tenant_from_request),
        db: Session = Depends(get_db)
    ):
        # Extract tenant_id from the Tenant object
        tenant_id = tenant.id if hasattr(tenant, 'id') else tenant
        super().__init__(crud=subject_crud, model=Subject, tenant_id=tenant_id, db=db)
    
    async def delete(self, *, id: UUID) -> Optional[Subject]:
        """Delete a subject, handling dependencies manually."""
        # 1. Handle teacher_subject_assignments (hidden association table)
        stmt = text("DELETE FROM teacher_subject_assignments WHERE subject_id = :id")
        self.db.execute(stmt, {"id": id})
        self.db.commit()
        
        return await super().delete(id=id)
    
    async def get_by_code(self, code: str) -> Optional[Subject]:
        """Get a subject by code."""
        return subject_crud.get_by_code(self.db, tenant_id=self.tenant_id, code=code)

    async def get_by_name(self, name: str) -> Optional[Subject]:
        """Get a subject by name."""
        return subject_crud.get_by_name(self.db, tenant_id=self.tenant_id, name=name)

    async def create(self, *, obj_in: SubjectCreate) -> Subject:
        """Create a new subject with validation."""
        existing_code = await self.get_by_code(obj_in.code)
        if existing_code:
            raise DuplicateEntityError("Subject", "code", obj_in.code)
        existing_name = await self.get_by_name(obj_in.name)
        if existing_name:
            raise DuplicateEntityError("Subject", "name", obj_in.name)
        return await super().create(obj_in=obj_in)

    async def update(self, *, id: Any, obj_in: Union[SubjectUpdate, Dict[str, Any]]) -> Optional[Subject]:
        """Update a subject with duplicate name/code validation."""
        db_obj = await self.get(id=id)
        if not db_obj:
            raise EntityNotFoundError("Subject", "id", id)
        data = obj_in if isinstance(obj_in, dict) else obj_in.model_dump(exclude_unset=True)

        if "name" in data and data["name"] != db_obj.name:
            existing_name = await self.get_by_name(data["name"])
            if existing_name and existing_name.id != db_obj.id:
                raise DuplicateEntityError("Subject", "name", data["name"])

        if "code" in data and data["code"] != db_obj.code:
            existing_code = await self.get_by_code(data["code"])
            if existing_code and existing_code.id != db_obj.id:
                raise DuplicateEntityError("Subject", "code", data["code"])

        return await super().update(id=id, obj_in=obj_in)
    
    async def get_active_subjects(self, skip: int = 0, limit: int = 100) -> List[Subject]:
        """Get all active subjects."""
        return subject_crud.get_active_subjects(self.db, tenant_id=self.tenant_id, skip=skip, limit=limit)


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