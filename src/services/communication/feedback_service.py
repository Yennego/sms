from typing import List, Optional, Dict, Any, Union
from uuid import UUID
from datetime import datetime

from src.db.crud.communication.feedback import feedback_crud
from src.db.models.communication.feedback import Feedback, FeedbackStatus, FeedbackType
from src.schemas.communication.feedback import FeedbackCreate, FeedbackUpdate, FeedbackWithDetails
from src.services.base.base import TenantBaseService, SuperAdminBaseService
# from src.core.exceptions.business import EntityNotFoundError


class FeedbackService(TenantBaseService[Feedback, FeedbackCreate, FeedbackUpdate]):
    """Service for managing feedbacks within a tenant."""
    
    def __init__(self, *args, **kwargs):
        super().__init__(crud=feedback_crud, model=Feedback, *args, **kwargs)
    
    def get_feedbacks_by_submitter(self, submitter_id: UUID) -> List[Feedback]:
        """Get all feedbacks submitted by a specific user."""
        return feedback_crud.get_feedbacks_by_submitter(
            self.db, tenant_id=self.tenant_id, submitter_id=submitter_id
        )
    
    def get_feedbacks_by_assignee(self, assignee_id: UUID) -> List[Feedback]:
        """Get all feedbacks assigned to a specific user."""
        return feedback_crud.get_feedbacks_by_assignee(
            self.db, tenant_id=self.tenant_id, assignee_id=assignee_id
        )
    
    def get_feedbacks_by_status(self, status: str) -> List[Feedback]:
        """Get all feedbacks with a specific status."""
        try:
            status_enum = FeedbackStatus(status)
            return feedback_crud.get_feedbacks_by_status(
                self.db, tenant_id=self.tenant_id, status=status_enum
            )
        except ValueError:
            raise ValueError(f"Invalid status: {status}")
    
    def get_feedbacks_by_type(self, feedback_type: str) -> List[Feedback]:
        """Get all feedbacks of a specific type."""
        try:
            type_enum = FeedbackType(feedback_type)
            return feedback_crud.get_feedbacks_by_type(
                self.db, tenant_id=self.tenant_id, feedback_type=type_enum
            )
        except ValueError:
            raise ValueError(f"Invalid feedback type: {feedback_type}")
    
    def get_feedback_with_details(self, id: UUID) -> Optional[FeedbackWithDetails]:
        """Get a feedback with additional details like submitter and assignee names."""
        feedback = self.get(id=id)
        if not feedback:
            return None
        
        # Get submitter name
        submitter = self.db.query("User").filter("User.id" == feedback.submitter_id).first()
        submitter_name = f"{submitter.first_name} {submitter.last_name}" if submitter else "Unknown"
        
        # Get assignee name if applicable
        assignee_name = None
        if feedback.assignee_id:
            assignee = self.db.query("User").filter("User.id" == feedback.assignee_id).first()
            assignee_name = f"{assignee.first_name} {assignee.last_name}" if assignee else "Unknown"
        
        # Create FeedbackWithDetails
        feedback_dict = feedback.__dict__.copy()
        feedback_dict["submitter_name"] = submitter_name
        feedback_dict["assignee_name"] = assignee_name
        
        return FeedbackWithDetails(**feedback_dict)


class SuperAdminFeedbackService(SuperAdminBaseService[Feedback, FeedbackCreate, FeedbackUpdate]):
    """Super-admin service for managing feedbacks across all tenants."""
    
    def __init__(self, *args, **kwargs):
        super().__init__(crud=feedback_crud, model=Feedback, *args, **kwargs)
    
    def get_all_feedbacks(self, skip: int = 0, limit: int = 100,
                         submitter_id: Optional[UUID] = None,
                         assignee_id: Optional[UUID] = None,
                         status: Optional[str] = None,
                         feedback_type: Optional[str] = None,
                         tenant_id: Optional[UUID] = None) -> List[Feedback]:
        """Get all feedbacks across all tenants with filtering."""
        query = self.db.query(Feedback)
        
        # Apply filters
        if submitter_id:
            query = query.filter(Feedback.submitter_id == submitter_id)
        if assignee_id:
            query = query.filter(Feedback.assignee_id == assignee_id)
        if status:
            try:
                status_enum = FeedbackStatus(status)
                query = query.filter(Feedback.status == status_enum)
            except ValueError:
                raise ValueError(f"Invalid status: {status}")
        if feedback_type:
            try:
                type_enum = FeedbackType(feedback_type)
                query = query.filter(Feedback.feedback_type == type_enum)
            except ValueError:
                raise ValueError(f"Invalid feedback type: {feedback_type}")
        if tenant_id:
            query = query.filter(Feedback.tenant_id == tenant_id)
        
        # Apply pagination and ordering
        return query.order_by(Feedback.submission_date.desc()).offset(skip).limit(limit).all()