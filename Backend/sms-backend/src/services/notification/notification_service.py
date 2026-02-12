from typing import List, Optional, Dict, Any, Union
from uuid import UUID

from src.db.crud.communication import notification as notification_crud
from src.db.models.communication.notification import Notification
from src.schemas.communication.notification import NotificationCreate, NotificationUpdate
from src.services.base.base import TenantBaseService, SuperAdminBaseService
from src.services.notification.email_service import EmailService
from src.core.exceptions.business import EntityNotFoundError


class NotificationDispatchService(TenantBaseService[Notification, NotificationCreate, NotificationUpdate]):
    """Service for managing and dispatching notifications within a tenant."""
    
    def __init__(self, *args, **kwargs):
        super().__init__(crud=notification_crud, model=Notification, *args, **kwargs)
        self.email_service = EmailService()
    
    def get_by_user(self, user_id: UUID) -> List[Notification]:
        """Get all notifications for a specific user."""
        return notification_crud.get_by_user(
            self.db, tenant_id=self.tenant_id, user_id=user_id
        )
    
    def get_unread_by_user(self, user_id: UUID) -> List[Notification]:
        """Get all unread notifications for a specific user."""
        return notification_crud.get_unread_by_user(
            self.db, tenant_id=self.tenant_id, user_id=user_id
        )
    
    async def mark_as_read(self, id: UUID) -> Optional[Notification]:
        """Mark a notification as read."""
        notification = await self.get(id=id)
        if not notification:
            raise EntityNotFoundError("Notification", id)
        
        return notification_crud.mark_as_read(
            self.db, tenant_id=self.tenant_id, id=id
        )
    
    def mark_all_as_read(self, user_id: UUID) -> int:
        """Mark all notifications as read for a specific user."""
        return notification_crud.mark_all_as_read(
            self.db, tenant_id=self.tenant_id, user_id=user_id
        )
    
    async def send_email_notification(self, user_id: UUID, title: str, message: str, 
                               metadata: Optional[Dict[str, Any]] = None) -> Notification:
        """Send an email notification to a user."""
        # Create notification record
        notification_in = NotificationCreate(
            user_id=user_id,
            title=title,
            message=message,
            notification_type="email",
            metadata=metadata
        )
        
        notification = await self.create(obj_in=notification_in)
        
        # Get user email
        # Use text() or proper model query
        from src.db.models.auth.user import User
        user = self.db.query(User).filter(User.id == user_id).first()
        if not user:
            notification_crud.update_status(
                self.db, tenant_id=self.tenant_id, id=notification.id, status="failed"
            )
            raise EntityNotFoundError("User", user_id)
        
        # Send email
        email_sent = self.email_service.send_email(
            recipient_email=user.email,
            subject=title,
            message_html=message
        )
        
        # Update notification status
        status = "sent" if email_sent else "failed"
        return notification_crud.update_status(
            self.db, tenant_id=self.tenant_id, id=notification.id, status=status
        )
    
    async def send_in_app_notification(self, user_id: UUID, title: str, message: str,
                               metadata: Optional[Dict[str, Any]] = None) -> Notification:
        """Send an in-app notification to a user."""
        # Create notification record
        notification_in = NotificationCreate(
            user_id=user_id,
            title=title,
            message=message,
            notification_type="in-app",
            metadata=metadata,
            status="delivered"  # In-app notifications are delivered immediately
        )
        
        return await self.create(obj_in=notification_in)
    
    async def send_bulk_notification(self, user_ids: List[UUID], title: str, message: str,
                             notification_type: str, metadata: Optional[Dict[str, Any]] = None) -> List[Notification]:
        """Send a notification to multiple users."""
        notifications = []
        
        for user_id in user_ids:
            if notification_type == "email":
                notification = await self.send_email_notification(user_id, title, message, metadata)
            elif notification_type == "in-app":
                notification = await self.send_in_app_notification(user_id, title, message, metadata)
            else:
                # Default to in-app
                notification = await self.send_in_app_notification(user_id, title, message, metadata)
            
            notifications.append(notification)
        
        return notifications


class SuperAdminNotificationDispatchService(SuperAdminBaseService[Notification, NotificationCreate, NotificationUpdate]):
    """Super-admin service for managing notifications across all tenants."""
    
    def __init__(self, *args, **kwargs):
        super().__init__(crud=notification_crud, model=Notification, *args, **kwargs)
        self.email_service = EmailService()
    
    def get_all_notifications(self, skip: int = 0, limit: int = 100,
                            user_id: Optional[UUID] = None,
                            notification_type: Optional[str] = None,
                            status: Optional[str] = None,
                            is_read: Optional[bool] = None,
                            tenant_id: Optional[UUID] = None) -> List[Notification]:
        """Get all notifications across all tenants with filtering."""
        query = self.db.query(Notification)
        
        # Apply filters
        if user_id:
            query = query.filter(Notification.user_id == user_id)
        if notification_type:
            query = query.filter(Notification.notification_type == notification_type)
        if status:
            query = query.filter(Notification.status == status)
        if is_read is not None:
            query = query.filter(Notification.is_read == is_read)
        if tenant_id:
            query = query.filter(Notification.tenant_id == tenant_id)
        
        # Apply pagination
        return query.offset(skip).limit(limit).all()

        