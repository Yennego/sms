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
    
    def get_by_domain(self, db: Session, domain: str) -> Optional[Tenant]:
        """Get a tenant by its domain."""
        return db.query(Tenant).filter(Tenant.domain == domain).first()
    
    def create(self, db: Session, *, obj_in: TenantCreate) -> Tenant:
        """Create a new tenant."""
        # Add logging
        print(f"[DEBUG] CRUD create tenant with data: {obj_in.model_dump()}")
        
        # Ensure code is uppercase
        obj_in_data = obj_in.model_dump()
        obj_in_data["code"] = obj_in_data["code"].upper()
        print(f"[DEBUG] Processed tenant data: {obj_in_data}")
        
        try:
            db_obj = Tenant(**obj_in_data)
            print(f"[DEBUG] Created tenant object: {db_obj}")
            db.add(db_obj)
            db.commit()
            db.refresh(db_obj)
            print(f"[DEBUG] Successfully committed tenant: {db_obj.id} - {db_obj.code}")
            return db_obj
        except Exception as e:
            print(f"[DEBUG] Error in CRUD create: {str(e)}")
            import traceback
            print(f"[DEBUG] Traceback: {traceback.format_exc()}")
            db.rollback()
            raise
    
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

