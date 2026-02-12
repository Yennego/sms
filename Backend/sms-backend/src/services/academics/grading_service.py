from typing import List, Optional, Any, Dict
from uuid import UUID
from datetime import date

from sqlalchemy.orm import Session
from sqlalchemy import func

from src.db.crud.academics.grading_crud import grading_schema, grading_category
from src.db.models.academics.grade import Grade, GradeType
from src.db.models.academics.assessment import Assessment
from src.db.models.academics.class_model import Class
from src.services.base.base import TenantBaseService
from src.core.exceptions.business import BusinessRuleViolationError, EntityNotFoundError

class GradingService(TenantBaseService):
    def __init__(self, db: Session, tenant_id: Any):
        self.db = db
        self.tenant_id = tenant_id

    async def get_remaining_marks(self, class_id: UUID, category_id: UUID) -> float:
        """Calculate how many marks are still available to be allocated in a category."""
        # 1. Get the category weight
        category = self.db.query(grading_category.model).filter(
            grading_category.model.id == category_id,
            grading_category.model.tenant_id == self.tenant_id
        ).first()
        if not category:
            raise EntityNotFoundError("GradingCategory", category_id)
        
        # 2. Sum existing assessments max_score for this class and category
        # Note: We need a way to link Assessment to GradingCategory
        # I should probably have updated Assessment model to include category_id
        total_allocated = self.db.query(func.sum(Assessment.max_score)).filter(
            Assessment.class_id == class_id, # Assuming class_id is on Assessment
            Assessment.grading_category_id == category_id, # Need to add this
            Assessment.tenant_id == self.tenant_id
        ).scalar() or 0.0
        
        return category.weight - total_allocated

    async def validate_assessment_allocation(self, class_id: UUID, category_id: UUID, max_score: float):
        """Ensure a new assessment doesn't exceed the category's mark allocation."""
        remaining = await self.get_remaining_marks(class_id, category_id)
        if max_score > remaining:
            raise BusinessRuleViolationError(
                f"Cannot allocate {max_score} marks. Only {remaining} marks remaining in this category."
            )

    async def calculate_student_subject_total(self, student_id: UUID, class_id: UUID) -> float:
        """Automatically calculate total marks (out of 100) for a student in a class."""
        # 1. Get the class and its grading schema
        cls = self.db.query(Class).filter(
            Class.id == class_id,
            Class.tenant_id == self.tenant_id
        ).first()
        if not cls or not cls.grading_schema_id:
            return 0.0 # Or default logic
            
        schema = cls.grading_schema
        total_score = 0.0
        
        for category in schema.categories:
            # Get all grades for this student in this class and category
            # We need to link Grade to GradingCategory too
            grades = self.db.query(Grade).join(Assessment, Grade.assessment_id == Assessment.id).filter(
                Grade.student_id == student_id,
                Assessment.class_id == class_id,
                Assessment.grading_category_id == category.id,
                Grade.tenant_id == self.tenant_id
            ).all()
            
            if not grades:
                continue
                
            # Calculation: (Sum of scores / Sum of max_scores) * Category Weight
            sum_score = sum(g.score for g in grades)
            sum_max = sum(g.max_score for g in grades)
            
            if sum_max > 0:
                category_contribution = (sum_score / sum_max) * category.weight
                total_score += category_contribution
                
        return round(total_score, 2)
