from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Optional
from src.db.session import get_db
from src.db.models.tenant.notification_config import TenantNotificationConfig
from src.schemas.tenant.notification_config import (
    NotificationConfigRequest,
    NotificationConfigResponse
)

router = APIRouter()

@router.get("/{tenant_id}/notification-config", response_model=Optional[NotificationConfigResponse])
def get_notification_config(
    *, 
    tenant_id: str,
    db: Session = Depends(get_db)
):
    try:
        config = db.query(TenantNotificationConfig).filter(
            TenantNotificationConfig.tenant_id == tenant_id
        ).first()
        return config
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve notification config: {str(e)}"
        )

@router.post("/{tenant_id}/notification-config", response_model=NotificationConfigResponse)
def create_or_update_notification_config(
    *, 
    tenant_id: str,
    db: Session = Depends(get_db), 
    config_data: NotificationConfigRequest
):
    try:
        config = db.query(TenantNotificationConfig).filter(
            TenantNotificationConfig.tenant_id == tenant_id
        ).first()
        
        if config:
            # Update existing
            for key, value in config_data.model_dump().items():
                setattr(config, key, value)
        else:
            # Create new
            config = TenantNotificationConfig(
                tenant_id=tenant_id, 
                **config_data.model_dump()
            )
            db.add(config)
        
        db.commit()
        db.refresh(config)
        return config
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save notification config: {str(e)}"
        )