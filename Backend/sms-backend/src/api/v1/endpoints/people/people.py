# Import services instead of direct CRUD operations
from typing import Any, List, Optional
from uuid import UUID
from datetime import date  # Add this import

from fastapi import APIRouter, Depends, HTTPException, status, Query, BackgroundTasks
from sqlalchemy.orm import Session

# WhatsApp service
from src.services.notification.whatsapp_service import MultiTenantWhatsAppService
from src.services.auth.password import generate_default_password

# Replace CRUD imports with service imports
from src.db.crud.people import student, teacher, parent
from src.schemas import tenant
from src.services.people import StudentService, TeacherService, ParentService
from src.services.people import SuperAdminStudentService, SuperAdminTeacherService, SuperAdminParentService
from src.db.session import get_db
from src.schemas.people import Student, StudentCreate, StudentUpdate
from src.schemas.people import Teacher, TeacherCreate, TeacherUpdate, TeacherCreateResponse
from src.schemas.people import Parent, ParentCreate, ParentUpdate
from src.core.middleware.tenant import get_tenant_id_from_request
from src.core.auth.dependencies import has_any_role, get_current_user, get_current_active_user
from src.schemas.auth import User
from src.db.crud.auth.user import user
from src.core.exceptions.business import (
    BusinessLogicError,
    EntityNotFoundError,
    DuplicateEntityError,
    InvalidStatusTransitionError,
    BusinessRuleViolationError,
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

@router.post("/teachers", response_model=TeacherCreateResponse, status_code=status.HTTP_201_CREATED)
def create_teacher(*, 
    db: Session = Depends(get_db), 
    tenant_id: UUID = Depends(get_tenant_id_from_request), 
    teacher_in: TeacherCreate,
    background_tasks: BackgroundTasks
) -> Any:
    """Create a new teacher with auto-generated employee ID."""
    # Add tenant_id to the request data
    teacher_data = teacher_in.model_copy()
    teacher_data.tenant_id = tenant_id
    
    # Check for duplicate email first
    existing_user = user.get_by_email(db, tenant_id=tenant_id, email=teacher_data.email)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"A user with email '{teacher_data.email}' already exists"
        )
    
    # Check for duplicate employee ID only if provided
    if teacher_data.employee_id:
        existing_teacher = teacher.get_by_employee_id(db, tenant_id=tenant_id, employee_id=teacher_data.employee_id)
        if existing_teacher:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Teacher with this employee ID already exists"
            )
    
    # Generate password if not provided
    password = teacher_data.password if teacher_data.password else generate_default_password()
    password_was_generated = not teacher_data.password
    teacher_data.password = password
    
    # Employee ID will be auto-generated in CRUD if not provided
    new_teacher = teacher.create(db, tenant_id=tenant_id, obj_in=teacher_data)
    
    # Send WhatsApp notification in background if phone number is provided
    if teacher_data.whatsapp_number:
        background_tasks.add_task(
            send_teacher_whatsapp_notification,
            db_session=db,
            tenant_id=str(tenant_id),
            phone_number=teacher_data.whatsapp_number,
            teacher_data={
                'first_name': new_teacher.first_name,
                'last_name': new_teacher.last_name,
                'email': new_teacher.email,
                'password': password,
                'employee_id': new_teacher.employee_id
            }
        )
    
    # Create response with generated password if it was auto-generated
    response = TeacherCreateResponse.model_validate(new_teacher, from_attributes=True)
    if password_was_generated:
        response.generated_password = password
    
    return response

@router.post("/teachers/bulk", response_model=List[TeacherCreateResponse], status_code=status.HTTP_201_CREATED)
def create_teachers_bulk(*, db: Session = Depends(get_db), tenant_id: UUID = Depends(get_tenant_id_from_request), teachers_in: List[TeacherCreate]) -> Any:
    """Create multiple teachers with auto-generated employee IDs and return credentials."""
    created_teachers = []
    for teacher_data in teachers_in:
        # Check for duplicate employee ID only if provided
        if teacher_data.employee_id:
            existing_teacher = teacher.get_by_employee_id(db, tenant_id=tenant_id, employee_id=teacher_data.employee_id)
            if existing_teacher:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Teacher with employee ID {teacher_data.employee_id} already exists"
                )
        
        # Check for duplicate email
        existing_user = user.get_by_email(db, tenant_id=tenant_id, email=teacher_data.email)
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"A user with email '{teacher_data.email}' already exists"
            )
        
        # Generate password if not provided
        password = teacher_data.password if teacher_data.password else generate_default_password()
        password_was_generated = not teacher_data.password
        teacher_data.password = password
        
        # Employee ID will be auto-generated in CRUD if not provided
        created_teacher = teacher.create(db, tenant_id=tenant_id, obj_in=teacher_data)
        
        # Create response with generated password if it was auto-generated
        response = TeacherCreateResponse.model_validate(created_teacher, from_attributes=True)
        if password_was_generated:
            response.generated_password = password
        
        created_teachers.append(response)
    
    return created_teachers

