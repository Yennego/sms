from typing import Generic, TypeVar, Dict, List, Optional, Type, Any, Union
from fastapi import Depends
from sqlalchemy.orm import Session
from uuid import UUID

from src.db.models.base import TenantModel
from src.db.crud.base import TenantCRUDBase
from src.db.session import get_db, get_super_admin_db
from src.core.middleware.tenant import get_tenant_from_request
# Add this import at the top
from src.utils.uuid_utils import ensure_uuid

ModelType = TypeVar("ModelType", bound=TenantModel)
CreateSchemaType = TypeVar("CreateSchemaType")
UpdateSchemaType = TypeVar("UpdateSchemaType")

class TenantBaseService(Generic[ModelType, CreateSchemaType, UpdateSchemaType]):
    """Base service class for tenant-aware operations.
    Automatically injects tenant context into all operations."""
    def __init__(
        self,
        crud: TenantCRUDBase,
        model: Type[ModelType],
        tenant_id: Any = Depends(get_tenant_from_request),
        db: Session = Depends(get_db),
    ):
        self.crud = crud
        self.model = model
        tenant_id_value = tenant_id["id"] if isinstance(tenant_id, dict) else tenant_id
        self.tenant_id = self._ensure_uuid(tenant_id_value)
        self.db = db
    
    # Then in your TenantBaseService class
    class TenantBaseService:
        def __init__(self, db: Session, tenant_id: Any):
            self.db = db
            # Convert tenant_id to UUID if it's not already
            self.tenant_id = ensure_uuid(tenant_id)
            if self.tenant_id is None:
                raise ValueError("Invalid tenant_id format")
    
    def get(self, id: Any) -> Optional[ModelType]:
        """Get a record by ID with tenant filtering."""
        return self.crud.get_by_id(db=self.db, tenant_id=self.tenant_id, id=id)
    
    def list(self, *, skip: int = 0, limit: int = 100, filters: Dict = {}) -> List[ModelType]:
        """List records with tenant filtering, pagination, and optional filters."""
        return self.crud.list(
            db=self.db, 
            tenant_id=self.tenant_id, 
            skip=skip, 
            limit=limit, 
            filters=filters
        )
    
    def create(self, *, obj_in: CreateSchemaType) -> ModelType:
        """Create a new record with tenant ID."""
        return self.crud.create(db=self.db, tenant_id=self.tenant_id, obj_in=obj_in)
    
    def update(self, *, id: Any, obj_in: Union[UpdateSchemaType, Dict[str, Any]]) -> Optional[ModelType]:
        """Update a record with tenant validation."""
        db_obj = self.get(id=id)
        if not db_obj:
            return None
        return self.crud.update(db=self.db, tenant_id=self.tenant_id, db_obj=db_obj, obj_in=obj_in)
    
    def delete(self, *, id: Any) -> Optional[ModelType]:
        """Delete a record with tenant validation."""
        return self.crud.delete(db=self.db, tenant_id=self.tenant_id, id=id)


class SuperAdminBaseService(Generic[ModelType, CreateSchemaType, UpdateSchemaType]):
    """
    Base service class for super-admin operations.
    Provides access to all tenants' data.
    """
    def __init__(
        self,
        crud: TenantCRUDBase,
        model: Type[ModelType],
        db: Session = Depends(get_super_admin_db),
    ):
        self.crud = crud
        self.model = model
        self.db = db
    
    # Super-admin specific methods that don't filter by tenant_id
    # These methods will be implemented in derived classes

    