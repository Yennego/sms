from typing import List, Optional, Dict, Any
from uuid import UUID
from datetime import date, timedelta
from fastapi import Depends, HTTPException, status  
from sqlalchemy.orm import Session
from src.core.middleware.tenant import get_tenant_from_request
from src.db.session import get_db
from src.db.crud.academics import assignment as assignment_crud
from src.db.crud.academics import subject as subject_crud
from src.db.crud.academics import academic_grade as grade_crud
from src.db.crud.academics import section as section_crud
from src.db.crud.auth import user as user_crud
from src.db.models.academics.assignment import Assignment
from src.schemas.academics.assignment import AssignmentCreate, AssignmentUpdate
from src.services.base.base import TenantBaseService, SuperAdminBaseService
from src.core.exceptions.business import (
    EntityNotFoundError, 
    BusinessRuleViolationError,
    PermissionDeniedError
)

class AssignmentService(TenantBaseService[Assignment, AssignmentCreate, AssignmentUpdate]):
    """Service for managing assignments within a tenant."""
    
    def __init__(
        self,
        tenant: Any = Depends(get_tenant_from_request),
        db: Session = Depends(get_db)
    ):
        tenant_id = tenant.id if hasattr(tenant, 'id') else tenant
        super().__init__(crud=assignment_crud, model=Assignment, tenant_id=tenant_id, db=db)
    
    def get_by_subject(self, subject_id: UUID) -> List[Assignment]:
        """Get all assignments for a specific subject."""
        return assignment_crud.get_by_subject(
            self.db, tenant_id=self.tenant_id, subject_id=subject_id
        )
    
    def get_by_teacher(self, teacher_id: UUID) -> List[Assignment]:
        """Get all assignments created by a specific teacher."""
        return assignment_crud.get_by_teacher(
            self.db, tenant_id=self.tenant_id, teacher_id=teacher_id
        )
    
    def get_by_grade_section(self, grade_id: UUID, section_id: Optional[UUID] = None) -> List[Assignment]:
        """Get all assignments for a specific grade and optionally section."""
        return assignment_crud.get_by_grade_section(
            self.db, tenant_id=self.tenant_id, grade_id=grade_id, section_id=section_id
        )
    
    def get_published(self) -> List[Assignment]:
        """Get all published assignments."""
        return assignment_crud.get_published(
            self.db, tenant_id=self.tenant_id
        )
    
    def get_upcoming(self, days: int = 7) -> List[Assignment]:
        """Get all assignments due within the next X days."""
        return assignment_crud.get_upcoming(
            self.db, tenant_id=self.tenant_id, days=days
        )
    
    def get_overdue(self) -> List[Assignment]:
        """Get all assignments that are past their due date."""
        return assignment_crud.get_overdue(
            self.db, tenant_id=self.tenant_id
        )
    
    def get_with_details(self, id: UUID) -> Optional[Dict]:
        """Get assignment with additional details."""
        return assignment_crud.get_with_details(
            self.db, tenant_id=self.tenant_id, id=id
        )
    
    async def create(self, *, obj_in: AssignmentCreate) -> Assignment:
        """Create a new assignment with validation."""
        # Check if subject exists
        subject = subject_crud.get_by_id(self.db, tenant_id=self.tenant_id, id=obj_in.subject_id)
        if not subject:
            raise EntityNotFoundError("Subject", obj_in.subject_id)
        # Check if teacher exists
        teacher = user_crud.get_by_id(self.db, tenant_id=self.tenant_id, id=obj_in.teacher_id)
        if not teacher:
            raise EntityNotFoundError("Teacher", obj_in.teacher_id)
        
        # Check if grade exists
        grade = grade_crud.get_by_id(self.db, tenant_id=self.tenant_id, id=obj_in.grade_id)
        if not grade:
            raise EntityNotFoundError("Grade", obj_in.grade_id)
        
        # Check if section exists (if provided)
        if obj_in.section_id:
            section = section_crud.get_by_id(self.db, tenant_id=self.tenant_id, id=obj_in.section_id)
            if not section:
                raise EntityNotFoundError("Section", obj_in.section_id)
            
            # Verify section belongs to the specified grade
            if section.grade_id != obj_in.grade_id:
                raise BusinessRuleViolationError("Section does not belong to the specified grade")
        
        # Validate dates
        if obj_in.due_date < obj_in.assigned_date:
            raise BusinessRuleViolationError("Due date cannot be earlier than assigned date")
        
        # Validate score
        if obj_in.max_score <= 0:
            raise BusinessRuleViolationError("Maximum score must be positive")
        
        # Create the assignment
        return await super().create(obj_in=obj_in)
    
    async def update_publication_status(self, id: UUID, is_published: bool) -> Assignment:
        """Update an assignment's publication status."""
        assignment = await self.get(id=id)
        if not assignment:
            raise EntityNotFoundError("Assignment", id)
        
        return assignment_crud.update_publication_status(
            self.db, tenant_id=self.tenant_id, id=id, is_published=is_published
        )


    def list(self, skip: int = 0, limit: int = 100, filters: Dict[str, Any] = None) -> List[Assignment]:
        """Override list to use optimized detailed fetching."""
        return assignment_crud.list_with_details(
            self.db, tenant_id=self.tenant_id, skip=skip, limit=limit, **(filters or {})
        )

class SuperAdminAssignmentService(SuperAdminBaseService[Assignment, AssignmentCreate, AssignmentUpdate]):
    """Super-admin service for managing assignments across all tenants."""
    
    def __init__(self, *args, **kwargs):
        super().__init__(crud=assignment_crud, model=Assignment, *args, **kwargs)
    
    async def get_all_assignments(self, skip: int = 0, limit: int = 100,
                          subject_id: Optional[UUID] = None,
                          teacher_id: Optional[UUID] = None,
                          grade_id: Optional[UUID] = None,
                          is_published: Optional[bool] = None,
                          tenant_id: Optional[UUID] = None) -> List[Assignment]:
        """Get all assignments across all tenants with filtering."""
        query = self.db.query(Assignment)
        
        # Apply filters
        if subject_id:
            query = query.filter(Assignment.subject_id == subject_id)
        if teacher_id:
            query = query.filter(Assignment.teacher_id == teacher_id)
        if grade_id:
            query = query.filter(Assignment.grade_id == grade_id)
        if is_published is not None:
            query = query.filter(Assignment.is_published == is_published)
        if tenant_id:
            query = query.filter(Assignment.tenant_id == tenant_id)
        
        # Apply pagination
        return query.offset(skip).limit(limit).all()

