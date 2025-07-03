from typing import Any, Dict, List, Optional, Union
from sqlalchemy.orm import Session

from src.db.crud.base import CRUDBase
from src.db.models.tenant import Tenant
from src.schemas.tenant.tenant import TenantCreate, TenantUpdate


class CRUDTenant(CRUDBase[Tenant, TenantCreate, TenantUpdate]):
    """CRUD operations for Tenant model."""
    
    def get_by_code(self, db: Session, code: str) -> Optional[Tenant]:
        """Get a tenant by its code."""
        return db.query(Tenant).filter(Tenant.code == code.upper()).first()
    
    def create(self, db: Session, *, obj_in: TenantCreate) -> Tenant:
        """Create a new tenant."""
        # Ensure code is uppercase
        obj_in_data = obj_in.model_dump()
        obj_in_data["code"] = obj_in_data["code"].upper()
        
        db_obj = Tenant(**obj_in_data)
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj
    
    def update(
        self, db: Session, *, db_obj: Tenant, obj_in: Union[TenantUpdate, Dict[str, Any]]
    ) -> Tenant:
        """Update a tenant."""
        if isinstance(obj_in, dict):
            update_data = obj_in
            if "code" in update_data and update_data["code"]:
                update_data["code"] = update_data["code"].upper()
        else:
            update_data = obj_in.model_dump(exclude_unset=True)
            if update_data.get("code"):
                update_data["code"] = update_data["code"].upper()

        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        
        return super().update(db, db_obj=db_obj, obj_in=update_data)
    
    def get_active_tenants(self, db: Session, skip: int = 0, limit: int = 100) -> List[Tenant]:
        """Get all active tenants."""
        return db.query(Tenant).filter(Tenant.is_active == True).offset(skip).limit(limit).all()


tenant = CRUDTenant(Tenant)

