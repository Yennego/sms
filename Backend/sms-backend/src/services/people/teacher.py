from typing import List, Optional, Dict, Any
from uuid import UUID

from src.db.crud import teacher as teacher_crud
from src.db.models.people import Teacher
from src.schemas.people import TeacherCreate, TeacherUpdate
from src.services.base.base import TenantBaseService, SuperAdminBaseService

class TeacherService(TenantBaseService[Teacher, TeacherCreate, TeacherUpdate]):
    """
    Service for managing teachers within a tenant.
    """
    def __init__(self, *args, **kwargs):
        super().__init__(crud=teacher_crud, model=Teacher, *args, **kwargs)
    
    def get_by_employee_id(self, employee_id: str) -> Optional[Teacher]:
        """Get a teacher by employee ID within the current tenant."""
        return teacher_crud.get_by_employee_id(self.db, tenant_id=self.tenant_id, employee_id=employee_id)
    
    def get_class_teachers(self) -> List[Teacher]:
        """Get all class teachers for the current tenant."""
        return teacher_crud.get_class_teachers(self.db, tenant_id=self.tenant_id)
    
    def get_by_department(self, department: str, skip: int = 0, limit: int = 100) -> List[Teacher]:
        """Get teachers by department within the current tenant."""
        filters = {"department": department}
        return teacher_crud.list(self.db, tenant_id=self.tenant_id, skip=skip, limit=limit, filters=filters)


class SuperAdminTeacherService(SuperAdminBaseService[Teacher, TeacherCreate, TeacherUpdate]):
    """
    Super-admin service for managing teachers across all tenants.
    """
    def __init__(self, *args, **kwargs):
        super().__init__(crud=teacher_crud, model=Teacher, *args, **kwargs)
    
    def get_all_teachers(self, skip: int = 0, limit: int = 100,
                        department: Optional[str] = None,
                        is_class_teacher: Optional[bool] = None,
                        tenant_id: Optional[UUID] = None) -> List[Teacher]:
        """Get all teachers across all tenants with filtering."""
        query = self.db.query(Teacher)
        
        # Apply filters
        if department:
            query = query.filter(Teacher.department == department)
        if is_class_teacher is not None:
            query = query.filter(Teacher.is_class_teacher == is_class_teacher)
        if tenant_id:
            query = query.filter(Teacher.tenant_id == tenant_id)
        
        # Apply pagination
        return query.offset(skip).limit(limit).all()


# Add to TeacherService class
def assign_to_class(self, teacher_id: UUID, grade: str, section: str, subject: str) -> Teacher:
    """Assign a teacher to a class for a specific subject.
    
    Business Rules:
    1. A teacher can be assigned to multiple classes
    2. Only one teacher can be the primary teacher for a class
    3. A teacher can teach multiple subjects
    """
    teacher = self.get(id=teacher_id)
    if not teacher:
        raise EntityNotFoundError("Teacher", teacher_id)
    
    # Check if teacher has required qualifications for subject
    if subject not in teacher.qualified_subjects:
        raise BusinessRuleViolationError(f"Teacher is not qualified to teach {subject}")
    
    # Check teacher's current workload
    if len(teacher.class_assignments) >= teacher.max_classes:
        raise BusinessRuleViolationError(f"Teacher has reached maximum class assignment limit")
    
    # Create class assignment
    class_assignment = {
        "grade": grade,
        "section": section,
        "subject": subject,
        "assigned_date": date.today().isoformat()
    }
    
    # Update teacher's class assignments
    if not teacher.class_assignments:
        teacher.class_assignments = []
    
    teacher.class_assignments.append(class_assignment)
    
    return self.update(id=teacher_id, obj_in={"class_assignments": teacher.class_assignments})

def set_as_class_teacher(self, teacher_id: UUID, grade: str, section: str) -> Teacher:
    """Set a teacher as the primary class teacher for a grade and section."""
    teacher = self.get(id=teacher_id)
    if not teacher:
        raise EntityNotFoundError("Teacher", teacher_id)
    
    # Check if another teacher is already assigned as class teacher
    existing_class_teacher = self.db.query(Teacher).filter(
        Teacher.tenant_id == self.tenant_id,
        Teacher.is_class_teacher == True,
        Teacher.primary_grade == grade,
        Teacher.primary_section == section
    ).first()
    
    if existing_class_teacher and existing_class_teacher.id != teacher_id:
        raise BusinessRuleViolationError(
            f"Another teacher is already assigned as class teacher for {grade} {section}"
        )
    
    # Update teacher as class teacher
    return self.update(id=teacher_id, obj_in={
        "is_class_teacher": True,
        "primary_grade": grade,
        "primary_section": section
    })