@router.get("/teachers", response_model=List[Teacher])
def get_teachers(
    *, 
    db: Session = Depends(get_db), 
    # Instead of: tenant_id: UUID = Depends(get_tenant_id_from_request),
    # Use the context set by middleware:
    skip: int = 0, 
    limit: int = 100,
    department: Optional[str] = None,
    is_class_teacher: Optional[bool] = None,
    status: Optional[str] = None,
    search: Optional[str] = None
) -> Any:
    """Get all teachers for a tenant with optional filtering and search."""
    # Get tenant_id from context (set by middleware)
    from src.db.session import get_tenant_id
    try:
        tenant_id = get_tenant_id()
        if not tenant_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                content={"detail": "Tenant context not found"}
            )
    except LookupError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            content={"detail": "Tenant context not available"}
        )
    
    filters = {}
    if department:
        filters["department"] = department
    if is_class_teacher is not None:
        filters["is_class_teacher"] = is_class_teacher
    if status:
        filters["status"] = status
    
    return teacher.list_with_search(
        db, 
        tenant_id=tenant_id, 
        skip=skip, 
        limit=limit, 
        search=search,
        **filters
    )

@router.get("/teachers/class-teachers", response_model=List[Teacher])
def get_class_teachers(*, db: Session = Depends(get_db), tenant_id: UUID = Depends(get_tenant_id_from_request)) -> Any:
    """Get all class teachers for a tenant."""
    return teacher.get_class_teachers(db, tenant_id=tenant_id)

@router.get("/teachers/departments", response_model=List[str])
def get_teacher_departments(
    *, 
    db: Session = Depends(get_db), 
    tenant_id: UUID = Depends(get_tenant_id_from_request)
) -> Any:
    """Get all unique departments from teachers."""
    print(f"[BACKEND] Departments endpoint received tenant_id: {tenant_id} (type: {type(tenant_id)})")
    teachers = teacher.list(db, tenant_id=tenant_id, skip=0, limit=1000)
    departments = set()
    for t in teachers:
        if t.department and t.department.strip():
            departments.add(t.department.strip())
    return sorted(list(departments))

@router.get("/teachers/{teacher_id}", response_model=Teacher)
def get_teacher(*, db: Session = Depends(get_db), tenant_id: UUID = Depends(get_tenant_id_from_request), teacher_id: UUID) -> Any:
    """Get a specific teacher by ID."""
    teacher_obj = teacher.get_by_id(db, tenant_id=tenant_id, id=teacher_id)
    if not teacher_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Teacher not found"
        )
    return teacher_obj

@router.put("/teachers/{teacher_id}", response_model=Teacher)
def update_teacher(*, db: Session = Depends(get_db), tenant_id: UUID = Depends(get_tenant_id_from_request), teacher_id: UUID, teacher_in: TeacherUpdate) -> Any:
    """Update a teacher."""
    teacher_obj = teacher.get_by_id(db, tenant_id=tenant_id, id=teacher_id)
    if not teacher_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Teacher not found"
        )
    return teacher.update(db, tenant_id=tenant_id, db_obj=teacher_obj, obj_in=teacher_in)

@router.delete("/teachers/{teacher_id}", response_model=Teacher)
def delete_teacher(*, db: Session = Depends(get_db), tenant_id: UUID = Depends(get_tenant_id_from_request), teacher_id: UUID) -> Any:
    """Delete a teacher."""
    teacher_obj = teacher.get_by_id(db, tenant_id=tenant_id, id=teacher_id)
    if not teacher_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Teacher not found"
        )
    return teacher.delete(db, tenant_id=tenant_id, id=teacher_id)

# Parent endpoints
@router.post("/parents", response_model=Parent, status_code=status.HTTP_201_CREATED)
def create_parent(*, 
    db: Session = Depends(get_db), 
    tenant_id: UUID = Depends(get_tenant_id_from_request), 
    parent_in: ParentCreate,
    background_tasks: BackgroundTasks
) -> Any:
    """Create a new parent."""
    # Generate password if not provided
    password = parent_in.password if parent_in.password else generate_default_password()
    parent_in.password = password
    
    new_parent = parent.create(db, tenant_id=tenant_id, obj_in=parent_in)
    
    # Send WhatsApp notification in background if phone number is provided
    if parent_in.whatsapp_number:
        background_tasks.add_task(
            send_parent_whatsapp_notification,
            tenant_id=str(tenant_id),
            phone_number=parent_in.whatsapp_number,
            parent_data={
                'first_name': new_parent.first_name,
                'last_name': new_parent.last_name,
                'email': new_parent.email,
                'password': password
            }
        )
    
    return new_parent

