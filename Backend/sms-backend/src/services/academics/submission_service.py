from typing import List, Optional
from sqlalchemy.orm import Session
from uuid import UUID

from src.services.base import TenantBaseService
from src.db.models.academics.submission import Submission
from src.schemas.academics.submission import SubmissionCreate, SubmissionUpdate
from src.db.crud.academics.submission import submission as submission_crud

class SubmissionService(TenantBaseService[Submission, SubmissionCreate, SubmissionUpdate]):
    def __init__(self, db: Session, tenant_id: Optional[UUID] = None):
        # Allow tenant_id to be optional for backward compatibility, defaulting to a dummy UUID if needed to satisfy base class
        # This prevents crashes when service is instantiated without a tenant context
        from uuid import UUID
        safe_tenant_id = tenant_id or UUID('00000000-0000-0000-0000-000000000000')
        super().__init__(crud=submission_crud, model=Submission, tenant_id=safe_tenant_id, db=db)

    def submit_assignment(
        self, student_id: UUID, assignment_id: UUID, tenant_id: UUID, submission_in: SubmissionCreate
    ) -> Submission:
        # Check if already submitted
        existing = submission_crud.get_by_assignment_and_student(
            self.db, assignment_id=assignment_id, student_id=student_id, tenant_id=tenant_id
        )
        if existing:
            # Update existing submission
            update_data = submission_in.model_dump(exclude={"assignment_id"})
            return submission_crud.update(self.db, db_obj=existing, obj_in=update_data)
        
        # Create new submission
        return submission_crud.create_with_tenant(
            self.db, obj_in=submission_in, tenant_id=tenant_id, extra_data={"student_id": student_id}
        )

    def get_assignment_submissions(self, assignment_id: UUID, tenant_id: UUID) -> List[Submission]:
        return submission_crud.get_multi_by_assignment(
            self.db, assignment_id=assignment_id, tenant_id=tenant_id
        )

    def get_student_submissions(self, student_id: UUID, tenant_id: UUID) -> List[Submission]:
        return submission_crud.get_multi_by_student(
            self.db, student_id=student_id, tenant_id=tenant_id
        )

    def grade_submission(self, submission_id: UUID, score: float, feedback: Optional[str] = None, graded_by: Optional[UUID] = None) -> Submission:
        """Homework feedback on the submission itself. It is not a mark: marks that count are
        entered in the gradebook (phase4-design.md §2), so nothing is written to score_entries."""
        from fastapi import HTTPException

        submission = submission_crud.get_by_id(self.db, tenant_id=self.tenant_id, id=submission_id)
        if not submission:
            raise HTTPException(status_code=404, detail="Submission not found")

        update_data = {"score": score, "feedback": feedback, "status": "GRADED"}
        return submission_crud.update(self.db, tenant_id=self.tenant_id, db_obj=submission, obj_in=update_data)
