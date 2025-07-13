# Import services instead of direct CRUD operations
from typing import Any, List, Optional
from uuid import UUID
from datetime import date  # Add this import

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

# Replace CRUD imports with service imports
from src.db.crud.people import student
from src.schemas import tenant
from src.services.people import StudentService, TeacherService, ParentService
from src.services.people import SuperAdminStudentService, SuperAdminTeacherService, SuperAdminParentService
from src.db.session import get_db
from src.schemas.people import Student, StudentCreate, StudentUpdate
from src.schemas.people import Teacher, TeacherCreate, TeacherUpdate
from src.schemas.people import Parent, ParentCreate, ParentUpdate
from src.core.middleware.tenant import get_tenant_id_from_request
from src.core.auth.dependencies import has_any_role, get_current_user, get_current_active_user
from src.schemas.auth import User
from src.core.exceptions.business import (
    BusinessLogicError,
    EntityNotFoundError,
    DuplicateEntityError,
    InvalidStatusTransitionError,
    BusinessRuleViolationError,  # Add this import
    DatabaseError
)

router = APIRouter()

# Student endpoints
@router.post("/students", response_model=Student, status_code=status.HTTP_201_CREATED)
def create_student(
    *,
    student_service: StudentService = Depends(),
    student_in: StudentCreate,
    current_user: User = Depends(has_any_role(["admin"]))
) -> Any:
    """Create a new student (requires admin role)."""
    # Service handles tenant context automatically
    try:
        return student_service.create(obj_in=student_in,
        tenant_id=current_user.tenant_id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

@router.get("/students", response_model=List[Student])
def get_students(
    *,
    student_service: StudentService = Depends(),
    current_user: User = Depends(get_current_active_user),
    skip: int = 0,
    limit: int = 100,
    grade: Optional[str] = None,
    section: Optional[str] = None,
    status: Optional[str] = None
) -> Any:
    """Get all students for a tenant with optional filtering."""
    filters = {}
    if grade:
        filters["grade"] = grade
    if section:
        filters["section"] = section
    if status:
        filters["status"] = status

    if "super_admin" in {role.name for role in current_user.roles}:
        
        return student_service.list(skip=skip, limit=limit, filters=filters, is_super_admin=True)
    else:
        return student_service.list(skip=skip, limit=limit, filters=filters, tenant_id=current_user.tenant_id)

@router.get("/students/{student_id}", response_model=Student)
def get_student(
    *,
    student_service: StudentService = Depends(),
    student_id: UUID,
    # Allow admin and teacher to read student data
    current_user: User = Depends(has_any_role(["admin", "teacher"]))
) -> Any:
    """Get a specific student by ID."""
    try:
        if "super_admin" in {role.name for role in current_user.roles}:
            return student_service.get_by_id(id=student_id)
        else:
            return student_service.get_by_id(id=student_id, tenant_id=current_user.tenant_id)
    except EntityNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student not found"
        )

@router.put("/students/{student_id}", response_model=Student)
def update_student(
    *,
    student_service: StudentService = Depends(),
    student_id: UUID,
    student_in: StudentUpdate,
    # Only allow users with 'admin' role to update students
    current_user: User = Depends(has_any_role(["admin"]))
) -> Any:
    """Update a student."""
    try:
        return student_service.update(id=student_id, obj_in=student_in, tenant_id=current_user.tenant_id)
    except EntityNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student not found"
        )

@router.delete("/students/{student_id}", response_model=Student)
def delete_student(
    *,
    student_service: StudentService = Depends(),
    student_id: UUID,
    # Only allow users with 'admin' role to delete students
    current_user: User = Depends(has_any_role(["admin"]))
) -> Any:
    """Delete a student."""
    try:
        return student_service.delete(id=student_id, tenant_id=current_user.tenant_id)
    except EntityNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student not found"
        )

@router.put("/students/{student_id}/status", response_model=Student)
def update_student_status(
    *,
    student_service: StudentService = Depends(),
    student_id: UUID,
    status: str = Query(..., description="New status for the student"),
    reason: Optional[str] = Query(None, description="Reason for status change")
) -> Any:
    """Update a student's status."""
    try:
        return student_service.update_status(id=student_id, status=status, reason=reason)
    except EntityNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Student with ID {student_id} not found"
        )
    except InvalidStatusTransitionError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except DatabaseError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error occurred"
        )

# Add these new endpoints
@router.put("/students/{student_id}/promote", response_model=Student)
def promote_student(
    *,
    student_service: StudentService = Depends(),
    student_id: UUID,
    new_grade: str = Query(..., description="New grade for the student"),
    new_section: Optional[str] = Query(None, description="New section for the student")
) -> Any:
    """Promote a student to a new grade and optionally a new section."""
    try:
        return student_service.promote_student(id=student_id, new_grade=new_grade, new_section=new_section)
    except EntityNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Student with ID {student_id} not found"
        )
    except BusinessRuleViolationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

@router.put("/students/{student_id}/graduate", response_model=Student)
def graduate_student(
    *,
    student_service: StudentService = Depends(),
    student_id: UUID,
    graduation_date: date = Query(..., description="Graduation date"),
    honors: List[str] = Query(None, description="Honors received")
) -> Any:
    """Graduate a student."""
    try:
        return student_service.graduate_student(id=student_id, graduation_date=graduation_date, honors=honors)
    except EntityNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Student with ID {student_id} not found"
        )
    except BusinessRuleViolationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

# Update line 193
@router.post("/teachers", response_model=Teacher, status_code=status.HTTP_201_CREATED)
def create_teacher(*, db: Session = Depends(get_db), tenant_id: UUID = Depends(get_tenant_id_from_request), teacher_in: TeacherCreate) -> Any:
    """Create a new teacher."""
    teacher = teacher_crud.get_by_employee_id(db, tenant_id=tenant_id, employee_id=teacher_in.employee_id)
    if teacher:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Teacher with this employee ID already exists"
        )
    return teacher_crud.create(db, tenant_id=tenant_id, obj_in=teacher_in)

# Update line 203
@router.get("/teachers", response_model=List[Teacher])
def get_teachers(
    *, 
    db: Session = Depends(get_db), 
    tenant_id: UUID = Depends(get_tenant_id_from_request), 
    skip: int = 0, 
    limit: int = 100,
    department: Optional[str] = None,
    is_class_teacher: Optional[bool] = None
) -> Any:
    """Get all teachers for a tenant with optional filtering."""
    filters = {}
    if department:
        filters["department"] = department
    if is_class_teacher is not None:
        filters["is_class_teacher"] = is_class_teacher
        
    return teacher_crud.list(db, tenant_id=tenant_id, skip=skip, limit=limit, filters=filters)

@router.get("/teachers/class-teachers", response_model=List[Teacher])
def get_class_teachers(*, db: Session = Depends(get_db), tenant_id: UUID = Depends(get_tenant_id_from_request)) -> Any:
    """Get all class teachers for a tenant."""
    return teacher_crud.get_class_teachers(db, tenant_id=tenant_id)

@router.get("/teachers/{teacher_id}", response_model=Teacher)
def get_teacher(*, db: Session = Depends(get_db), tenant_id: UUID = Depends(get_tenant_id_from_request), teacher_id: UUID) -> Any:
    """Get a specific teacher by ID."""
    teacher = teacher_crud.get_by_id(db, tenant_id=tenant_id, id=teacher_id)
    if not teacher:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Teacher not found"
        )
    return teacher

@router.put("/teachers/{teacher_id}", response_model=Teacher)
def update_teacher(*, db: Session = Depends(get_db), tenant_id: UUID = Depends(get_tenant_id_from_request), teacher_id: UUID, teacher_in: TeacherUpdate) -> Any:
    """Update a teacher."""
    teacher = teacher_crud.get_by_id(db, tenant_id=tenant_id, id=teacher_id)
    if not teacher:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Teacher not found"
        )
    return teacher_crud.update(db, tenant_id=tenant_id, db_obj=teacher, obj_in=teacher_in)

