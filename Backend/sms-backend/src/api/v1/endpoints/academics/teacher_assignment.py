from typing import Any, List, Optional, Dict
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, Query, Body
from sqlalchemy.orm import Session

from src.services.academics.teacher_assignment_service import TeacherAssignmentService
from src.db.session import get_db
from src.core.middleware.tenant import get_tenant_from_request
from src.core.auth.dependencies import has_any_role, get_current_user
from src.schemas.auth import User
from src.schemas.academics.class_schema import Class, ClassCreate, ClassUpdate, BulkDeleteRequest, BulkReassignRequest
from src.schemas.academics.class_subject_schema import ClassSubjectWithDetails
from src.core.exceptions.business import EntityNotFoundError, BusinessRuleViolationError, DuplicateEntityError

router = APIRouter()

def get_service(
    tenant: Any = Depends(get_tenant_from_request),
    db: Session = Depends(get_db)
) -> TeacherAssignmentService:
    tenant_id = tenant.id if hasattr(tenant, 'id') else tenant
    return TeacherAssignmentService(tenant_id=tenant_id, db=db)

def map_assignment_to_details(a) -> Dict[str, Any]:
    """Helper to map a ClassSubject model to ClassWithDetails dict."""
    return {
        "id": str(a.id),
        "tenant_id": str(a.tenant_id),
        "class_id": str(a.class_id),
        "name": a.class_obj.name if a.class_obj else "Unknown Class",
        "class_name": f"{a.subject.name} - {a.class_obj.grade.name} {a.class_obj.section.name}" if (a.subject and a.class_obj and a.class_obj.grade) else "Unknown",
        "academic_year": a.class_obj.academic_year.name if (a.class_obj and a.class_obj.academic_year) else None,
        "academic_year_id": str(a.class_obj.academic_year_id) if a.class_obj else None,
        "grade_id": str(a.class_obj.grade_id) if a.class_obj else None,
        "section_id": str(a.class_obj.section_id) if a.class_obj else None,
        "subject_id": str(a.subject_id),
        "teacher_id": str(a.teacher_id),
        "grade_name": a.class_obj.grade.name if (a.class_obj and a.class_obj.grade) else "Unknown",
        "section_name": a.class_obj.section.name if (a.class_obj and a.class_obj.section) else "Unknown",
        "subject_name": a.subject.name if a.subject else "Unknown",
        "teacher_name": f"{a.teacher.first_name} {a.teacher.last_name}" if a.teacher else "Unknown Teacher",
        "is_assigned": True,
        "created_at": a.created_at,
        "updated_at": a.updated_at
    }

@router.get("/{id}/students", response_model=List[Dict[str, Any]])
async def get_class_students(
    *,
    service: TeacherAssignmentService = Depends(get_service),
    id: UUID,
    current_user: User = Depends(has_any_role(["admin", "teacher"]))
) -> Any:
    """Get students for a specific class assignment (ClassSubject)."""
    try:
        return await service.get_students_for_class(id)
    except EntityNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.post("", response_model=Dict[str, Any])
async def create_assignment(
    *,
    service: TeacherAssignmentService = Depends(get_service),
    assignment_in: Any = Body(...), # Flexible input to handle legacy frontend
    current_user: User = Depends(has_any_role(["admin", "teacher"]))
) -> Any:
    """Create a new teacher assignment (ClassSubject)."""
    try:
        # assignment_in is Any because it might match ClassCreate or ClassSubjectCreate
        # The service.create is now robust enough to handle the mapping.
        from pydantic import BaseModel
        class GenericAssignment(BaseModel):
            grade_id: UUID
            section_id: UUID
            subject_id: UUID
            teacher_id: UUID
            academic_year: Optional[str] = None
            academic_year_id: Optional[UUID] = None

        data = GenericAssignment(**assignment_in)
        assignment = await service.create(obj_in=data)
        return map_assignment_to_details(assignment)
    except Exception as e:
        import traceback
        print(f"[create_assignment] Error: {e}")
        print(traceback.format_exc())
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/teacher/{teacher_id}", response_model=List[ClassSubjectWithDetails])
async def get_teacher_assignments(
    *,
    service: TeacherAssignmentService = Depends(get_service),
    teacher_id: UUID,
    academic_year_id: Optional[UUID] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    current_user: User = Depends(has_any_role(["admin", "teacher"]))
) -> Any:
    """Get all assignments for a specific teacher."""
    assignments = service.get_by_teacher(teacher_id, academic_year_id, skip=skip, limit=limit)
    return [ClassSubjectWithDetails(**map_assignment_to_details(a)) for a in assignments]

