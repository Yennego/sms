from typing import Any, List, Optional
from uuid import UUID
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status, Query, Body, Path
from sqlalchemy.orm import Session

from src.services.communication.message_service import MessageService, SuperAdminMessageService
from src.db.session import get_db
from src.schemas.communication.message import Message, MessageCreate, MessageUpdate, MessageWithDetails, MessageRecipientUpdate
from src.core.middleware.tenant import get_tenant_from_request
from src.core.auth.dependencies import has_any_role, get_current_user, has_permission
from src.schemas.auth import User
from src.core.exceptions.business import EntityNotFoundError

router = APIRouter()

# User message endpoints
@router.get("/messages", response_model=List[Message])
def get_messages(
    *,
    message_service: MessageService = Depends(),
    current_user: User = Depends(get_current_user),
    sent: bool = Query(False, description="Get messages sent by the current user"),
    received: bool = Query(False, description="Get messages received by the current user"),
    unread: bool = Query(False, description="Get unread messages for the current user")
) -> Any:
    """Get messages with optional filtering."""
    try:
        if sent:
            return message_service.get_messages_by_sender(sender_id=current_user.id)
        elif received or unread:
            if unread:
                return message_service.get_unread_messages(recipient_id=current_user.id)
            else:
                return message_service.get_messages_by_recipient(recipient_id=current_user.id)
        else:
            # Default to all messages (admin only)
            if "admin" not in current_user.roles:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You don't have permission to view all messages"
                )
            return message_service.list()
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

@router.get("/messages/{message_id}", response_model=MessageWithDetails)
def get_message(
    *,
    message_service: MessageService = Depends(),
    message_id: UUID = Path(..., description="The ID of the message to get"),
    current_user: User = Depends(get_current_user)
) -> Any:
    """Get a specific message with details."""
    try:
        message = message_service.get_message_with_details(id=message_id)
        if not message:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Message not found"
            )
        
        # Check if the current user is the sender, a recipient, or an admin
        is_sender = str(message.sender_id) == str(current_user.id)
        is_recipient = current_user.id in [recipient.id for recipient in message.recipients]
        is_admin = "admin" in current_user.roles
        
        if not (is_sender or is_recipient or is_admin):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have permission to view this message"
            )
        
        return message
    except EntityNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Message not found"
        )

@router.post("/messages", response_model=Message, status_code=status.HTTP_201_CREATED)
def create_message(
    *,
    message_service: MessageService = Depends(),
    message_in: MessageCreate,
    current_user: User = Depends(get_current_user)
) -> Any:
    """Create a new message."""
    try:
        # Set the sender to the current user if not specified
        if not message_in.sender_id:
            message_in.sender_id = current_user.id
        
        return message_service.create(obj_in=message_in)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

@router.put("/messages/{message_id}", response_model=Message)
def update_message(
    *,
    message_service: MessageService = Depends(),
    message_id: UUID = Path(..., description="The ID of the message to update"),
    message_in: MessageUpdate,
    current_user: User = Depends(get_current_user)
) -> Any:
    """Update a message."""
    try:
        message = message_service.get(id=message_id)
        if not message:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Message not found"
            )
        
        # Check if the current user is the sender or an admin
        if str(message.sender_id) != str(current_user.id) and "admin" not in current_user.roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have permission to update this message"
            )
        
        # Only allow updates to draft messages or by admins
        if not message.is_draft and "admin" not in current_user.roles:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot update a sent message"
            )
        
        return message_service.update(id=message_id, obj_in=message_in)
    except EntityNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Message not found"
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

@router.put("/messages/{message_id}/read", response_model=dict)
def mark_message_as_read(
    *,
    message_service: MessageService = Depends(),
    message_id: UUID = Path(..., description="The ID of the message to mark as read"),
    current_user: User = Depends(get_current_user)
) -> Any:
    """Mark a message as read for the current user."""
    try:
        success = message_service.mark_as_read(message_id=message_id, recipient_id=current_user.id)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Message not found or you are not a recipient"
            )
        return {"status": "success", "message": "Message marked as read"}
    except EntityNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Message not found"
        )

@router.delete("/messages/{message_id}", response_model=Message)
def delete_message(
    *,
    message_service: MessageService = Depends(),
    message_id: UUID = Path(..., description="The ID of the message to delete"),
    current_user: User = Depends(get_current_user)
) -> Any:
    """Delete a message."""
    try:
        message = message_service.get(id=message_id)
        if not message:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Message not found"
            )
        
        # Check if the current user is the sender or an admin
        if str(message.sender_id) != str(current_user.id) and "admin" not in current_user.roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have permission to delete this message"
            )
        
        return message_service.delete(id=message_id)
    except EntityNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Message not found"
        )

# Super Admin endpoints
@router.get("/super-admin/messages", response_model=List[Message])
def get_all_messages(
    *,
    message_service: SuperAdminMessageService = Depends(),
    skip: int = 0,
    limit: int = 100,
    sender_id: Optional[UUID] = None,
    is_draft: Optional[bool] = None,
    tenant_id: Optional[UUID] = None,
    current_user: User = Depends(has_permission("view_all_messages"))
) -> Any:
    """Get all messages across all tenants with filtering (super-admin only)."""
    try:
        return message_service.get_all_messages(
            skip=skip,
            limit=limit,
            sender_id=sender_id,
            is_draft=is_draft,
            tenant_id=tenant_id
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )