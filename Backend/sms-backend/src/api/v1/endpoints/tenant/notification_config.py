from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Optional
from src.db.session import get_db
from src.db.models.auth import User
from src.db.models.tenant.notification_config import TenantNotificationConfig
from src.core.middleware.tenant import get_tenant_id_from_request
from src.core.security.permissions import has_permission
from src.schemas.tenant.notification_config import (
    NotificationConfigRequest,
    NotificationConfigResponse
)

router = APIRouter()


def _own_tenant(tenant_id: UUID, request_tenant_id: UUID) -> UUID:
    if str(tenant_id) != str(request_tenant_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You don't have access to this school")
    return request_tenant_id


@router.get("/{tenant_id}/notification-config", response_model=Optional[NotificationConfigResponse])
def get_notification_config(
    *,
    tenant_id: UUID,
    request_tenant_id: UUID = Depends(get_tenant_id_from_request),
    db: Session = Depends(get_db),
    current_user: User = Depends(has_permission("manage_tenant_settings"))
):
    tenant_id = _own_tenant(tenant_id, request_tenant_id)
    return db.query(TenantNotificationConfig).filter(
        TenantNotificationConfig.tenant_id == tenant_id
    ).first()

@router.post("/{tenant_id}/notification-config", response_model=NotificationConfigResponse)
def create_or_update_notification_config(
    *,
    tenant_id: UUID,
    request_tenant_id: UUID = Depends(get_tenant_id_from_request),
    db: Session = Depends(get_db),
    config_data: NotificationConfigRequest,
    current_user: User = Depends(has_permission("manage_tenant_settings"))
):
    tenant_id = _own_tenant(tenant_id, request_tenant_id)
    config = db.query(TenantNotificationConfig).filter(
        TenantNotificationConfig.tenant_id == tenant_id
    ).first()

    if config:
        for key, value in config_data.model_dump().items():
            setattr(config, key, value)
    else:
        config = TenantNotificationConfig(tenant_id=tenant_id, **config_data.model_dump())
        db.add(config)

    db.commit()
    db.refresh(config)
    return config
