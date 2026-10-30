"""Grading categories with how many marks the class subject's assessments already use.

Counts from the gradebook's assessments (phase4-design.md §2): for a class subject (class +
subject) and an optional period or semester, each category's allocated marks are the summed
max_score of its assessments there, and remaining = weight - allocated (never below 0).
The semester exam has no category, so it never counts.
"""
from typing import Any, Dict, List, Optional
from uuid import UUID

from sqlalchemy import func
from sqlalchemy.orm import Session

from src.db.models.academics.assessment import Assessment
from src.db.models.academics.class_model import Class
from src.db.models.academics.class_subject import ClassSubject
from src.db.models.academics.grading_schema import GradingSchema
from src.db.models.academics.period import Period


class GradingService:
    def __init__(self, db: Session, tenant_id: Any):
        self.db = db
        self.tenant_id = tenant_id

    def _schema(self, cs: Optional[ClassSubject], cls: Class) -> Optional[GradingSchema]:
        """Same choice as the gradebook: the class subject's schema, else the school's active one."""
        q = self.db.query(GradingSchema).filter(GradingSchema.tenant_id == self.tenant_id)
        if cs is not None and cs.grading_schema_id:
            schema = q.filter(GradingSchema.id == cs.grading_schema_id).first()
            if schema:
                return schema
        active = q.filter(GradingSchema.is_active == True)  # noqa: E712
        return (active.filter(GradingSchema.academic_year_id == cls.academic_year_id).first()
                or active.filter(GradingSchema.academic_year_id.is_(None)).first()
                or active.first())

    async def get_categories_with_status(
        self,
        class_id: UUID,
        subject_id: UUID,
        period_id: Optional[UUID] = None,
        semester_id: Optional[UUID] = None,
    ) -> List[Dict[str, Any]]:
        cls = self.db.query(Class).filter(Class.id == class_id, Class.tenant_id == self.tenant_id).first()
        if not cls:
            return []
        cs = self.db.query(ClassSubject).filter(
            ClassSubject.tenant_id == self.tenant_id, ClassSubject.class_id == class_id,
            ClassSubject.subject_id == subject_id,
        ).first()
        schema = self._schema(cs, cls)
        if not schema:
            return []

        allocated: Dict[Any, float] = {}
        if cs is not None:
            q = self.db.query(Assessment.grading_category_id, func.sum(Assessment.max_score)).filter(
                Assessment.tenant_id == self.tenant_id, Assessment.class_subject_id == cs.id,
                Assessment.grading_category_id.isnot(None),
            )
            if period_id:
                q = q.filter(Assessment.period_id == period_id)
            elif semester_id:
                periods = self.db.query(Period.id).filter(
                    Period.tenant_id == self.tenant_id, Period.semester_id == semester_id)
                q = q.filter(Assessment.period_id.in_(periods))
            allocated = {cat_id: float(total or 0) for cat_id, total in q.group_by(Assessment.grading_category_id)}

        results = []
        for category in schema.categories:
            used = allocated.get(category.id, 0.0)
            results.append({
                **{c.name: getattr(category, c.name) for c in category.__table__.columns},
                "allocated_marks": used,
                "remaining_marks": max(0, (category.weight or 0) - used),
            })
        return results
