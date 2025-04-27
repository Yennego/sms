from typing import Any, Dict, Generic, List, Optional, Type, TypeVar, Union
from uuid import UUID
from pydantic import BaseModel
from sqlalchemy.orm import Session

from src.db.crud.base import CRUDBase
from src.db.models.base import TenantModel

ModelType = TypeVar("ModelType", bound=TenantModel)
CreateSchemaType = TypeVar("CreateSchemaType", bound=BaseModel)
UpdateSchemaType = TypeVar("UpdateSchemaType", bound=BaseModel)


class TenantBaseService(Generic[ModelType, CreateSchemaType, UpdateSchemaType]):
    """Base service class for tenant-scoped operations."""

    def __init__(self, crud_base: CRUDBase):
        """Initialize with a CRUD base instance."""
        self.crud = crud_base

    def get(
        self,
        db: Session,
        tenant_id: UUID,
        id: UUID
    ) -> Optional[ModelType]:
        """Get a record by ID with tenant isolation."""
        return self.crud.get(db=db, tenant_id=tenant_id, id=id)

    def get_multi(
        self,
        db: Session,
        tenant_id: UUID,
        *,
        skip: int = 0,
        limit: int = 100
    ) -> List[ModelType]:
        """Get multiple records with tenant isolation."""
        return self.crud.get_multi(
            db=db,
            tenant_id=tenant_id,
            skip=skip,
            limit=limit
        )

    def create(
        self,
        obj_in: CreateSchemaType,
        db: Session,
        tenant_id: UUID
    ) -> ModelType:
        """Create a new record with tenant isolation."""
        return self.crud.create(db=db, tenant_id=tenant_id, obj_in=obj_in)

    def update(
        self,
        id: UUID,
        obj_in: Union[UpdateSchemaType, Dict[str, Any]],
        db: Session,
        tenant_id: UUID
    ) -> ModelType:
        """Update a record with tenant isolation."""
        db_obj = self.crud.get(db=db, tenant_id=tenant_id, id=id)
        return self.crud.update(db=db, tenant_id=tenant_id, db_obj=db_obj, obj_in=obj_in)

    def remove(
        self,
        id: UUID,
        db: Session,
        tenant_id: UUID
    ) -> ModelType:
        """Remove a record with tenant isolation."""
        return self.crud.remove(db=db, tenant_id=tenant_id, id=id) 