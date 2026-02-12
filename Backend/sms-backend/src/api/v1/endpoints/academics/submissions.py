from typing import List, Any
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from uuid import UUID

from src.db.session import get_db
from src.core.auth.dependencies import get_current_user
from src.schemas.academics.submission import SubmissionCreate, SubmissionResponse, SubmissionUpdate, SubmissionGrade
from src.services.academics.submission_service import SubmissionService
from src.services.people.student import StudentService
from src.schemas.auth import User

router = APIRouter()

@router.post("", response_model=SubmissionResponse)
async def create_submission(
    *,
    db: Session = Depends(get_db),
    submission_in: SubmissionCreate,
    current_user: User = Depends(get_current_user)
) -> Any:
    """Submit work for an assignment."""
    submission_service = SubmissionService(db, tenant_id=current_user.tenant_id)
    student_service = StudentService(db, tenant_id=current_user.tenant_id)
    
    # Verify current user is a student
    student = await student_service.get_by_user_id(current_user.id)
    if not student and current_user.role != "admin" and current_user.role != "super_admin":
        raise HTTPException(status_code=403, detail="Only students can submit work")
    
    # Use current user's student ID if not admin
    effective_student_id = student.id if student else submission_in.student_id
    if not effective_student_id:
         raise HTTPException(status_code=400, detail="Student ID is required")

    return submission_service.submit_assignment(
        student_id=effective_student_id,
        assignment_id=submission_in.assignment_id,
        tenant_id=current_user.tenant_id,
        submission_in=submission_in
    )

@router.get("/my-submissions", response_model=List[SubmissionResponse])
async def get_my_submissions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    """Get all submissions for the current student."""
    submission_service = SubmissionService(db, tenant_id=current_user.tenant_id)
    student_service = StudentService(db, tenant_id=current_user.tenant_id)
    
    student = await student_service.get_by_user_id(current_user.id)
    if not student:
        raise HTTPException(status_code=403, detail="Not a student")
        
    return submission_service.get_student_submissions(
        student_id=student.id, tenant_id=current_user.tenant_id
    )

@router.get("/assignment/{assignment_id}", response_model=List[SubmissionResponse])
def get_assignment_submissions(
    assignment_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    """Get all submissions for a specific assignment (Teacher/Admin)."""
    # Check both polymorphic type and assigned roles
    user_roles = {role.name for role in current_user.roles}
    is_authorized = (
        current_user.role in ["admin", "teacher", "super_admin"] or
        "admin" in user_roles or
        "teacher" in user_roles or
        "super-admin" in user_roles or
        "superadmin" in user_roles
    )
    
    if not is_authorized:
        raise HTTPException(status_code=403, detail="Not authorized to view submissions")
        
    submission_service = SubmissionService(db, tenant_id=current_user.tenant_id)
    return submission_service.get_assignment_submissions(
        assignment_id=assignment_id, tenant_id=current_user.tenant_id
    )

@router.get("/student/{student_id}", response_model=List[SubmissionResponse])
def get_student_submissions_by_id(
    student_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    """Get all submissions for a specific student (Teacher/Admin)."""
    if current_user.role not in ["admin", "teacher", "super_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized to view student submissions")
        
    submission_service = SubmissionService(db, tenant_id=current_user.tenant_id)
    return submission_service.get_student_submissions(
        student_id=student_id, tenant_id=current_user.tenant_id
    )

@router.get("/{submission_id}", response_model=SubmissionResponse)
def get_submission_by_id(
    submission_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    """Get a specific submission by ID."""
    submission_service = SubmissionService(db, tenant_id=current_user.tenant_id)
    # Use get_by_id for TenantCRUDBase compatibility
    from src.db.crud.academics.submission import submission as submission_crud_instance
    submission = submission_crud_instance.get_by_id(db, tenant_id=current_user.tenant_id, id=submission_id)
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    
    # Check permissions (student can only see their own, teacher can see any in their tenant)
    if current_user.role == "student":
        student_service = StudentService(db)
        student = student_service.get_by_user_id(current_user.id)
        if not student or submission.student_id != student.id:
            raise HTTPException(status_code=403, detail="Not authorized to view this submission")
    
    return submission

@router.put("/{submission_id}/grade", response_model=SubmissionResponse)
def grade_submission(
    submission_id: UUID,
    grade_data: SubmissionGrade,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    """Grade a student submission (Teacher/Admin)."""
    if current_user.role not in ["admin", "teacher", "super_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized to grade submissions")
        
    submission_service = SubmissionService(db, tenant_id=current_user.tenant_id)
    return submission_service.grade_submission(
        submission_id=submission_id,
        score=grade_data.score,
        feedback=grade_data.feedback,
        graded_by=current_user.id
    )
