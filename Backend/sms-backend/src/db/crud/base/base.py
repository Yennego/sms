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
        return db.query(self.model).offset(skip).limit(limit).all()
    
    def count(self, db: Session) -> int:
        """Get total count of records."""
        return db.query(self.model).count()
    
    def get_multi_with_count(
        self, db: Session, *, skip: int = 0, limit: int = 100
    ) -> tuple[List[ModelType], int]:
        """Get multiple records with total count for pagination."""
        query = db.query(self.model)
        total = query.count()
        items = query.offset(skip).limit(limit).all()
        return items, total

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
        if isinstance(obj_in, dict):
            update_data = obj_in
        else:
            update_data = obj_in.model_dump(exclude_unset=True)
        
        # Update attributes directly on the object to support joined inheritance
        for field, value in update_data.items():
            if hasattr(db_obj, field) and field != "id":
                setattr(db_obj, field, value)
        
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
    
    
    def list(self, db: Session, *, tenant_id: Any = None, skip: int = 0, limit: int = 100, options: Optional[List[Any]] = None, **kwargs):
        # Convert tenant_id to UUID if it's not already
        tenant_id_uuid = ensure_uuid(tenant_id)
        
        # Use the converted UUID in your query
        query = db.query(self.model).filter(self.model.tenant_id == tenant_id_uuid)
        
        # Apply options (like joinedload)
        if options:
            for option in options:
                query = query.options(option)
        
        # Apply additional filters
        filters = kwargs.get('filters', {})
        for field, value in filters.items():
            if hasattr(self.model, field):
                column = getattr(self.model, field)
                if isinstance(value, list) and value:
                    query = query.filter(column.in_(value))
                elif value is not None:
                    query = query.filter(column == value)
        
        # Add default ordering by created_at to maintain consistent order
        if hasattr(self.model, 'created_at'):
            query = query.order_by(self.model.created_at.desc()) # Changed to desc for logs usually
        elif hasattr(self.model, 'id'):
            query = query.order_by(self.model.id.asc())
        
        return query.offset(skip).limit(limit).all()

    def list_with_count(self, db: Session, *, tenant_id: Any = None, skip: int = 0, limit: int = 100, options: Optional[List[Any]] = None, **kwargs) -> tuple[List[TenantModelType], int]:
        """List records with total count, tenant filtering, and pagination."""
        tenant_id_uuid = ensure_uuid(tenant_id)
        query = db.query(self.model).filter(self.model.tenant_id == tenant_id_uuid)
        
        if options:
            for option in options:
                query = query.options(option)
        
        filters = kwargs.get('filters', {})
        for field, value in filters.items():
            if hasattr(self.model, field):
                column = getattr(self.model, field)
                if isinstance(value, list) and value:
                    query = query.filter(column.in_(value))
                elif value is not None:
                    query = query.filter(column == value)
        
        total = query.count()

        if hasattr(self.model, 'created_at'):
            query = query.order_by(self.model.created_at.desc())
        elif hasattr(self.model, 'id'):
            query = query.order_by(self.model.id.asc())
            
        items = query.offset(skip).limit(limit).all()
        return items, total
    
    def create(
        self, db: Session, tenant_id: Any, *, obj_in: CreateSchemaType
    ) -> TenantModelType:
        """Create a new record with tenant ID."""
        tenant_id = self._ensure_uuid(tenant_id)
        
        # Validate tenant exists
        from src.db.models.tenant import Tenant
        tenant = db.query(Tenant).filter(Tenant.id == tenant_id, Tenant.is_active == True).first()
        if not tenant:
            raise ValueError(f"Tenant {tenant_id} not found or inactive")
    
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
            
        if isinstance(obj_in, dict):
            update_data = obj_in
        else:
            update_data = obj_in.model_dump(exclude_unset=True)
        
        # Update attributes directly on the object to support joined inheritance
        # This is necessary because Query.update() doesn't work well with polymorphic models
        for field, value in update_data.items():
            # Never overwrite tenant_id or id during a normal update
            if field not in ["tenant_id", "id"] and hasattr(db_obj, field):
                setattr(db_obj, field, value)
        
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

        