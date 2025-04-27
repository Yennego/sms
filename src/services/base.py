from typing import Generic, TypeVar, Type, Optional, Dict, List
from fastapi import Depends
from sqlalchemy.orm import Session

from src.db.base import TenantModel
from src.db.crud.base import TenantCRUDBase
from src.db.session import get_db
from src.core.middleware.tenant import get_tenant_id

ModelType = TypeVar("ModelType", bound=TenantModel)
CreateSchemaType = TypeVar("CreateSchemaType")
UpdateSchemaType = TypeVar("UpdateSchemaType")

class TenantBaseService(Generic[ModelType, CreateSchemaType, UpdateSchemaType]):
    def __init__(
        self,
        crud: TenantCRUDBase,
        model: Type[ModelType],
        db: Session = Depends(get_db),
        tenant_id: str = Depends(get_tenant_id),
    ):
        self.crud = crud
        self.model = model
        self.db = db
        self.tenant_id = tenant_id

    def get(self, id: str) -> Optional[ModelType]:
        return self.crud.get_by_id(self.db, self.tenant_id, id)

    def list(self, skip: int = 0, limit: int = 100, filters: Dict = {}) -> List[ModelType]:
        return self.crud.list(self.db, self.tenant_id, skip=skip, limit=limit, filters=filters)

    def create(self, obj_in: CreateSchemaType) -> ModelType:
        return self.crud.create(self.db, self.tenant_id, obj_in=obj_in)

    def update(self, id: str, obj_in: UpdateSchemaType) -> Optional[ModelType]:
        return self.crud.update(self.db, self.tenant_id, id, obj_in=obj_in)

    def delete(self, id: str) -> None:
        self.crud.delete(self.db, self.tenant_id, id) 