@router.get("/all", response_model=List[ClassSubjectWithDetails])
async def get_all_assignments(
    *,
    service: TeacherAssignmentService = Depends(get_service),
    academic_year_id: Optional[UUID] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    current_user: User = Depends(has_any_role(["admin", "teacher"]))
) -> Any:
    """Get all assignments."""
    assignments = service.get_all_assignments(academic_year_id, skip=skip, limit=limit)
    return [ClassSubjectWithDetails(**map_assignment_to_details(a)) for a in assignments]

@router.get("/workload")
async def get_teacher_workload(
    *,
    service: TeacherAssignmentService = Depends(get_service),
    academic_year_id: UUID = Query(...),
    current_user: User = Depends(has_any_role(["admin"]))
) -> Any:
    """Get workload stats for all teachers."""
    return service.get_teacher_workload(academic_year_id)

@router.get("/unassigned")
async def get_unassigned_subjects(
    *,
    service: TeacherAssignmentService = Depends(get_service),
    academic_year_id: UUID = Query(...),
    current_user: User = Depends(has_any_role(["admin"]))
) -> Any:
    """Get unassigned subjects."""
    return service.get_unassigned_subjects(academic_year_id)

@router.get("/sponsors", response_model=List[Dict[str, Any]])
async def get_class_sponsors(
    *,
    service: TeacherAssignmentService = Depends(get_service),
    academic_year_id: Optional[UUID] = Query(None),
    current_user: User = Depends(has_any_role(["admin"]))
) -> Any:
    """Get all class sponsors (section-teacher links)."""
    return service.get_class_sponsors(academic_year_id)

@router.put("/reassign")
async def reassign_teacher(
    *,
    service: TeacherAssignmentService = Depends(get_service),
    grade_id: UUID,
    section_id: UUID,
    subject_id: UUID,
    academic_year_id: UUID,
    new_teacher_id: UUID,
    current_user: User = Depends(has_any_role(["admin"]))
) -> Any:
    """Reassign a class to a different teacher."""
    # This logic should be moved to service for consistency if needed, 
    # but for now we'll call the service create/update logic.
    # Actually service has a reassign_teacher but it was based on old Class model.
    # Refactoring it here for ClassSubject:
    try:
        class_obj = service.db.query(Class).filter(
            Class.tenant_id == service.tenant_id,
            Class.academic_year_id == academic_year_id,
            Class.grade_id == grade_id,
            Class.section_id == section_id
        ).first()
        if not class_obj: raise EntityNotFoundError("Class not found")
        
        assignment = service.db.query(ClassSubject).filter(
            ClassSubject.tenant_id == service.tenant_id,
            ClassSubject.class_id == class_obj.id,
            ClassSubject.subject_id == subject_id
        ).first()
        if not assignment: raise EntityNotFoundError("Assignment not found")
        
        assignment.teacher_id = new_teacher_id
        service.db.commit()
        return map_assignment_to_details(assignment)
    except EntityNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.delete("/remove")
