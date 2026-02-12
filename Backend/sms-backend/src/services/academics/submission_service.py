from typing import List, Optional
from sqlalchemy.orm import Session
from uuid import UUID
from datetime import date

from src.services.base import TenantBaseService
from src.db.models.academics.submission import Submission
from src.db.models.academics.grade import Grade, GradeType
from src.db.models.academics.assignment import Assignment
from src.db.models.academics.enrollment import Enrollment
from src.schemas.academics.submission import SubmissionCreate, SubmissionUpdate
from src.db.crud.academics.submission import submission as submission_crud
from src.db.crud.academics.grade import grade as grade_crud

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
        from fastapi import HTTPException
        
        submission = submission_crud.get_by_id(self.db, tenant_id=self.tenant_id, id=submission_id)
        if not submission:
            raise HTTPException(status_code=404, detail="Submission not found")
        
        # Update the submission with score and feedback
        update_data = {"score": score, "feedback": feedback, "status": "GRADED"}
        updated_submission = submission_crud.update(self.db, tenant_id=self.tenant_id, db_obj=submission, obj_in=update_data)
        
        # Now also create/update a corresponding Grade record
        self._sync_grade_record(
            submission=updated_submission,
            score=score,
            feedback=feedback,
            graded_by=graded_by
        )
        
        return updated_submission

    def _sync_grade_record(self, submission: Submission, score: float, feedback: Optional[str], graded_by: Optional[UUID]):
        """Sync the submission grade with the grades table."""
        try:
            # Get the assignment to fetch subject_id, max_score, etc.
            assignment = self.db.query(Assignment).filter(Assignment.id == submission.assignment_id).first()
            if not assignment:
                return  # Can't sync without assignment details
            
            # Find the student's enrollment for this grade level
            enrollment = self.db.query(Enrollment).filter(
                Enrollment.student_id == submission.student_id,
                Enrollment.academic_grade_id == assignment.grade_id,
                Enrollment.tenant_id == self.tenant_id,
                Enrollment.status == 'active'
            ).first()
            
            if not enrollment:
                # Try to find any active enrollment for this student
                enrollment = self.db.query(Enrollment).filter(
                    Enrollment.student_id == submission.student_id,
                    Enrollment.tenant_id == self.tenant_id,
                    Enrollment.status == 'active'
                ).first()
            
            if not enrollment:
                return  # Can't sync without enrollment
            
            # Calculate percentage
            percentage = (score / assignment.max_score * 100) if assignment.max_score > 0 else 0
            
            # Check if a grade record already exists for this assessment
            existing_grade = self.db.query(Grade).filter(
                Grade.tenant_id == self.tenant_id,
                Grade.student_id == submission.student_id,
                Grade.assessment_type == GradeType.ASSIGNMENT,
                Grade.assessment_id == assignment.id
            ).first()
            
            if existing_grade:
                # Update existing grade
                existing_grade.score = score
                existing_grade.percentage = percentage
                existing_grade.comments = feedback
                existing_grade.graded_by = graded_by
                existing_grade.graded_date = date.today()
                self.db.add(existing_grade)
            else:
                # Create new grade record
                new_grade = Grade(
                    tenant_id=self.tenant_id,
                    student_id=submission.student_id,
                    enrollment_id=enrollment.id,
                    subject_id=assignment.subject_id,
                    assessment_type=GradeType.ASSIGNMENT,
                    assessment_id=assignment.id,
                    assessment_name=assignment.title,
                    assessment_date=assignment.due_date,
                    score=score,
                    max_score=assignment.max_score,
                    percentage=percentage,
                    comments=feedback,
                    graded_by=graded_by,
                    graded_date=date.today()
                )
                self.db.add(new_grade)
            
            self.db.commit()
        except Exception as e:
            # Log but don't fail the submission grading if grade sync fails
            print(f"Warning: Failed to sync grade record: {e}")
            self.db.rollback()
