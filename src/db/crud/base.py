from typing import Any, Dict, Generic, List, Optional, Type, TypeVar, Union, cast
from uuid import UUID

from fastapi.encoders import jsonable_encoder
from pydantic import BaseModel
from sqlalchemy.orm import Session

from src.db.models.base import TenantModel
from src.core.exceptions import TenantNotFoundError, ResourceNotFoundError

ModelType = TypeVar("ModelType", bound=TenantModel)
CreateSchemaType = TypeVar("CreateSchemaType", bound=BaseModel)
UpdateSchemaType = TypeVar("UpdateSchemaType", bound=BaseModel)


class CRUDBase(Generic[ModelType, CreateSchemaType, UpdateSchemaType]):
    """Base class for CRUD operations with tenant isolation."""

    def __init__(self, model: Type[ModelType]):
        """Initialize with the model class."""
        self.model = model

    def get(self, db: Session, tenant_id: UUID, id: UUID) -> Optional[ModelType]:
        """Get a record by ID with tenant isolation."""
        obj = db.query(self.model).filter(
            self.model.id == id,
            self.model.tenant_id == tenant_id
        ).first()
        if not obj:
            raise ResourceNotFoundError(f"{self.model.__name__} with id {id} not found")
        return obj

    def get_multi(
        self, db: Session, tenant_id: UUID, *, skip: int = 0, limit: int = 100
    ) -> List[ModelType]:
        """Get multiple records with tenant isolation."""
        return db.query(self.model).filter(
            self.model.tenant_id == tenant_id
        ).offset(skip).limit(limit).all()

    def create(self, db: Session, tenant_id: UUID, *, obj_in: CreateSchemaType) -> ModelType:
        """Create a new record with tenant isolation."""
        obj_in_data = jsonable_encoder(obj_in)
        db_obj = self.model(**obj_in_data, tenant_id=tenant_id)
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def update(
        self,
        db: Session,
        tenant_id: UUID,
        *,
        db_obj: ModelType,
        obj_in: Union[UpdateSchemaType, Dict[str, Any]]
    ) -> ModelType:
        """Update a record with tenant isolation."""
        # Ensure the object belongs to the tenant
        if db_obj.tenant_id != tenant_id:
            raise TenantNotFoundError(f"Object does not belong to tenant {tenant_id}")

        obj_data = jsonable_encoder(db_obj)
        if isinstance(obj_in, dict):
            update_data = obj_in
        else:
            update_data = obj_in.dict(exclude_unset=True)

        for field in obj_data:
            if field in update_data:
                setattr(db_obj, field, update_data[field])

        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def remove(self, db: Session, tenant_id: UUID, *, id: UUID) -> ModelType:
        """Remove a record with tenant isolation."""
        obj = db.query(self.model).filter(
            self.model.id == id,
            self.model.tenant_id == tenant_id
        ).first()
        if not obj:
            raise ResourceNotFoundError(f"{self.model.__name__} with id {id} not found")

        db.delete(obj)
        db.commit()
        return obj

    def count(self, db: Session, tenant_id: UUID) -> int:
        """Count records with tenant isolation."""
        return db.query(self.model).filter(self.model.tenant_id == tenant_id).count()