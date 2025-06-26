from typing import Any, List, Optional
from uuid import UUID
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status, Query, Body, Path
from sqlalchemy.orm import Session

from src.services.communication.feedback_service import FeedbackService, SuperAdminFeedbackService
from src.db.session import get_db
from src.schemas.communication.feedback import Feedback, FeedbackCreate, FeedbackUpdate, FeedbackWithDetails
from src.core.middleware.tenant import get_tenant_from_request
from src.core.auth.dependencies import has_any_role, get_current_user, has_permission
from src.schemas.auth import User
from src.core.exceptions.business import EntityNotFoundError

router = APIRouter()

# User feedback endpoints
@router.get("/feedbacks", response_model=List[Feedback])
def get_feedbacks(
    *,
    feedback_service: FeedbackService = Depends(),
    current_user: User = Depends(get_current_user),
    submitter_id: Optional[UUID] = Query(None, description="Filter by submitter ID"),
    assignee_id: Optional[UUID] = Query(None, description="Filter by assignee ID"),
    status: Optional[str] = Query(None, description="Filter by status"),
    feedback_type: Optional[str] = Query(None, description="Filter by feedback type")
) -> Any:
    """Get feedbacks with optional filtering."""
    try:
        if submitter_id:
            return feedback_service.get_feedbacks_by_submitter(submitter_id=submitter_id)
        elif assignee_id:
            return feedback_service.get_feedbacks_by_assignee(assignee_id=assignee_id)
        elif status:
            return feedback_service.get_feedbacks_by_status(status=status)
        elif feedback_type:
            return feedback_service.get_feedbacks_by_type(feedback_type=feedback_type)
        else:
            # Default to all feedbacks
            return feedback_service.list()
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

@router.get("/feedbacks/{feedback_id}", response_model=FeedbackWithDetails)
def get_feedback(
    *,
    feedback_service: FeedbackService = Depends(),
    feedback_id: UUID = Path(..., description="The ID of the feedback to get"),
    current_user: User = Depends(get_current_user)
) -> Any:
    """Get a specific feedback with details."""
    try:
        feedback = feedback_service.get_feedback_with_details(id=feedback_id)
        if not feedback:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Feedback not found"
            )
        return feedback
    except EntityNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Feedback not found"
        )

@router.post("/feedbacks", response_model=Feedback, status_code=status.HTTP_201_CREATED)
def create_feedback(
    *,
    feedback_service: FeedbackService = Depends(),
    feedback_in: FeedbackCreate,
    current_user: User = Depends(get_current_user)
) -> Any:
    """Create a new feedback."""
    try:
        # Set the submitter to the current user if not specified
        if not feedback_in.submitter_id:
            feedback_in.submitter_id = current_user.id
        
        return feedback_service.create(obj_in=feedback_in)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

@router.put("/feedbacks/{feedback_id}", response_model=Feedback)
def update_feedback(
    *,
    feedback_service: FeedbackService = Depends(),
    feedback_id: UUID = Path(..., description="The ID of the feedback to update"),
    feedback_in: FeedbackUpdate,
    current_user: User = Depends(get_current_user)
) -> Any:
    """Update a feedback."""
    try:
        feedback = feedback_service.get(id=feedback_id)
        if not feedback:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Feedback not found"
            )
        
        # Check if the current user is the submitter, assignee, or an admin
        is_submitter = str(feedback.submitter_id) == str(current_user.id)
        is_assignee = feedback.assignee_id and str(feedback.assignee_id) == str(current_user.id)
        is_admin = "admin" in current_user.roles
        
        if not (is_submitter or is_assignee or is_admin):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have permission to update this feedback"
            )
        
        return feedback_service.update(id=feedback_id, obj_in=feedback_in)
    except EntityNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Feedback not found"
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

@router.delete("/feedbacks/{feedback_id}", response_model=Feedback)
def delete_feedback(
    *,
    feedback_service: FeedbackService = Depends(),
    feedback_id: UUID = Path(..., description="The ID of the feedback to delete"),
    current_user: User = Depends(has_any_role(["admin"]))
) -> Any:
    """Delete a feedback (admin only)."""
    try:
        feedback = feedback_service.get(id=feedback_id)
        if not feedback:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Feedback not found"
            )
        
        return feedback_service.delete(id=feedback_id)
    except EntityNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Feedback not found"
        )

# Super Admin endpoints
@router.get("/super-admin/feedbacks", response_model=List[Feedback])
def get_all_feedbacks(
    *,
    feedback_service: SuperAdminFeedbackService = Depends(),
    skip: int = 0,
    limit: int = 100,
    submitter_id: Optional[UUID] = None,
    assignee_id: Optional[UUID] = None,
    status: Optional[str] = None,
    feedback_type: Optional[str] = None,
    tenant_id: Optional[UUID] = None,
    current_user: User = Depends(has_permission("view_all_feedbacks"))
) -> Any:
    """Get all feedbacks across all tenants with filtering (super-admin only)."""
    try:
        return feedback_service.get_all_feedbacks(
            skip=skip,
            limit=limit,
            submitter_id=submitter_id,
            assignee_id=assignee_id,
            status=status,
            feedback_type=feedback_type,
            tenant_id=tenant_id
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )