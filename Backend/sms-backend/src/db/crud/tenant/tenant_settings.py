from typing import Any, Dict, Optional, Union
from sqlalchemy.orm import Session

from src.db.crud.base import TenantCRUDBase
from src.db.models.tenant import TenantSettings
from src.schemas.tenant.tenant_settings import TenantSettingsCreate, TenantSettingsUpdate


class CRUDTenantSettings(TenantCRUDBase[TenantSettings, TenantSettingsCreate, TenantSettingsUpdate]):
    """CRUD operations for TenantSettings model."""
    
    def get_by_tenant_id(self, db: Session, tenant_id: Any) -> Optional[TenantSettings]:
        """Get settings for a specific tenant."""
        return db.query(TenantSettings).filter(TenantSettings.tenant_id == tenant_id).first()
    
    def create_or_update(self, db: Session, tenant_id: Any, *, obj_in: Union[TenantSettingsCreate, TenantSettingsUpdate, Dict[str, Any]]) -> TenantSettings:
        """Create or update tenant settings."""
        settings = self.get_by_tenant_id(db, tenant_id)
        
        if settings:
            # Update existing settings
            return self.update(db, tenant_id, db_obj=settings, obj_in=obj_in)
        else:
            # Create new settings
            if isinstance(obj_in, dict):
                obj_in["tenant_id"] = tenant_id
                return self.create(db, tenant_id, obj_in=TenantSettingsCreate(**obj_in))
            else:
                create_data = obj_in.dict()
                create_data["tenant_id"] = tenant_id
                return self.create(db, tenant_id, obj_in=TenantSettingsCreate(**create_data))


tenant_settings = CRUDTenantSettings(TenantSettings)

