from typing import List, Optional, Dict, Any
from uuid import UUID
from sqlalchemy.orm import Session

from src.db.crud.base.base import TenantCRUDBase
from src.db.models.communication.notification import Notification
from src.schemas.communication.notification import NotificationCreate, NotificationUpdate


class CRUDNotification(TenantCRUDBase[Notification, NotificationCreate, NotificationUpdate]):
    """CRUD operations for Notification model."""
    
    def get_by_user(self, db: Session, tenant_id: Any, user_id: Any) -> List[Notification]:
        """Get all notifications for a specific user within a tenant."""
        return db.query(Notification).filter(
            Notification.tenant_id == tenant_id,
            Notification.user_id == user_id
        ).all()
    
    def get_unread_by_user(self, db: Session, tenant_id: Any, user_id: Any) -> List[Notification]:
        """Get all unread notifications for a specific user within a tenant."""
        return db.query(Notification).filter(
            Notification.tenant_id == tenant_id,
            Notification.user_id == user_id,
            Notification.is_read == False
        ).all()
    
    def mark_as_read(self, db: Session, tenant_id: Any, id: Any) -> Optional[Notification]:
        """Mark a notification as read within a tenant."""
        notification = db.query(Notification).filter(
            Notification.tenant_id == tenant_id,
            Notification.id == id
        ).first()
        
        if not notification:
            return None
        
        notification.is_read = True
        notification.status = "read"
        db.add(notification)
        db.commit()
        db.refresh(notification)
        
        return notification
    
    def mark_all_as_read(self, db: Session, tenant_id: Any, user_id: Any) -> int:
        """Mark all notifications as read for a specific user within a tenant."""
        result = db.query(Notification).filter(
            Notification.tenant_id == tenant_id,
            Notification.user_id == user_id,
            Notification.is_read == False
        ).update({"is_read": True, "status": "read"})
        
        db.commit()
        return result
    
    def update_status(self, db: Session, tenant_id: Any, id: Any, status: str) -> Optional[Notification]:
        """Update a notification's status within a tenant."""
        notification = db.query(Notification).filter(
            Notification.tenant_id == tenant_id,
            Notification.id == id
        ).first()
        
        if not notification:
            return None
        
        notification.status = status
        db.add(notification)
        db.commit()
        db.refresh(notification)
        
        return notification


notification_crud = CRUDNotification(Notification)