# Add this helper function
def send_parent_whatsapp_notification(tenant_id: str, phone_number: str, parent_data: dict):
    """Background task to send WhatsApp notification to parent"""
    from src.db.session import SessionLocal
    
    db = SessionLocal()
    try:
        whatsapp_service = MultiTenantWhatsAppService(db=db, tenant_id=tenant_id)
        # Note: You'll need to modify this based on your parent notification requirements
        # This is a simplified version
        message = f"""Welcome to our school!
        
Your parent account has been created:
Email: {parent_data['email']}
Password: {parent_data['password']}
        
Please change your password after first login."""
        
        whatsapp_service._send_message(phone_number, message)
    except Exception as e:
        print(f"Failed to send parent WhatsApp notification: {str(e)}")
    finally:
        db.close()

@router.get("/parents", response_model=List[Parent])
def get_parents(*, db: Session = Depends(get_db), tenant_id: UUID = Depends(get_tenant_id_from_request), skip: int = 0, limit: int = 100) -> Any:
    """Get all parents for a tenant."""
    return parent.list(db, tenant_id=tenant_id, skip=skip, limit=limit)

@router.get("/parents/by-student/{student_id}", response_model=List[Parent])
def get_parents_by_student(*, db: Session = Depends(get_db), tenant_id: UUID = Depends(get_tenant_id_from_request), student_id: UUID) -> Any:
    """Get all parents of a specific student."""
    return parent.get_by_student(db, tenant_id=tenant_id, student_id=student_id)

@router.get("/parents/{parent_id}", response_model=Parent)
def get_parent(*, db: Session = Depends(get_db), tenant_id: UUID = Depends(get_tenant_id_from_request), parent_id: UUID) -> Any:
    """Get a specific parent by ID."""
    parent_obj = parent.get_by_id(db, tenant_id=tenant_id, id=parent_id)
    if not parent_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Parent not found"
        )
    return parent_obj

@router.put("/parents/{parent_id}", response_model=Parent)
def update_parent(*, db: Session = Depends(get_db), tenant_id: UUID = Depends(get_tenant_id_from_request), parent_id: UUID, parent_in: ParentUpdate) -> Any:
    """Update a parent."""
    parent_obj = parent.get_by_id(db, tenant_id=tenant_id, id=parent_id)
    if not parent_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Parent not found"
        )
    return parent.update(db, tenant_id=tenant_id, db_obj=parent_obj, obj_in=parent_in)

@router.delete("/parents/{parent_id}", response_model=Parent)
def delete_parent(*, db: Session = Depends(get_db), tenant_id: UUID = Depends(get_tenant_id_from_request), parent_id: UUID) -> Any:
    """Delete a parent."""
    parent_obj = parent.get_by_id(db, tenant_id=tenant_id, id=parent_id)
    if not parent_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Parent not found"
        )
    return parent.delete(db, tenant_id=tenant_id, id=parent_id)

@router.post("/parents/{parent_id}/students/{student_id}", response_model=Parent)
def add_student_to_parent(*, db: Session = Depends(get_db), tenant_id: UUID = Depends(get_tenant_id_from_request), parent_id: UUID, student_id: UUID) -> Any:
    """Add a student to a parent."""
    parent_obj = parent.get_by_id(db, tenant_id=tenant_id, id=parent_id)
    if not parent_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Parent not found"
        )
    return parent.add_student(db, tenant_id=tenant_id, parent_id=parent_id, student_id=student_id)

@router.delete("/parents/{parent_id}/students/{student_id}", response_model=Parent)
def remove_student_from_parent(*, db: Session = Depends(get_db), tenant_id: UUID = Depends(get_tenant_id_from_request), parent_id: UUID, student_id: UUID) -> Any:
    """Remove a student from a parent."""
    parent_obj = parent.get_by_id(db, tenant_id=tenant_id, id=parent_id)
    if not parent_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Parent not found"
        )
    return parent.remove_student(db, tenant_id=tenant_id, parent_id=parent_id, student_id=student_id)

# Add this helper function
def send_teacher_whatsapp_notification(db_session: Session, tenant_id: str, phone_number: str, teacher_data: dict):
    """Background task to send WhatsApp notification"""
    try:
        whatsapp_service = MultiTenantWhatsAppService(db=db_session, tenant_id=tenant_id)
        whatsapp_service.send_teacher_credentials(
            phone_number=phone_number,
            teacher_data=teacher_data
        )
    except Exception as e:
        print(f"Failed to send WhatsApp notification: {str(e)}")
        # Log the error but don't fail the background task