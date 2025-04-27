from src.services.base import TenantBaseService
from src.db.models.parent import Parent
from src.db.crud.parent import ParentCRUD
from src.schemas.parent import ParentCreate, ParentUpdate
from typing import List
from sqlalchemy.orm import Session

class ParentService(TenantBaseService[Parent, ParentCreate, ParentUpdate]):
    def __init__(self, **kwargs):
        super().__init__(crud=ParentCRUD(), model=Parent, **kwargs)

    def bulk_create(self, db: Session, objs_in: List[ParentCreate]) -> List[Parent]:
        return self.crud.bulk_create(db, objs_in) 