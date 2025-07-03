from typing import List, Optional, Dict, Any
from uuid import UUID
from sqlalchemy.orm import Session
from sqlalchemy import desc

from src.db.crud.base.base import TenantCRUDBase
from src.db.models.communication.feedback import Feedback, FeedbackStatus, FeedbackType
from src.schemas.communication.feedback import FeedbackCreate, FeedbackUpdate


class CRUDFeedback(TenantCRUDBase[Feedback, FeedbackCreate, FeedbackUpdate]):
    """CRUD operations for Feedback model."""
    
    def get_feedbacks_by_submitter(self, db: Session, tenant_id: Any, submitter_id: Any) -> List[Feedback]:
        """Get all feedbacks submitted by a specific user within a tenant."""
        return db.query(Feedback).filter(
            Feedback.tenant_id == tenant_id,
            Feedback.submitter_id == submitter_id
        ).order_by(desc(Feedback.submission_date)).all()
    
    def get_feedbacks_by_assignee(self, db: Session, tenant_id: Any, assignee_id: Any) -> List[Feedback]:
        """Get all feedbacks assigned to a specific user within a tenant."""
        return db.query(Feedback).filter(
            Feedback.tenant_id == tenant_id,
            Feedback.assignee_id == assignee_id
        ).order_by(desc(Feedback.submission_date)).all()
    
    def get_feedbacks_by_status(self, db: Session, tenant_id: Any, status: FeedbackStatus) -> List[Feedback]:
        """Get all feedbacks with a specific status within a tenant."""
        return db.query(Feedback).filter(
            Feedback.tenant_id == tenant_id,
            Feedback.status == status
        ).order_by(desc(Feedback.submission_date)).all()
    
    def get_feedbacks_by_type(self, db: Session, tenant_id: Any, feedback_type: FeedbackType) -> List[Feedback]:
        """Get all feedbacks of a specific type within a tenant."""
        return db.query(Feedback).filter(
            Feedback.tenant_id == tenant_id,
            Feedback.feedback_type == feedback_type
        ).order_by(desc(Feedback.submission_date)).all()


feedback_crud = CRUDFeedback(Feedback)

