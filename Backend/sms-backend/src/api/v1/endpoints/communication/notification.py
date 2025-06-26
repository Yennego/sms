from typing import Any, List, Optional, Dict
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, Query, Body
from sqlalchemy.orm import Session

from src.services.notification import NotificationDispatchService
from src.services.notification import SuperAdminNotificationDispatchService
from src.db.session import get_db
from src.schemas.communication.notification import Notification, NotificationCreate, NotificationUpdate
from src.core.middleware.tenant import get_tenant_from_request
from src.core.auth.dependencies import has_any_role, get_current_user, has_permission
from src.schemas.auth import User
from src.core.exceptions.business import EntityNotFoundError

router = APIRouter()

# User notification endpoints
@router.get("/notifications", response_model=List[Notification])
def get_user_notifications(
    *,
    notification_service: NotificationDispatchService = Depends(),
    current_user: User = Depends(get_current_user),
    unread_only: bool = Query(False, description="Filter to show only unread notifications")
) -> Any:
    """Get all notifications for the current user."""
    if unread_only:
        return notification_service.get_unread_by_user(user_id=current_user.id)
    return notification_service.get_by_user(user_id=current_user.id)

@router.put("/notifications/{notification_id}/read", response_model=Notification)
def mark_notification_as_read(
    *,
    notification_service: NotificationDispatchService = Depends(),
    notification_id: UUID,
    current_user: User = Depends(get_current_user)
) -> Any:
    """Mark a notification as read."""
    try:
        notification = notification_service.get(id=notification_id)
        if not notification or notification.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Notification not found"
            )
        return notification_service.mark_as_read(id=notification_id)
    except EntityNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found"
        )

@router.put("/notifications/read-all", response_model=Dict[str, Any])
def mark_all_notifications_as_read(
    *,
    notification_service: NotificationDispatchService = Depends(),
    current_user: User = Depends(get_current_user)
) -> Any:
    """Mark all notifications as read for the current user."""
    count = notification_service.mark_all_as_read(user_id=current_user.id)
    return {"success": True, "count": count}

# Admin notification endpoints
@router.post("/admin/notifications", response_model=Notification, status_code=status.HTTP_201_CREATED)
def send_notification(
    *,
    notification_service: NotificationDispatchService = Depends(),
    user_id: UUID = Body(..., description="User ID to send notification to"),
    title: str = Body(..., description="Notification title"),
    message: str = Body(..., description="Notification message"),
    notification_type: str = Body(..., description="Type of notification (email, sms, in-app)"),
    metadata: Optional[Dict[str, Any]] = Body(None, description="Additional metadata"),
    current_user: User = Depends(has_any_role(["admin"]))
) -> Any:
    """Send a notification to a user (admin only)."""
    try:
        notification_in = NotificationCreate(
            user_id=user_id,
            title=title,
            message=message,
            notification_type=notification_type,
            metadata=metadata
        )
        
        if notification_type == "email":
            return notification_service.send_email_notification(
                user_id=user_id,
                title=title,
                message=message,
                metadata=metadata
            )
        elif notification_type == "sms":
            return notification_service.send_sms_notification(
                user_id=user_id,
                title=title,
                message=message,
                metadata=metadata
            )
        else:  # in-app
            return notification_service.create(obj_in=notification_in)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

# Super Admin endpoints
@router.get("/super-admin/notifications", response_model=List[Notification])
def get_all_notifications(
    *,
    notification_service: SuperAdminNotificationDispatchService = Depends(),
    skip: int = 0,
    limit: int = 100,
    user_id: Optional[UUID] = None,
    status: Optional[str] = None,
    notification_type: Optional[str] = None,
    tenant_id: Optional[UUID] = None,
    current_user: User = Depends(has_permission("view_all_notifications"))
) -> Any:
    """Get all notifications across all tenants with filtering (super-admin only)."""
    filters = {}
    if user_id:
        filters["user_id"] = user_id
    if status:
        filters["status"] = status
    if notification_type:
        filters["notification_type"] = notification_type
    if tenant_id:
        filters["tenant_id"] = tenant_id
    
    return notification_service.get_multi(skip=skip, limit=limit, **filters)