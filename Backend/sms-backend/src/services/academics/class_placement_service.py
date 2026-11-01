"""Student roster and class placement for a school year, paged on the server.

Built for schools with thousands of students: one query returns a page of students with their
class this year (a student has at most one enrollment per year, so the join is one-to-one and
uses the (tenant, student, year) unique index), plus the totals the page needs. Filtering,
search and sorting happen in the database; the browser only ever holds one page.

Placing students is all-or-nothing: every student is checked first, and if any can't be placed
nothing changes and each problem is returned.
"""
from datetime import date
from typing import Any, Dict, List, Optional
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import and_, case, func, or_
from sqlalchemy.orm import Session, aliased

from src.db.models.academics.academic_grade import AcademicGrade
from src.db.models.academics.academic_year import AcademicYear
from src.db.models.academics.class_model import Class
from src.db.models.academics.enrollment import Enrollment
from src.db.models.academics.section import Section
from src.db.models.people.student import Student

MAX_PAGE_SIZE = 100
MAX_PLACEMENT_BATCH = 200
SORTS = {"name", "admission_number", "class"}
PLACEMENTS = {"all", "placed", "unplaced"}


class ClassPlacementService:
    def __init__(self, db: Session, tenant_id: UUID):
        self.db = db
        self.tenant_id = tenant_id

    def _year(self, year_id: Optional[UUID]) -> AcademicYear:
        query = self.db.query(AcademicYear).filter(AcademicYear.tenant_id == self.tenant_id)
        year = (query.filter(AcademicYear.id == year_id) if year_id
                else query.filter(AcademicYear.is_current == True)).first()  # noqa: E712
        if not year:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="School year not found" if year_id else "Set the current school year first.",
            )
        return year

    def _current_year_or_none(self) -> Optional[AcademicYear]:
        return self.db.query(AcademicYear).filter(
            AcademicYear.tenant_id == self.tenant_id, AcademicYear.is_current == True  # noqa: E712
        ).first()

    # --- roster ---------------------------------------------------------------------------------

    def roster(
        self, *, academic_year_id: Optional[UUID] = None, placement: str = "all", class_id: Optional[UUID] = None,
        grade_id: Optional[UUID] = None, section_id: Optional[UUID] = None, student_status: Optional[str] = "active",
        q: Optional[str] = None, sort: str = "name", page: int = 1, page_size: int = 25,
    ) -> Dict[str, Any]:
        if placement not in PLACEMENTS:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="placement must be all, placed or unplaced")
        if sort not in SORTS:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="sort must be name, admission_number or class")
        page = max(page, 1)
        page_size = min(max(page_size, 1), MAX_PAGE_SIZE)
        # A school without a current year still has students: list them all as not placed
        year = self._year(academic_year_id) if academic_year_id else self._current_year_or_none()

        # The student's active enrollment this year, if any (at most one per student and year)
        enr = aliased(Enrollment)
        cls, grade, section = aliased(Class), aliased(AcademicGrade), aliased(Section)
        base = (
            self.db.query(Student)
            .outerjoin(enr, and_(
                enr.student_id == Student.id, enr.tenant_id == self.tenant_id,
                enr.academic_year_id == (year.id if year else None), enr.status == "active",
            ))
            .filter(Student.tenant_id == self.tenant_id)
        )
        if student_status:
            base = base.filter(Student.status == student_status)
        if q and q.strip():
            term = f"%{q.strip().lower()}%"
            base = base.filter(or_(
                func.lower(func.concat(Student.first_name, " ", Student.last_name)).like(term),
                func.lower(func.concat(Student.last_name, " ", Student.first_name)).like(term),
                func.lower(Student.admission_number).like(term),
                func.lower(Student.username).like(term),
            ))

        # Totals for the "all / placed / not placed" tabs, before the placement and class filters
        counts_row = base.with_entities(
            func.count(Student.id),
            func.sum(case((enr.id.isnot(None), 1), else_=0)),
        ).one()
        counts = {"all": counts_row[0] or 0, "placed": int(counts_row[1] or 0)}
        counts["unplaced"] = counts["all"] - counts["placed"]

        filtered = base
        if placement == "placed":
            filtered = filtered.filter(enr.id.isnot(None))
        elif placement == "unplaced":
            filtered = filtered.filter(enr.id.is_(None))
        for column, value in ((enr.class_id, class_id), (enr.grade_id, grade_id), (enr.section_id, section_id)):
            if value:
                filtered = filtered.filter(column == value)

        total = filtered.with_entities(func.count(Student.id)).scalar() or 0
        rows_query = (
            filtered
            .outerjoin(cls, cls.id == enr.class_id)
            .outerjoin(grade, grade.id == enr.grade_id)
            .outerjoin(section, section.id == enr.section_id)
            .with_entities(Student, enr, cls.name, grade.name, grade.sequence, section.name)
        )
        name_order = (func.lower(Student.last_name), func.lower(Student.first_name), Student.id)
        if sort == "admission_number":
            rows_query = rows_query.order_by(Student.admission_number, Student.id)
        elif sort == "class":
            rows_query = rows_query.order_by(grade.sequence.nulls_last(), section.name.nulls_last(), *name_order)
        else:
            rows_query = rows_query.order_by(*name_order)
        rows = rows_query.offset((page - 1) * page_size).limit(page_size).all()

        items = []
        for student, enrollment, class_name, grade_name, _seq, section_name in rows:
            items.append({
                "student_id": student.id,
                "name": f"{student.first_name} {student.last_name}",
                "first_name": student.first_name,
                "last_name": student.last_name,
                "username": student.username,
                "email": student.email,
                "admission_number": student.admission_number,
                "student_status": student.status,
                "enrollment": None if enrollment is None else {
                    "id": enrollment.id, "class_id": enrollment.class_id, "class_name": class_name,
                    "grade_id": enrollment.grade_id, "grade_name": grade_name,
                    "section_id": enrollment.section_id, "section_name": section_name,
                    "status": enrollment.status,
                },
            })
        return {
            "academic_year": {"id": year.id, "name": year.name} if year else None,
            "items": items, "total": total, "page": page, "page_size": page_size,
            "pages": (total + page_size - 1) // page_size, "counts": counts,
        }

    # --- placing --------------------------------------------------------------------------------

    def place(self, class_id: UUID, student_ids: List[UUID]) -> Dict[str, Any]:
        ids = list(dict.fromkeys(student_ids))  # unique, keep order
        if not ids:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Choose at least one student.")
        if len(ids) > MAX_PLACEMENT_BATCH:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                                detail=f"Place at most {MAX_PLACEMENT_BATCH} students at a time.")
        klass = self.db.query(Class).filter(Class.id == class_id, Class.tenant_id == self.tenant_id).first()
        if not klass:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Class not found")

        students = {s.id: s for s in self.db.query(Student).filter(
            Student.tenant_id == self.tenant_id, Student.id.in_(ids)
        )}
        enrollments = {e.student_id: e for e in self.db.query(Enrollment).filter(
            Enrollment.tenant_id == self.tenant_id,
            Enrollment.academic_year_id == klass.academic_year_id,
            Enrollment.student_id.in_(ids),
        )}

        # Check everyone first: nothing changes unless every student can be placed
        problems = []
        for sid in ids:
            student = students.get(sid)
            if student is None:
                problems.append({"student_id": str(sid), "detail": "Student not found in this school"})
            elif student.status not in (None, "active"):
                problems.append({"student_id": str(sid), "name": f"{student.first_name} {student.last_name}",
                                 "detail": f"Student is {student.status}; reactivate them first"})
        if problems:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT,
                                detail={"message": "No one was placed. Fix these students first.", "problems": problems})

        result = {"placed": 0, "moved": 0, "unchanged": 0}
        newly_placed = []  # not in a class this year before: billed like their classmates
        for sid in ids:
            enrollment = enrollments.get(sid)
            if enrollment is None:
                self.db.add(Enrollment(
                    tenant_id=self.tenant_id, student_id=sid, academic_year_id=klass.academic_year_id,
                    class_id=klass.id, grade_id=klass.grade_id, section_id=klass.section_id,
                    status="active", is_active=True, enrollment_date=date.today(), semester=1,
                ))
                result["placed"] += 1
                newly_placed.append(sid)
            elif enrollment.status == "active" and enrollment.class_id == klass.id:
                result["unchanged"] += 1
            else:
                was_active = enrollment.status == "active"
                enrollment.class_id = klass.id
                enrollment.grade_id = klass.grade_id
                enrollment.section_id = klass.section_id
                enrollment.status, enrollment.is_active = "active", True
                enrollment.withdrawal_date = enrollment.withdrawal_reason = None
                result["moved" if was_active else "placed"] += 1
                if not was_active:
                    newly_placed.append(sid)
            # One active enrollment per student: earlier years' stay as history
            self.db.query(Enrollment).filter(
                Enrollment.tenant_id == self.tenant_id, Enrollment.student_id == sid,
                Enrollment.academic_year_id != klass.academic_year_id, Enrollment.is_active == True,  # noqa: E712
            ).update({Enrollment.is_active: False}, synchronize_session="fetch")
        self.db.flush()
        from src.services.finance.fee_service import FeeService
        FeeService(self.db, self.tenant_id, None).bill_new_enrollment(newly_placed, klass.academic_year_id)

        enrolled = self.db.query(func.count(Enrollment.id)).filter(
            Enrollment.tenant_id == self.tenant_id, Enrollment.class_id == klass.id, Enrollment.status == "active",
        ).scalar() or 0
        result.update({"class_id": klass.id, "class_name": klass.name, "enrolled": enrolled,
                       "capacity": klass.capacity, "over_capacity": enrolled > (klass.capacity or 0)})
        return result
