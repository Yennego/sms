from typing import List, Optional, Dict, Any
from uuid import UUID
from sqlalchemy.orm import Session
from sqlalchemy import desc

from src.db.crud.base.base import TenantCRUDBase
from src.db.models.communication.message import Message, message_recipient
from src.schemas.communication.message import MessageCreate, MessageUpdate


class CRUDMessage(TenantCRUDBase[Message, MessageCreate, MessageUpdate]):
    """CRUD operations for Message model."""
    
    def get_messages_by_sender(self, db: Session, tenant_id: Any, sender_id: Any) -> List[Message]:
        """Get all messages sent by a specific user within a tenant."""
        return db.query(Message).filter(
            Message.tenant_id == tenant_id,
            Message.sender_id == sender_id
        ).order_by(desc(Message.sent_at)).all()
    
    def get_messages_by_recipient(self, db: Session, tenant_id: Any, recipient_id: Any) -> List[Message]:
        """Get all messages received by a specific user within a tenant."""
        return db.query(Message).join(
            message_recipient,
            Message.id == message_recipient.c.message_id
        ).filter(
            Message.tenant_id == tenant_id,
            message_recipient.c.recipient_id == recipient_id
        ).order_by(desc(Message.sent_at)).all()
    
    def get_unread_messages(self, db: Session, tenant_id: Any, recipient_id: Any) -> List[Message]:
        """Get all unread messages for a specific user within a tenant."""
        return db.query(Message).join(
            message_recipient,
            Message.id == message_recipient.c.message_id
        ).filter(
            Message.tenant_id == tenant_id,
            message_recipient.c.recipient_id == recipient_id,
            message_recipient.c.is_read == False
        ).order_by(desc(Message.sent_at)).all()
    
    def mark_as_read(self, db: Session, tenant_id: Any, message_id: Any, recipient_id: Any) -> bool:
        """Mark a message as read for a specific recipient within a tenant."""
        # First check if the message exists and belongs to the tenant
        message = db.query(Message).filter(
            Message.tenant_id == tenant_id,
            Message.id == message_id
        ).first()
        
        if not message:
            return False
        
        # Update the message_recipient association
        result = db.execute(
            message_recipient.update().where(
                message_recipient.c.message_id == message_id,
                message_recipient.c.recipient_id == recipient_id
            ).values(is_read=True, read_at=datetime.now())
        )
        
        db.commit()
        return result.rowcount > 0


message_crud = CRUDMessage(Message)