from typing import List, Optional, Dict, Any
from uuid import UUID
from datetime import date, timedelta

from src.db.crud.academics import exam as exam_crud
from src.db.crud.academics import subject as subject_crud
from src.db.crud.academics import academic_grade as grade_crud
from src.db.crud.academics import section as section_crud
from src.db.crud.auth import user as user_crud
from src.db.models.academics.exam import Exam
from src.schemas.academics.exam import ExamCreate, ExamUpdate
from src.services.base.base import TenantBaseService, SuperAdminBaseService
from src.core.exceptions.business import (
    EntityNotFoundError, 
    BusinessRuleViolationError,
    PermissionDeniedError
)

class ExamService(TenantBaseService[Exam, ExamCreate, ExamUpdate]):
    """Service for managing exams within a tenant."""
    
    def __init__(self, *args, **kwargs):
        super().__init__(crud=exam_crud, model=Exam, *args, **kwargs)
    
    def get_by_subject(self, subject_id: UUID) -> List[Exam]:
        """Get all exams for a specific subject."""
        return exam_crud.get_by_subject(
            self.db, tenant_id=self.tenant_id, subject_id=subject_id
        )
    
    def get_by_teacher(self, teacher_id: UUID) -> List[Exam]:
        """Get all exams created by a specific teacher."""
        return exam_crud.get_by_teacher(
            self.db, tenant_id=self.tenant_id, teacher_id=teacher_id
        )
    
    def get_by_grade_section(self, grade_id: UUID, section_id: Optional[UUID] = None) -> List[Exam]:
        """Get all exams for a specific grade and optionally section."""
        return exam_crud.get_by_grade_section(
            self.db, tenant_id=self.tenant_id, grade_id=grade_id, section_id=section_id
        )
    
    def get_published(self) -> List[Exam]:
        """Get all published exams."""
        return exam_crud.get_published(
            self.db, tenant_id=self.tenant_id
        )
    
    def get_upcoming(self, days: int = 7) -> List[Exam]:
        """Get all exams scheduled within the next X days."""
        return exam_crud.get_upcoming(
            self.db, tenant_id=self.tenant_id, days=days
        )
    
    def get_with_details(self, id: UUID) -> Optional[Dict]:
        """Get exam with additional details."""
        return exam_crud.get_with_details(
            self.db, tenant_id=self.tenant_id, id=id
        )
    
    def create(self, *, obj_in: ExamCreate) -> Exam:
        """Create a new exam with validation."""
        # Check if subject exists
        subject = subject_crud.get_by_id(self.db, tenant_id=self.tenant_id, id=obj_in.subject_id)
        if not subject:
            raise EntityNotFoundError("Subject", obj_in.subject_id)
        
        # Check if teacher exists
        teacher = user_crud.get_by_id(self.db, id=obj_in.teacher_id)
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
        
        # Validate times
        if obj_in.end_time <= obj_in.start_time:
            raise BusinessRuleViolationError("End time must be after start time")
        
        # Validate score
        if obj_in.max_score <= 0:
            raise BusinessRuleViolationError("Maximum score must be positive")
        
        # Create the exam
        return super().create(obj_in=obj_in)
    
    def update_publication_status(self, id: UUID, is_published: bool) -> Exam:
        """Update an exam's publication status."""
        exam = self.get(id=id)
        if not exam:
            raise EntityNotFoundError("Exam", id)
        
        return exam_crud.update_publication_status(
            self.db, tenant_id=self.tenant_id, id=id, is_published=is_published
        )


class SuperAdminExamService(SuperAdminBaseService[Exam, ExamCreate, ExamUpdate]):
    """Super-admin service for managing exams across all tenants."""
    
    def __init__(self, *args, **kwargs):
        super().__init__(crud=exam_crud, model=Exam, *args, **kwargs)
    
    def get_all_exams(self, skip: int = 0, limit: int = 100,
                     subject_id: Optional[UUID] = None,
                     teacher_id: Optional[UUID] = None,
                     grade_id: Optional[UUID] = None,
                     is_published: Optional[bool] = None,
                     tenant_id: Optional[UUID] = None) -> List[Exam]:
        """Get all exams across all tenants with filtering."""
        query = self.db.query(Exam)
        
        # Apply filters
        if subject_id:
            query = query.filter(Exam.subject_id == subject_id)
        if teacher_id:
            query = query.filter(Exam.teacher_id == teacher_id)
        if grade_id:
            query = query.filter(Exam.grade_id == grade_id)
        if is_published is not None:
            query = query.filter(Exam.is_published == is_published)
        if tenant_id:
            query = query.filter(Exam.tenant_id == tenant_id)
        
        # Apply pagination
        return query.offset(skip).limit(limit).all()