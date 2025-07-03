from typing import List, Optional, Dict, Any
from uuid import UUID

from src.db.crud import student as student_crud
from src.db.models.people import Student
from src.schemas.people import StudentCreate, StudentUpdate
from src.services.base.base import TenantBaseService, SuperAdminBaseService
from src.core.exceptions.business import (
    EntityNotFoundError, 
    DuplicateEntityError,
    InvalidStatusTransitionError
)
from datetime import date
from src.core.exceptions.business import BusinessRuleViolationError

class StudentService(TenantBaseService[Student, StudentCreate, StudentUpdate]):
    """
    Service for managing students within a tenant.
    """
    def __init__(self, *args, **kwargs):
        super().__init__(crud=student_crud, model=Student, *args, **kwargs)
    
    # Add student-specific business logic methods here
    # For example:
    # Add to StudentService class
    def get_by_admission_number(self, admission_number: str) -> Optional[Student]:
        """Get a student by admission number within the current tenant."""
        return student_crud.get_by_admission_number(self.db, tenant_id=self.tenant_id, admission_number=admission_number)
    
    def create(self, *, obj_in: StudentCreate) -> Student:
        """Create a new student with duplicate checking."""
        # Check for duplicate admission number
        existing = self.get_by_admission_number(obj_in.admission_number)
        if existing:
            raise DuplicateEntityError("Student", "admission_number", obj_in.admission_number)
        
        return super().create(obj_in=obj_in)
    
    def update_status(self, id: UUID, status: str, reason: Optional[str] = None) -> Student:
        """Update a student's status with validation."""
        student = self.get(id=id)
        if not student:
            raise EntityNotFoundError("Student", id)
        
        # Define valid status transitions
        valid_transitions = {
            "active": ["inactive", "graduated", "transferred"],
            "inactive": ["active"],
            "graduated": [],  # Terminal state
            "transferred": []  # Terminal state
        }
        
        if status not in valid_transitions.get(student.status, []):
            raise InvalidStatusTransitionError("Student", student.status, status)
        
        return student_crud.update_status(self.db, tenant_id=self.tenant_id, id=id, status=status, reason=reason)


class SuperAdminStudentService(SuperAdminBaseService[Student, StudentCreate, StudentUpdate]):
    """
    Super-admin service for managing students across all tenants.
    """
    def __init__(self, *args, **kwargs):
        super().__init__(crud=student_crud, model=Student, *args, **kwargs)
    
    # Add super-admin specific methods here
    def get_all_students(self, skip: int = 0, limit: int = 100,
                       grade: Optional[str] = None,
                       section: Optional[str] = None,
                       status: Optional[str] = None,
                       tenant_id: Optional[UUID] = None) -> List[Student]:
        """Get all students across all tenants with filtering."""
        query = self.db.query(Student)
        
        # Apply filters
        if grade:
            query = query.filter(Student.grade == grade)
        if section:
            query = query.filter(Student.section == section)
        if status:
            query = query.filter(Student.status == status)
        if tenant_id:
            query = query.filter(Student.tenant_id == tenant_id)
        
        # Apply pagination
        return query.offset(skip).limit(limit).all()


# Add to StudentService class
def promote_student(self, id: UUID, new_grade: str, new_section: Optional[str] = None) -> Student:
    """Promote a student to a new grade and optionally a new section."""
    student = self.get(id=id)
    if not student:
        raise EntityNotFoundError("Student", id)
    
    if student.status != "active":
        raise BusinessRuleViolationError(f"Cannot promote student with status '{student.status}'")
    
    # Define grade sequence
    grade_sequence = [
        "Kindergarten", "Grade 1", "Grade 2", "Grade 3", "Grade 4", "Grade 5",
        "Grade 6", "Grade 7", "Grade 8", "Grade 9", "Grade 10", "Grade 11", "Grade 12"
    ]
    
    # Validate grade progression
    current_index = grade_sequence.index(student.grade) if student.grade in grade_sequence else -1
    new_index = grade_sequence.index(new_grade) if new_grade in grade_sequence else -1
    
    if new_index == -1:
        raise BusinessRuleViolationError(f"Invalid grade: {new_grade}")
    
    if new_index != current_index + 1:
        raise BusinessRuleViolationError(f"Invalid grade progression from {student.grade} to {new_grade}")
    
    # Store current grade in academic history
    if not student.academic_history:
        student.academic_history = []
    
    student.academic_history.append({
        "academic_year": date.today().year,
        "grade": student.grade,
        "section": student.section,
        "promotion_date": date.today().isoformat()
    })
    
    # Update student grade and section
    update_data = {"grade": new_grade}
    if new_section:
        update_data["section"] = new_section
    
    return self.update(id=id, obj_in=update_data)

def graduate_student(self, id: UUID, graduation_date: date, honors: Optional[List[str]] = None) -> Student:
    """Graduate a student from the school."""
    student = self.get(id=id)
    if not student:
        raise EntityNotFoundError("Student", id)
    
    if student.grade != "Grade 12":
        raise BusinessRuleViolationError(f"Only Grade 12 students can graduate, current grade: {student.grade}")
    
    if student.status != "active":
        raise BusinessRuleViolationError(f"Cannot graduate student with status '{student.status}'")
    
    # Record graduation details
    graduation_details = {
        "graduation_date": graduation_date.isoformat(),
        "honors": honors or []
    }
    
    # Update student status and add graduation details
    return self.update(id=id, obj_in={
        "status": "graduated",
        "graduation_details": graduation_details
    })

