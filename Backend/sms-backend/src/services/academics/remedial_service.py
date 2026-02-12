from typing import Any
from uuid import UUID
from datetime import date
from fastapi import Depends
from sqlalchemy.orm import Session

from src.core.middleware.tenant import get_tenant_from_request
from src.db.session import get_db
from src.services.base.base import TenantBaseService
from src.db.crud.academics.remedial_session import remedial_session_crud
from src.db.models.academics.remedial_session import RemedialSession
from src.schemas.academics.promotion import RemedialSessionCreate, RemedialSessionUpdate

class RemedialService(TenantBaseService[RemedialSession, RemedialSessionCreate, RemedialSessionUpdate]):
    def __init__(self, tenant: Any = Depends(get_tenant_from_request), db: Session = Depends(get_db)):
        tenant_id = tenant.id if hasattr(tenant, "id") else tenant
        super().__init__(crud=remedial_session_crud, model=RemedialSession, tenant_id=tenant_id, db=db)

    async def identify_students_at_risk(self, academic_year_id: UUID, grade_id: UUID = None) -> list[dict]:
        """
        Scans all enrollments for a given year/grade and identifies students 
        with aggregated subject grades below the passing mark.
        """
        from src.services.academics.grade_calculation import GradeCalculationService
        from src.services.academics.promotion_criteria_service import PromotionCriteriaService
        from src.db.models.academics.enrollment import Enrollment
        
        calc_service = GradeCalculationService(db=self.db, tenant_id=self.tenant_id)
        criteria_service = PromotionCriteriaService(db=self.db, tenant=self.tenant_id)
        
        query = self.db.query(Enrollment).filter(
            Enrollment.tenant_id == self.tenant_id,
            Enrollment.academic_year_id == academic_year_id,
            Enrollment.is_active == True
        )
        if grade_id:
            query = query.filter(Enrollment.grade_id == grade_id)
            
        enrollments = query.all()
        at_risk = []
        
        for en in enrollments:
            criteria = criteria_service.get_by_year_and_grade(
                academic_year_id=en.academic_year_id, grade_id=en.grade_id
            )
            passing_mark = criteria.passing_mark if criteria else 70
            
            # Using str(academic_year_id) because generate_report_card supports string lookup
            try:
                report = await calc_service.generate_report_card(student_id=en.student_id, academic_year=str(academic_year_id))
            except Exception:
                continue
                
            for data in report.get("subjects", []):
                sid = data.get("subject_id")
                if data["percentage"] < passing_mark:
                    # Check if session already exists
                    existing = self.db.query(RemedialSession).filter(
                        RemedialSession.tenant_id == self.tenant_id,
                        RemedialSession.student_id == en.student_id,
                        RemedialSession.subject_id == sid,
                        RemedialSession.academic_year_id == academic_year_id
                    ).first()
                    
                    if not existing:
                        at_risk.append({
                            "student_id": en.student_id,
                            "student_name": en.student.full_name if en.student else "Unknown",
                            "subject_id": sid,
                            "subject_name": data["subject_name"],
                            "current_grade": data["percentage"],
                            "passing_mark": passing_mark,
                            "enrollment_id": en.id
                        })
                        
        return at_risk

    async def assign(self, *, student_id: UUID, subject_id: UUID, academic_year_id: UUID, scheduled_date: date) -> RemedialSession:
        return await self.create(obj_in=RemedialSessionCreate(
            student_id=student_id,
            enrollment_id=self._resolve_enrollment(student_id, academic_year_id),
            subject_id=subject_id,
            academic_year_id=academic_year_id,
            scheduled_date=scheduled_date
        ))

    def _resolve_enrollment(self, student_id: UUID, academic_year_id: UUID) -> UUID:
        from src.db.models.academics.enrollment import Enrollment
        en = self.db.query(Enrollment).filter(
            Enrollment.tenant_id == self.tenant_id,
            Enrollment.student_id == student_id,
            Enrollment.academic_year_id == academic_year_id,
            Enrollment.is_active == True
        ).first()
        return en.id if en else None

    async def list_by_enrollment(self, enrollment_id: UUID) -> list[RemedialSession]:
        return remedial_session_crud.list_by_enrollment(self.db, tenant_id=self.tenant_id, enrollment_id=enrollment_id)

    async def list_all(self, skip: int = 0, limit: int = 100) -> list[RemedialSession]:
        return remedial_session_crud.list(self.db, tenant_id=self.tenant_id, skip=skip, limit=limit)