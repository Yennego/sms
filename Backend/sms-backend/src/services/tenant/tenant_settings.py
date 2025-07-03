from typing import Optional, Dict, Any, List
from uuid import UUID

from src.db.crud import tenant_settings as tenant_settings_crud
from src.db.models.tenant import TenantSettings
from src.schemas.tenant import TenantSettingsCreate, TenantSettingsUpdate
from src.services.base.base import TenantBaseService, SuperAdminBaseService

class TenantSettingsService(TenantBaseService[TenantSettings, TenantSettingsCreate, TenantSettingsUpdate]):
    """
    Service for managing tenant-specific settings.
    """
    def __init__(self, *args, **kwargs):
        super().__init__(crud=tenant_settings_crud, model=TenantSettings, *args, **kwargs)
    
    def get_settings(self) -> Optional[TenantSettings]:
        """Get settings for the current tenant."""
        return tenant_settings_crud.get_by_tenant_id(self.db, tenant_id=self.tenant_id)
    
    def create_or_update_settings(self, *, settings_in: Dict[str, Any]) -> TenantSettings:
        """Create or update settings for the current tenant."""
        return tenant_settings_crud.create_or_update(self.db, tenant_id=self.tenant_id, obj_in=settings_in)


class SuperAdminTenantSettingsService(SuperAdminBaseService[TenantSettings, TenantSettingsCreate, TenantSettingsUpdate]):
    """
    Super-admin service for managing settings across all tenants.
    """
    def __init__(self, *args, **kwargs):
        super().__init__(crud=tenant_settings_crud, model=TenantSettings, *args, **kwargs)
    
    def get_tenant_settings(self, tenant_id: UUID) -> Optional[TenantSettings]:
        """Get settings for a specific tenant."""
        return tenant_settings_crud.get_by_tenant_id(self.db, tenant_id=tenant_id)
    
    def create_tenant_settings(self, tenant_id: UUID, settings_in: TenantSettingsCreate) -> TenantSettings:
        """Create settings for a specific tenant."""
        return tenant_settings_crud.create_with_tenant(self.db, tenant_id=tenant_id, obj_in=settings_in)
    
    def update_tenant_settings(self, tenant_id: UUID, settings_in: TenantSettingsUpdate) -> Optional[TenantSettings]:
        """Update settings for a specific tenant."""
        settings = self.get_tenant_settings(tenant_id)
        if not settings:
            return None
        return tenant_settings_crud.update(self.db, db_obj=settings, obj_in=settings_in)

