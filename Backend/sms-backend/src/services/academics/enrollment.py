from typing import List, Optional, Dict, Any
from uuid import UUID
from datetime import date

from src.db.crud.academics import enrollment as enrollment_crud
from src.db.crud.people import student as student_crud
from src.db.models.academics.enrollment import Enrollment
from src.schemas.academics.enrollment import EnrollmentCreate, EnrollmentUpdate
from src.services.base.base import TenantBaseService, SuperAdminBaseService
from src.core.exceptions.business import (
    EntityNotFoundError, 
    DuplicateEntityError,
    InvalidStatusTransitionError,
    BusinessRuleViolationError
)
from src.core.middleware.tenant import get_tenant_from_request
from src.db.session import get_db
from sqlalchemy.orm import Session
from fastapi import Depends

class EnrollmentService(TenantBaseService[Enrollment, EnrollmentCreate, EnrollmentUpdate]):
    """Service for managing student enrollments within a tenant."""
    
    def __init__(
        self,
        tenant_id: Any = Depends(get_tenant_from_request),
        db: Session = Depends(get_db)
    ):
        super().__init__(crud=enrollment_crud, model=Enrollment, tenant_id=tenant_id, db=db)
    
    def get_by_student_academic_year(self, student_id: UUID, academic_year: str) -> Optional[Enrollment]:
        """Get a student's enrollment for a specific academic year."""
        return enrollment_crud.get_by_student_academic_year(
            self.db, tenant_id=self.tenant_id, student_id=student_id, academic_year=academic_year
        )
    
    def get_active_enrollment(self, student_id: UUID) -> Optional[Enrollment]:
        """Get a student's active enrollment."""
        return enrollment_crud.get_active_enrollment(
            self.db, tenant_id=self.tenant_id, student_id=student_id
        )
    
    def get_by_grade_section(self, academic_year: str, grade: str, section: str) -> List[Enrollment]:
        """Get all enrollments for a specific grade and section."""
        return enrollment_crud.get_by_grade_section(
            self.db, tenant_id=self.tenant_id, academic_year=academic_year, grade=grade, section=section
        )
    
    def get_with_student_details(self, id: UUID) -> Optional[Dict]:
        """Get enrollment with student details."""
        return enrollment_crud.get_with_student_details(
            self.db, tenant_id=self.tenant_id, id=id
        )
    
    def create(self, *, obj_in: EnrollmentCreate) -> Enrollment:
        """Create a new enrollment with validation."""
        # Check if student exists
        student = student_crud.get_by_id(self.db, tenant_id=self.tenant_id, id=obj_in.student_id)
        if not student:
            raise EntityNotFoundError("Student", obj_in.student_id)
        
        # Check for duplicate enrollment in the same academic year
        existing = self.get_by_student_academic_year(obj_in.student_id, obj_in.academic_year)
        if existing:
            raise DuplicateEntityError("Enrollment", "academic_year", obj_in.academic_year)
        
        # If creating an active enrollment, deactivate any other active enrollments
        if obj_in.is_active:
            active_enrollment = self.get_active_enrollment(obj_in.student_id)
            if active_enrollment:
                self.update(id=active_enrollment.id, obj_in={"is_active": False})
        
        # Create the enrollment
        return super().create(obj_in=obj_in)
    
    def update_status(self, id: UUID, status: str, 
                     withdrawal_date: Optional[date] = None, 
                     withdrawal_reason: Optional[str] = None) -> Enrollment:
        """Update an enrollment's status with validation."""
        enrollment = self.get(id=id)
        if not enrollment:
            raise EntityNotFoundError("Enrollment", id)
        
        # Define valid status transitions
        valid_transitions = {
            "active": ["completed", "withdrawn", "transferred"],
            "completed": [],  # Terminal state
            "withdrawn": [],   # Terminal state
            "transferred": []  # Terminal state
        }
        
        if status not in valid_transitions.get(enrollment.status, []):
            raise InvalidStatusTransitionError("Enrollment", enrollment.status, status)
        
        return enrollment_crud.update_status(
            self.db, tenant_id=self.tenant_id, id=id, 
            status=status, withdrawal_date=withdrawal_date, withdrawal_reason=withdrawal_reason
        )
    
    def promote_student(self, student_id: UUID, new_academic_year: str, new_grade: str, new_section: str) -> Enrollment:
        """Promote a student to a new grade and section for a new academic year."""
        # Get current active enrollment
        current_enrollment = self.get_active_enrollment(student_id)
        if not current_enrollment:
            raise EntityNotFoundError("Active Enrollment", student_id)
        
        # Mark current enrollment as completed
        self.update_status(current_enrollment.id, "completed")
        
        # Create new enrollment for the next academic year
        new_enrollment = self.create(obj_in=EnrollmentCreate(
            student_id=student_id,
            academic_year=new_academic_year,
            grade=new_grade,
            section=new_section,
            enrollment_date=date.today(),
            status="active",
            is_active=True
        ))
        
        return new_enrollment


class SuperAdminEnrollmentService(SuperAdminBaseService[Enrollment, EnrollmentCreate, EnrollmentUpdate]):
    """Super-admin service for managing enrollments across all tenants."""
    
    def __init__(self, *args, **kwargs):
        super().__init__(crud=enrollment_crud, model=Enrollment, *args, **kwargs)
    
    def get_all_enrollments(self, skip: int = 0, limit: int = 100,
                          academic_year: Optional[str] = None,
                          grade: Optional[str] = None,
                          section: Optional[str] = None,
                          status: Optional[str] = None,
                          tenant_id: Optional[UUID] = None) -> List[Enrollment]:
        """Get all enrollments across all tenants with filtering."""
        query = self.db.query(Enrollment)
        
        # Apply filters
        if academic_year:
            query = query.filter(Enrollment.academic_year == academic_year)
        if grade:
            query = query.filter(Enrollment.grade == grade)
        if section:
            query = query.filter(Enrollment.section == section)
        if status:
            query = query.filter(Enrollment.status == status)
        if tenant_id:
            query = query.filter(Enrollment.tenant_id == tenant_id)
        
        # Apply pagination
        return query.offset(skip).limit(limit).all()

