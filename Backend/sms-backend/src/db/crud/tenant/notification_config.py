from typing import Optional
from sqlalchemy.orm import Session
from src.db.crud.base.base import CRUDBase
from src.db.models.tenant.notification_config import TenantNotificationConfig
from src.schemas.tenant.notification_config import TenantNotificationConfigCreate, NotificationConfigRequest

class CRUDTenantNotificationConfig(CRUDBase[TenantNotificationConfig, TenantNotificationConfigCreate, NotificationConfigRequest]):
    def get_by_tenant_id(self, db: Session, *, tenant_id: str) -> Optional[TenantNotificationConfig]:
        """Get notification config by tenant ID."""
        return db.query(TenantNotificationConfig).filter(TenantNotificationConfig.tenant_id == tenant_id).first()

notification_config = CRUDTenantNotificationConfig(TenantNotificationConfig)