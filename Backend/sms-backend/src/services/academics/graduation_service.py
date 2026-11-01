"""Graduation: students in the school's final grade level leave with status "graduated".

Candidates are the active enrollments of a school year in the highest grade level (by
sequence). Graduating only ever touches candidates, so a mistaken id can't graduate a student
in another grade, another year or another school.
"""
from datetime import date
from typing import Any, Dict, List, Optional
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from src.db.models.academics.academic_grade import AcademicGrade
from src.db.models.academics.academic_year import AcademicYear
from src.db.models.academics.class_model import Class
from src.db.models.academics.enrollment import Enrollment
from src.db.models.academics.promotion_status import PromotionStatus
from src.db.models.people.student import Student


class GraduationService:
    def __init__(self, db: Session, tenant_id: UUID):
        self.db = db
        self.tenant_id = tenant_id

    def _year(self, year_id: UUID) -> AcademicYear:
        year = self.db.query(AcademicYear).filter(
            AcademicYear.id == year_id, AcademicYear.tenant_id == self.tenant_id
        ).first()
        if not year:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="School year not found")
        return year

    def final_grade(self) -> Optional[AcademicGrade]:
        return self.db.query(AcademicGrade).filter(
            AcademicGrade.tenant_id == self.tenant_id, AcademicGrade.is_active == True  # noqa: E712
        ).order_by(AcademicGrade.sequence.desc()).first()

    def _candidate_query(self, year_id: UUID, grade_id: UUID):
        return self.db.query(Enrollment, Student, Class).join(
            Student, Student.id == Enrollment.student_id
        ).join(Class, Class.id == Enrollment.class_id).filter(
            Enrollment.tenant_id == self.tenant_id,
            Enrollment.academic_year_id == year_id,
            Enrollment.grade_id == grade_id,
            Enrollment.status == "active",
        )

    def candidates(self, year_id: UUID) -> Dict[str, Any]:
        year = self._year(year_id)
        grade = self.final_grade()
        if not grade:
            return {"final_grade": None, "candidates": []}
        rows = self._candidate_query(year.id, grade.id).order_by(Student.last_name, Student.first_name).all()
        decisions = {
            ps.enrollment_id: ps.status for ps in self.db.query(PromotionStatus).filter(
                PromotionStatus.tenant_id == self.tenant_id,
                PromotionStatus.enrollment_id.in_([e.id for e, _, _ in rows] or [None]),
            )
        }
        return {
            "final_grade": {"id": grade.id, "name": grade.name},
            "candidates": [{
                "student_id": s.id, "enrollment_id": e.id, "name": f"{s.first_name} {s.last_name}",
                "admission_number": s.admission_number, "class_name": c.name,
                # The promotion evaluation's decision, if one was made ("Eligible", "Repeating", ...)
                "promotion_status": decisions.get(e.id),
            } for e, s, c in rows],
        }

    def graduate(self, year_id: UUID, student_ids: List[UUID], on: Optional[date] = None) -> Dict[str, Any]:
        year = self._year(year_id)
        grade = self.final_grade()
        wanted = set(student_ids)
        if not grade or not wanted:
            return {"graduated": 0, "skipped": len(wanted)}
        rows = self._candidate_query(year.id, grade.id).filter(Enrollment.student_id.in_(wanted)).all()
        on = on or date.today()
        for enrollment, student, _ in rows:
            enrollment.status = "graduated"
            enrollment.is_active = False
            enrollment.withdrawal_date = enrollment.withdrawal_date or on
            student.graduate(on)
        self.db.flush()
        return {"graduated": len(rows), "skipped": len(wanted) - len(rows)}
