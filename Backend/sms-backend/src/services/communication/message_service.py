from typing import List, Optional, Dict, Any, Union
from uuid import UUID
from datetime import datetime

from src.db.crud.communication.message import message_crud
from src.db.models.communication.message import Message
from src.schemas.communication.message import MessageCreate, MessageUpdate, MessageWithDetails
from src.services.base.base import TenantBaseService, SuperAdminBaseService
# from src.core.exceptions.business import EntityNotFoundError


class MessageService(TenantBaseService[Message, MessageCreate, MessageUpdate]):
    """Service for managing messages within a tenant."""
    
    def __init__(self, *args, **kwargs):
        super().__init__(crud=message_crud, model=Message, *args, **kwargs)
    
    def get_messages_by_sender(self, sender_id: UUID) -> List[Message]:
        """Get all messages sent by a specific user."""
        return message_crud.get_messages_by_sender(
            self.db, tenant_id=self.tenant_id, sender_id=sender_id
        )
    
    def get_messages_by_recipient(self, recipient_id: UUID) -> List[Message]:
        """Get all messages received by a specific user."""
        return message_crud.get_messages_by_recipient(
            self.db, tenant_id=self.tenant_id, recipient_id=recipient_id
        )
    
    def get_unread_messages(self, recipient_id: UUID) -> List[Message]:
        """Get all unread messages for a specific user."""
        return message_crud.get_unread_messages(
            self.db, tenant_id=self.tenant_id, recipient_id=recipient_id
        )
    
    def mark_as_read(self, message_id: UUID, recipient_id: UUID) -> bool:
        """Mark a message as read for a specific recipient."""
        return message_crud.mark_as_read(
            self.db, tenant_id=self.tenant_id, message_id=message_id, recipient_id=recipient_id
        )
    
    def get_message_with_details(self, id: UUID) -> Optional[MessageWithDetails]:
        """Get a message with additional details like sender and recipient names."""
        message = self.get(id=id)
        if not message:
            return None
        
        # Get sender name
        sender = self.db.query("User").filter("User.id" == message.sender_id).first()
        sender_name = f"{sender.first_name} {sender.last_name}" if sender else "Unknown"
        
        # Get recipient names
        recipient_names = []
        for recipient in message.recipients:
            recipient_name = f"{recipient.first_name} {recipient.last_name}"
            recipient_names.append(recipient_name)
        
        # Get parent subject if applicable
        parent_subject = None
        if message.parent_id:
            parent = self.get(id=message.parent_id)
            parent_subject = parent.subject if parent else None
        
        # Create MessageWithDetails
        message_dict = message.__dict__.copy()
        message_dict["sender_name"] = sender_name
        message_dict["recipient_names"] = recipient_names
        message_dict["parent_subject"] = parent_subject
        
        return MessageWithDetails(**message_dict)


class SuperAdminMessageService(SuperAdminBaseService[Message, MessageCreate, MessageUpdate]):
    """Super-admin service for managing messages across all tenants."""
    
    def __init__(self, *args, **kwargs):
        super().__init__(crud=message_crud, model=Message, *args, **kwargs)
    
    def get_all_messages(self, skip: int = 0, limit: int = 100,
                        sender_id: Optional[UUID] = None,
                        is_draft: Optional[bool] = None,
                        tenant_id: Optional[UUID] = None) -> List[Message]:
        """Get all messages across all tenants with filtering."""
        query = self.db.query(Message)
        
        # Apply filters
        if sender_id:
            query = query.filter(Message.sender_id == sender_id)
        if is_draft is not None:
            query = query.filter(Message.is_draft == is_draft)
        if tenant_id:
            query = query.filter(Message.tenant_id == tenant_id)
        
        # Apply pagination and ordering
        return query.order_by(Message.sent_at.desc()).offset(skip).limit(limit).all()

