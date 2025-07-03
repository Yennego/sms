from typing import Any, Dict, Generic, List, Optional, Type, TypeVar, Union
from fastapi.encoders import jsonable_encoder
from pydantic import BaseModel
from sqlalchemy.orm import Session
from uuid import UUID
from src.db.models.base import Base, TenantModel
from src.utils.uuid_utils import ensure_uuid


ModelType = TypeVar("ModelType", bound=Base)
TenantModelType = TypeVar("TenantModelType", bound=TenantModel)
CreateSchemaType = TypeVar("CreateSchemaType", bound=BaseModel)
UpdateSchemaType = TypeVar("UpdateSchemaType", bound=BaseModel)


class CRUDBase(Generic[ModelType, CreateSchemaType, UpdateSchemaType]):
    """Base class for CRUD operations on non-tenant models."""
    
    def __init__(self, model: Type[ModelType]):
        """Initialize with the model class."""
        self.model = model

    def _ensure_uuid(self, value: Any) -> Any:
        """Ensure the value is a UUID object if it's a string representing a UUID."""
        if isinstance(value, str):
            try:
                return UUID(value)
            except ValueError:
                # If it's not a valid UUID string, return the original value
                return value
        return value
    
    def get(self, db: Session, id: Any) -> Optional[ModelType]:
        """Get a record by ID."""
        tenant_id_uuid = ensure_uuid(id)
        id_uuid = ensure_uuid(id)

        if tenant_id_uuid is None or id_uuid is None:
            return None

        return db.query(self.model).filter(self.model.id == id_uuid).first()
        # return db.query(self.model).filter(self.model.id == id).first()
    
    def get_multi(
        self, db: Session, *, skip: int = 0, limit: int = 100
    ) -> List[ModelType]:
        """Get multiple records with pagination and optional filters."""
        # id = self._ensure_uuid(id)
        return db.query(self.model).offset(skip).limit(limit).all()
    
    def create(self, db: Session, *, obj_in: CreateSchemaType) -> ModelType:
        """Create a new record."""
        obj_in_data = jsonable_encoder(obj_in)
        db_obj = self.model(**obj_in_data)
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj
    
    def update(
        self, db: Session, *, db_obj: ModelType, obj_in: Union[UpdateSchemaType, Dict[str, Any]]
    ) -> ModelType:
        """Update a record."""
        obj_data = jsonable_encoder(db_obj)
        if isinstance(obj_in, dict):
            update_data = obj_in
        else:
            update_data = obj_in.model_dump(exclude_unset=True)
        for field in obj_data:
            if field in update_data:
                setattr(db_obj, field, update_data[field])
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj
    
    def remove(self, db: Session, *, id: Any) -> ModelType:
        """Remove a record."""
        id = self._ensure_uuid(id)
        obj = db.query(self.model).get(id)
        if not obj:
            return None
        db.delete(obj)
        db.commit()
        return obj


class TenantCRUDBase(Generic[TenantModelType, CreateSchemaType, UpdateSchemaType]):
    """Base class for CRUD operations on tenant-aware models."""
    
    def __init__(self, model: Type[TenantModelType]):
        """Initialize with the model class."""
        self.model = model

    def _ensure_uuid(self, tenant_id: Any) -> UUID:
        """Ensure the tenant_id is a UUID object."""
        if isinstance(tenant_id, str):
            tenant_id = UUID(tenant_id)
        elif not isinstance(tenant_id, UUID):
            raise ValueError("tenant_id must be a UUID object")
        return tenant_id    
    
    def get_by_id(self, db: Session, tenant_id: Any, id: Any) -> Optional[TenantModelType]:
        """Get a record by ID with tenant filtering."""
        tenant_id = self._ensure_uuid(tenant_id)

        return db.query(self.model).filter(
            self.model.tenant_id == tenant_id,
            self.model.id == id
        ).first()
    
    
    # Then modify the list method or any method that uses tenant_id in filters
    def list(self, db: Session, *, tenant_id: Any = None, skip: int = 0, limit: int = 100, **kwargs):
        # Convert tenant_id to UUID if it's not already
        tenant_id_uuid = ensure_uuid(tenant_id)
        
        # Use the converted UUID in your query
        query = db.query(self.model).filter(self.model.tenant_id == tenant_id_uuid)
        
        # Apply additional filters
        filters = kwargs.get('filters', {})
        for field, value in filters.items():
            if hasattr(self.model, field):
                query = query.filter(getattr(self.model, field) == value)
        
        return query.offset(skip).limit(limit).all()
    
    def create(
        self, db: Session, tenant_id: Any, *, obj_in: CreateSchemaType
    ) -> TenantModelType:
        """Create a new record with tenant ID."""
        tenant_id = self._ensure_uuid(tenant_id)

        obj_in_data = jsonable_encoder(obj_in)
        # Ensure tenant_id is set
        obj_in_data["tenant_id"] = tenant_id
        db_obj = self.model(**obj_in_data)
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj
    
    def update(
        self, 
        db: Session, 
        tenant_id: Any, 
        *, 
        db_obj: TenantModelType, 
        obj_in: Union[UpdateSchemaType, Dict[str, Any]]
    ) -> TenantModelType:
        """Update a record with tenant validation."""

        tenant_id = self._ensure_uuid(tenant_id)

        # Ensure the object belongs to the tenant
        if str(db_obj.tenant_id) != str(tenant_id):
            raise ValueError("Object does not belong to the tenant")
            
        obj_data = jsonable_encoder(db_obj)
        if isinstance(obj_in, dict):
            update_data = obj_in
        else:
            update_data = obj_in.model_dump(exclude_unset=True)
        for field in obj_data:
            if field in update_data:
                setattr(db_obj, field, update_data[field])
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj
    
    def delete(
        self, db: Session, tenant_id: Any, *, id: Any
    ) -> Optional[TenantModelType]:
        """Delete a record with tenant validation."""

        tenant_id = self._ensure_uuid(tenant_id)

        obj = self.get_by_id(db, tenant_id, id)
        if not obj:
            return None
        db.delete(obj)
        db.commit()
        return obj

        