@router.delete("/teachers/{teacher_id}", response_model=Teacher)
def delete_teacher(*, db: Session = Depends(get_db), tenant_id: UUID = Depends(get_tenant_id_from_request), teacher_id: UUID) -> Any:
    """Delete a teacher."""
    teacher = teacher_crud.get_by_id(db, tenant_id=tenant_id, id=teacher_id)
    if not teacher:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Teacher not found"
        )
    return teacher_crud.delete(db, tenant_id=tenant_id, id=teacher_id)

# Parent endpoints
@router.post("/parents", response_model=Parent, status_code=status.HTTP_201_CREATED)
def create_parent(*, db: Session = Depends(get_db), tenant_id: UUID = Depends(get_tenant_id_from_request), parent_in: ParentCreate) -> Any:
    """Create a new parent."""
    return parent_crud.create(db, tenant_id=tenant_id, obj_in=parent_in)

@router.get("/parents", response_model=List[Parent])
def get_parents(*, db: Session = Depends(get_db), tenant_id: UUID = Depends(get_tenant_id_from_request), skip: int = 0, limit: int = 100) -> Any:
    """Get all parents for a tenant."""
    return parent_crud.list(db, tenant_id=tenant_id, skip=skip, limit=limit)

@router.get("/parents/by-student/{student_id}", response_model=List[Parent])
def get_parents_by_student(*, db: Session = Depends(get_db), tenant_id: UUID = Depends(get_tenant_id_from_request), student_id: UUID) -> Any:
    """Get all parents of a specific student."""
    return parent_crud.get_by_student(db, tenant_id=tenant_id, student_id=student_id)

@router.get("/parents/{parent_id}", response_model=Parent)
def get_parent(*, db: Session = Depends(get_db), tenant_id: UUID = Depends(get_tenant_id_from_request), parent_id: UUID) -> Any:
    """Get a specific parent by ID."""
    parent = parent_crud.get_by_id(db, tenant_id=tenant_id, id=parent_id)
    if not parent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Parent not found"
        )
    return parent

@router.put("/parents/{parent_id}", response_model=Parent)
def update_parent(*, db: Session = Depends(get_db), tenant_id: UUID = Depends(get_tenant_id_from_request), parent_id: UUID, parent_in: ParentUpdate) -> Any:
    """Update a parent."""
    parent = parent_crud.get_by_id(db, tenant_id=tenant_id, id=parent_id)
    if not parent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Parent not found"
        )
    return parent_crud.update(db, tenant_id=tenant_id, db_obj=parent, obj_in=parent_in)

@router.delete("/parents/{parent_id}", response_model=Parent)
def delete_parent(*, db: Session = Depends(get_db), tenant_id: UUID = Depends(get_tenant_id_from_request), parent_id: UUID) -> Any:
    """Delete a parent."""
    parent = parent_crud.get_by_id(db, tenant_id=tenant_id, id=parent_id)
    if not parent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Parent not found"
        )
    return parent_crud.delete(db, tenant_id=tenant_id, id=parent_id)

@router.post("/parents/{parent_id}/students/{student_id}", response_model=Parent)
def add_student_to_parent(*, db: Session = Depends(get_db), tenant_id: UUID = Depends(get_tenant_id_from_request), parent_id: UUID, student_id: UUID) -> Any:
    """Add a student to a parent."""
    parent = parent_crud.get_by_id(db, tenant_id=tenant_id, id=parent_id)
    if not parent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Parent not found"
        )
    return parent_crud.add_student(db, tenant_id=tenant_id, parent_id=parent_id, student_id=student_id)

@router.delete("/parents/{parent_id}/students/{student_id}", response_model=Parent)
def remove_student_from_parent(*, db: Session = Depends(get_db), tenant_id: UUID = Depends(get_tenant_id_from_request), parent_id: UUID, student_id: UUID) -> Any:
    """Remove a student from a parent."""
    parent = parent_crud.get_by_id(db, tenant_id=tenant_id, id=parent_id)
    if not parent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Parent not found"
        )
    return parent_crud.remove_student(db, tenant_id=tenant_id, parent_id=parent_id, student_id=student_id)