async def remove_assignment(
    *,
    service: TeacherAssignmentService = Depends(get_service),
    grade_id: UUID,
    section_id: UUID,
    subject_id: UUID,
    academic_year_id: UUID,
    current_user: User = Depends(has_any_role(["admin"]))
) -> Any:
    """Remove an assignment (ClassSubject)."""
    class_obj = service.db.query(Class).filter(
        Class.tenant_id == service.tenant_id,
        Class.academic_year_id == academic_year_id,
        Class.grade_id == grade_id,
        Class.section_id == section_id
    ).first()
    if class_obj:
        assignment = service.db.query(ClassSubject).filter(
            ClassSubject.tenant_id == service.tenant_id,
            ClassSubject.class_id == class_obj.id,
            ClassSubject.subject_id == subject_id
        ).first()
        if assignment:
            service.db.delete(assignment)
            service.db.commit()
    return {"message": "Assignment removed"}

@router.put("/assign-sponsor/{section_id}")
async def assign_class_sponsor(
    *,
    service: TeacherAssignmentService = Depends(get_service),
    section_id: UUID,
    teacher_id: UUID = Body(..., embed=True),
    current_user: User = Depends(has_any_role(["admin"]))
) -> Any:
    """Assign a teacher as a class sponsor for a specific section."""
    try:
        return service.assign_section_sponsor(section_id, teacher_id)
    except EntityNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.get("/{id}", response_model=ClassSubjectWithDetails)
async def get_assignment(
    *,
    service: TeacherAssignmentService = Depends(get_service),
    id: UUID,
    current_user: User = Depends(has_any_role(["admin", "teacher"]))
) -> Any:
    """Get assignment by ID."""
    assignment = service.get_assignment_with_details(id=id)
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    return ClassSubjectWithDetails(**map_assignment_to_details(assignment))

@router.put("/{id}", response_model=ClassSubjectWithDetails)
async def update_assignment(
    *,
    service: TeacherAssignmentService = Depends(get_service),
    id: UUID,
    assignment_in: Any = Body(...),
    current_user: User = Depends(has_any_role(["admin"]))
) -> Any:
    """Update assignment (teacher_id or grading_schema_id)."""
    try:
        assignment = await service.get(id=id)
        if not assignment:
             raise HTTPException(status_code=404, detail="Assignment not found")
        
        # update fields
        if 'teacher_id' in assignment_in:
            assignment.teacher_id = assignment_in['teacher_id']
        if 'grading_schema_id' in assignment_in:
            assignment.grading_schema_id = assignment_in['grading_schema_id']
            
        service.db.commit()
        full_assignment = service.get_assignment_with_details(id=id)
        return ClassSubjectWithDetails(**map_assignment_to_details(full_assignment))
    except EntityNotFoundError:
        raise HTTPException(status_code=404, detail="Assignment not found")

@router.delete("/{id}")
async def delete_assignment(
    *,
    service: TeacherAssignmentService = Depends(get_service),
    id: UUID,
    current_user: User = Depends(has_any_role(["admin"]))
) -> Any:
    """Delete assignment."""
    try:
        await service.delete(id=id)
        return {"message": "Assignment deleted"}
    except EntityNotFoundError:
        raise HTTPException(status_code=404, detail="Assignment not found")

@router.post("/bulk-delete")
async def bulk_delete_assignments(
    *,
    service: TeacherAssignmentService = Depends(get_service),
    request: BulkDeleteRequest,
    current_user: User = Depends(has_any_role(["admin"]))
) -> Any:
    """Bulk delete assignments."""
    try:
        count = await service.bulk_delete(request.ids)
        return {"message": f"Successfully deleted {count} assignments", "count": count}
    except BusinessRuleViolationError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
@router.post("/bulk-reassign")
async def bulk_reassign_assignments(
    *,
    service: TeacherAssignmentService = Depends(get_service),
    request: BulkReassignRequest,
    current_user: User = Depends(has_any_role(["admin"]))
) -> Any:
    """Bulk reassign assignments to a new teacher."""
    try:
        count = await service.bulk_reassign(
            request.ids, 
            request.new_teacher_id, 
            request.new_academic_year_id
        )
        return {"message": f"Successfully reassigned {count} assignments", "count": count}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
