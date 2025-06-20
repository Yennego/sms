from typing import Any, List, Optional, Dict
from uuid import UUID
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status, Query, Body, Path
from sqlalchemy.orm import Session

from src.services.communication.announcement_service import AnnouncementService, SuperAdminAnnouncementService
from src.db.session import get_db
from src.schemas.communication.announcement import Announcement, AnnouncementCreate, AnnouncementUpdate, AnnouncementWithDetails
from src.core.middleware.tenant import get_tenant_from_request
from src.core.auth.dependencies import has_any_role, get_current_user, has_permission
from src.schemas.auth import User
from src.core.exceptions.business import EntityNotFoundError

router = APIRouter()

# User announcement endpoints
@router.get("/announcements", response_model=List[Announcement])
def get_announcements(
    *,
    announcement_service: AnnouncementService = Depends(),
    current_user: User = Depends(get_current_user),
    active_only: bool = Query(True, description="Filter to show only active announcements"),
    pinned_only: bool = Query(False, description="Filter to show only pinned announcements"),
    author_id: Optional[UUID] = Query(None, description="Filter by author ID"),
    target_type: Optional[str] = Query(None, description="Filter by target type")
) -> Any:
    """Get announcements with optional filtering."""
    try:
        if pinned_only:
            return announcement_service.get_pinned_announcements()
        elif active_only:
            return announcement_service.get_active_announcements()
        elif author_id:
            return announcement_service.get_announcements_by_author(author_id=author_id)
        elif target_type:
            return announcement_service.get_announcements_by_target_type(target_type=target_type)
        else:
            # Default to all announcements
            return announcement_service.list()
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

@router.get("/announcements/{announcement_id}", response_model=AnnouncementWithDetails)
def get_announcement(
    *,
    announcement_service: AnnouncementService = Depends(),
    announcement_id: UUID = Path(..., description="The ID of the announcement to get"),
    current_user: User = Depends(get_current_user)
) -> Any:
    """Get a specific announcement with details."""
    try:
        announcement = announcement_service.get_announcement_with_details(id=announcement_id)
        if not announcement:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Announcement not found"
            )
        return announcement
    except EntityNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Announcement not found"
        )

# Admin announcement endpoints
@router.post("/announcements", response_model=Announcement, status_code=status.HTTP_201_CREATED)
def create_announcement(
    *,
    announcement_service: AnnouncementService = Depends(),
    announcement_in: AnnouncementCreate,
    current_user: User = Depends(has_any_role(["admin", "teacher"]))
) -> Any:
    """Create a new announcement (admin or teacher only)."""
    try:
        # Set the author to the current user if not specified
        if not announcement_in.author_id:
            announcement_in.author_id = current_user.id
        
        return announcement_service.create(obj_in=announcement_in)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

@router.put("/announcements/{announcement_id}", response_model=Announcement)
def update_announcement(
    *,
    announcement_service: AnnouncementService = Depends(),
    announcement_id: UUID = Path(..., description="The ID of the announcement to update"),
    announcement_in: AnnouncementUpdate,
    current_user: User = Depends(has_any_role(["admin", "teacher"]))
) -> Any:
    """Update an announcement (admin or teacher only)."""
    try:
        announcement = announcement_service.get(id=announcement_id)
        if not announcement:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Announcement not found"
            )
        
        # Check if the current user is the author or an admin
        if str(announcement.author_id) != str(current_user.id) and "admin" not in current_user.roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have permission to update this announcement"
            )
        
        return announcement_service.update(id=announcement_id, obj_in=announcement_in)
    except EntityNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Announcement not found"
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

@router.delete("/announcements/{announcement_id}", response_model=Announcement)
def delete_announcement(
    *,
    announcement_service: AnnouncementService = Depends(),
    announcement_id: UUID = Path(..., description="The ID of the announcement to delete"),
    current_user: User = Depends(has_any_role(["admin", "teacher"]))
) -> Any:
    """Delete an announcement (admin or teacher only)."""
    try:
        announcement = announcement_service.get(id=announcement_id)
        if not announcement:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Announcement not found"
            )
        
        # Check if the current user is the author or an admin
        if str(announcement.author_id) != str(current_user.id) and "admin" not in current_user.roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have permission to delete this announcement"
            )
        
        return announcement_service.delete(id=announcement_id)
    except EntityNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Announcement not found"
        )

# Super Admin endpoints
@router.get("/super-admin/announcements", response_model=List[Announcement])
def get_all_announcements(
    *,
    announcement_service: SuperAdminAnnouncementService = Depends(),
    skip: int = 0,
    limit: int = 100,
    author_id: Optional[UUID] = None,
    target_type: Optional[str] = None,
    is_active: Optional[bool] = None,
    is_pinned: Optional[bool] = None,
    tenant_id: Optional[UUID] = None,
    current_user: User = Depends(has_permission("view_all_announcements"))
) -> Any:
    """Get all announcements across all tenants with filtering (super-admin only)."""
    try:
        return announcement_service.get_all_announcements(
            skip=skip,
            limit=limit,
            author_id=author_id,
            target_type=target_type,
            is_active=is_active,
            is_pinned=is_pinned,
            tenant_id=tenant_id
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )