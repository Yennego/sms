"""School-year setup (docs/remodel/phase3-api.md §1, 03-app-flow.md §4.2).

The wizard's progress is the data itself: each step is complete when the year has what it needs
(terms, levels with sections, a class with a sponsor per level and section, subjects with
teachers, enrolled students). Every query is scoped to one school.
"""
from datetime import date, timedelta
from typing import Any, Dict, Iterable, List, Optional
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from src.db.models.academics.academic_grade import AcademicGrade
from src.db.models.academics.academic_year import AcademicYear
from src.db.models.academics.class_model import Class
from src.db.models.academics.class_subject import ClassSubject
from src.db.models.academics.enrollment import Enrollment
from src.db.models.academics.period import Period
from src.db.models.academics.section import Section
from src.db.models.academics.semester import Semester
from src.db.models.academics.subject import Subject
from src.db.models.people.teacher import Teacher

ACTIVE_ENROLLMENT = ("active",)


def _name(person) -> Optional[str]:
    return f"{person.first_name} {person.last_name}".strip() if person else None


def _split(start: date, end: date, parts: int) -> List[tuple]:
    """Split [start, end] into `parts` consecutive ranges of (almost) equal length."""
    days = (end - start).days + 1
    ranges, cursor = [], start
    for i in range(parts):
        length = days // parts + (1 if i < days % parts else 0)
        last = cursor + timedelta(days=max(length, 1) - 1)
        ranges.append((cursor, min(last, end)))
        cursor = last + timedelta(days=1)
    return ranges


class YearSetupService:
    def __init__(self, db: Session, tenant_id: UUID):
        self.db = db
        self.tenant_id = tenant_id

    # --- lookups (always this school) ----------------------------------------------------------

    def _year(self, year_id: UUID) -> AcademicYear:
        year = self.db.query(AcademicYear).filter(
            AcademicYear.id == year_id, AcademicYear.tenant_id == self.tenant_id
        ).first()
        if not year:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="School year not found")
        return year

    def _teacher(self, teacher_id: Optional[UUID]) -> Optional[Teacher]:
        if teacher_id is None:
            return None
        teacher = self.db.query(Teacher).filter(
            Teacher.id == teacher_id, Teacher.tenant_id == self.tenant_id
        ).first()
        if not teacher:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Teacher not found")
        return teacher

    def _classes(self, year_id: UUID) -> List[Class]:
        return self.db.query(Class).filter(
            Class.tenant_id == self.tenant_id, Class.academic_year_id == year_id
        ).all()

    def _levels(self) -> List[AcademicGrade]:
        return self.db.query(AcademicGrade).filter(
            AcademicGrade.tenant_id == self.tenant_id, AcademicGrade.is_active == True  # noqa: E712
        ).order_by(AcademicGrade.sequence).all()

    def _sections(self, grade_ids: Iterable[UUID]) -> List[Section]:
        ids = list(grade_ids)
        if not ids:
            return []
        return self.db.query(Section).filter(
            Section.tenant_id == self.tenant_id, Section.grade_id.in_(ids), Section.is_active == True  # noqa: E712
        ).order_by(Section.name).all()

    def previous_year(self, year: AcademicYear) -> Optional[AcademicYear]:
        return self.db.query(AcademicYear).filter(
            AcademicYear.tenant_id == self.tenant_id,
            AcademicYear.id != year.id,
            AcademicYear.start_date < year.start_date,
        ).order_by(AcademicYear.start_date.desc()).first()

    # --- steps ---------------------------------------------------------------------------------

    def terms_step(self, year_id: UUID) -> Dict[str, Any]:
        semesters = self.db.query(Semester).filter(
            Semester.tenant_id == self.tenant_id, Semester.academic_year_id == year_id
        ).order_by(Semester.semester_number).all()
        rows = [{
            "id": s.id, "name": s.name, "number": s.semester_number, "start_date": s.start_date, "end_date": s.end_date,
            "periods": [
                {"id": p.id, "name": p.name, "number": p.period_number, "start_date": p.start_date, "end_date": p.end_date}
                for p in sorted(s.periods, key=lambda p: p.period_number)
            ],
        } for s in semesters]
        return {"complete": any(r["periods"] for r in rows), "semesters": rows}

    def levels_step(self) -> Dict[str, Any]:
        levels = self._levels()
        by_grade: Dict[UUID, list] = {}
        for section in self._sections(l.id for l in levels):
            by_grade.setdefault(section.grade_id, []).append(
                {"id": section.id, "name": section.name}
            )
        rows = [{"id": l.id, "name": l.name, "sequence": l.sequence, "sections": by_grade.get(l.id, [])} for l in levels]
        return {"complete": any(r["sections"] for r in rows), "levels": rows}

    def _class_row(self, c: Class, enrolled: Dict[UUID, int], names: Dict[UUID, str]) -> Dict[str, Any]:
        sponsor = c.class_teacher if c.class_teacher_id else None
        return {
            "id": c.id, "name": c.name or f"{names.get(c.grade_id, '')} - {names.get(c.section_id, '')}",
            "grade_id": c.grade_id, "grade_name": names.get(c.grade_id), "section_id": c.section_id,
            "section_name": names.get(c.section_id), "sponsor_id": c.class_teacher_id, "sponsor_name": _name(sponsor),
            "enrolled": enrolled.get(c.id, 0), "capacity": c.capacity,
        }

    def _enrolled_counts(self, year_id: UUID) -> Dict[UUID, int]:
        rows = self.db.query(Enrollment.class_id, func.count(Enrollment.id)).filter(
            Enrollment.tenant_id == self.tenant_id,
            Enrollment.academic_year_id == year_id,
            Enrollment.status.in_(ACTIVE_ENROLLMENT),
        ).group_by(Enrollment.class_id).all()
        return {class_id: count for class_id, count in rows}

    def _names(self) -> Dict[UUID, str]:
        levels = self._levels()
        names = {l.id: l.name for l in levels}
        names.update({s.id: s.name for s in self._sections(names)})
        return names

    def classes_step(self, year_id: UUID) -> Dict[str, Any]:
        names = self._names()
        levels = self._levels()
        classes = self._classes(year_id)
        enrolled = self._enrolled_counts(year_id)
        have = {(c.grade_id, c.section_id) for c in classes}
        missing = [
            {"grade_id": s.grade_id, "grade_name": names.get(s.grade_id), "section_id": s.id, "section_name": s.name}
            for s in self._sections(l.id for l in levels) if (s.grade_id, s.id) not in have
        ]
        order = {l.id: l.sequence for l in levels}
        rows = sorted(
            (self._class_row(c, enrolled, names) for c in classes),
            key=lambda r: (order.get(r["grade_id"], 999), r["section_name"] or ""),
        )
        complete = bool(rows) and not missing and all(r["sponsor_id"] for r in rows)
        return {"complete": complete, "classes": rows, "missing": missing}

    def subjects_step(self, year_id: UUID) -> Dict[str, Any]:
        names = self._names()
        classes = self._classes(year_id)
        class_ids = [c.id for c in classes]
        subjects_by_class: Dict[UUID, list] = {cid: [] for cid in class_ids}
        if class_ids:
            for cs in self.db.query(ClassSubject).filter(
                ClassSubject.tenant_id == self.tenant_id, ClassSubject.class_id.in_(class_ids)
            ).all():
                subjects_by_class[cs.class_id].append({
                    "class_subject_id": cs.id, "subject_id": cs.subject_id,
                    "subject_name": cs.subject.name if cs.subject else None,
                    "teacher_id": cs.teacher_id, "teacher_name": _name(cs.teacher),
                })
        rows = [{
            "class_id": c.id, "class_name": c.name or f"{names.get(c.grade_id, '')} - {names.get(c.section_id, '')}",
            "grade_id": c.grade_id, "grade_name": names.get(c.grade_id),
            "subjects": sorted(subjects_by_class[c.id], key=lambda s: s["subject_name"] or ""),
        } for c in classes]
        unassigned = sum(1 for r in rows for s in r["subjects"] if not s["teacher_id"])
        complete = bool(rows) and all(r["subjects"] for r in rows) and unassigned == 0
        return {"complete": complete, "unassigned_teachers": unassigned, "classes": rows}

    def enrollment_step(self, year_id: UUID) -> Dict[str, Any]:
        classes = self.classes_step(year_id)["classes"]
        per_class = [{"class_id": c["id"], "class_name": c["name"], "count": c["enrolled"], "capacity": c["capacity"]} for c in classes]
        total = sum(c["count"] for c in per_class)
        return {"complete": total > 0, "total": total, "per_class": per_class}

    def overview(self, year_id: UUID) -> Dict[str, Any]:
        year = self._year(year_id)
        previous = self.previous_year(year)
        return {
            "year": {"id": year.id, "name": year.name, "start_date": year.start_date, "end_date": year.end_date,
                     "is_current": bool(year.is_current)},
            "previous_year": {"id": previous.id, "name": previous.name} if previous else None,
            "steps": {
                "terms": self.terms_step(year.id),
                "levels": self.levels_step(),
                "classes": self.classes_step(year.id),
                "subjects": self.subjects_step(year.id),
                "enrollment": self.enrollment_step(year.id),
            },
        }

    # --- actions -------------------------------------------------------------------------------

    def _add_terms(self, year: AcademicYear, layout: List[tuple]) -> None:
        """layout: [(semester_start, semester_end, [(period_start, period_end), ...]), ...]"""
        for number, (start, end, periods) in enumerate(layout, start=1):
            semester = Semester(
                tenant_id=self.tenant_id, academic_year_id=year.id, name=f"Semester {number}",
                semester_number=number, start_date=start, end_date=end,
            )
            self.db.add(semester)
            self.db.flush()
            for p_number, (p_start, p_end) in enumerate(periods, start=1):
                self.db.add(Period(
                    tenant_id=self.tenant_id, semester_id=semester.id, name=f"Period {(number - 1) * len(periods) + p_number}",
                    period_number=(number - 1) * len(periods) + p_number, start_date=p_start, end_date=p_end,
                ))
        self.db.flush()

    def default_terms(self, year_id: UUID) -> Dict[str, Any]:
        year = self._year(year_id)
        if self.terms_step(year.id)["semesters"]:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT,
                                detail="This school year already has semesters. Edit them on the Semesters page.")
        layout = [(s, e, _split(s, e, 3)) for s, e in _split(year.start_date, year.end_date, 2)]
        self._add_terms(year, layout)
        return self.terms_step(year.id)

    def generate_classes(self, year_id: UUID, grade_ids: Optional[List[UUID]] = None,
                         capacity: int = 30) -> Dict[str, Any]:
        """Seats belong to the class, not the section: every new class gets `capacity`."""
        year = self._year(year_id)
        for m in self.classes_step(year.id)["missing"]:
            if grade_ids and m["grade_id"] not in grade_ids:
                continue
            self.db.add(Class(
                tenant_id=self.tenant_id, academic_year_id=year.id, grade_id=m["grade_id"], section_id=m["section_id"],
                name=f"{m['grade_name']} - {m['section_name']}", capacity=capacity,
                start_date=year.start_date, end_date=year.end_date, is_active=True,
            ))
        self.db.flush()
        return self.classes_step(year.id)

    def _class(self, class_id: UUID) -> Class:
        c = self.db.query(Class).filter(Class.id == class_id, Class.tenant_id == self.tenant_id).first()
        if not c:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Class not found")
        return c

    def set_sponsor(self, class_id: UUID, teacher_id: Optional[UUID]) -> Dict[str, Any]:
        c = self._class(class_id)
        c.class_teacher_id = self._teacher(teacher_id).id if teacher_id else None
        self.db.flush()
        self.db.refresh(c)
        return self._class_row(c, self._enrolled_counts(c.academic_year_id), self._names())

    def assign_subjects(self, year_id: UUID, grade_id: UUID, subject_ids: List[UUID],
                        teachers: Dict[UUID, UUID]) -> Dict[str, Any]:
        year = self._year(year_id)
        wanted = set(subject_ids) | set(teachers)
        found = {s.id for s in self.db.query(Subject.id).filter(
            Subject.tenant_id == self.tenant_id, Subject.id.in_(wanted)
        )} if wanted else set()
        if found != wanted:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="One or more subjects were not found")
        for teacher_id in set(teachers.values()):
            self._teacher(teacher_id)
        for c in self._classes(year.id):
            if c.grade_id != grade_id:
                continue
            existing = {cs.subject_id: cs for cs in self.db.query(ClassSubject).filter(
                ClassSubject.tenant_id == self.tenant_id, ClassSubject.class_id == c.id
            )}
            for subject_id in wanted:
                cs = existing.get(subject_id)
                if cs is None:
                    cs = ClassSubject(tenant_id=self.tenant_id, class_id=c.id, subject_id=subject_id)
                    self.db.add(cs)
                if subject_id in teachers:
                    cs.teacher_id = teachers[subject_id]
        self.db.flush()
        return self.subjects_step(year.id)

    def set_subject_teacher(self, class_subject_id: UUID, teacher_id: Optional[UUID]) -> Dict[str, Any]:
        cs = self.db.query(ClassSubject).filter(
            ClassSubject.id == class_subject_id, ClassSubject.tenant_id == self.tenant_id
        ).first()
        if not cs:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Class subject not found")
        cs.teacher_id = self._teacher(teacher_id).id if teacher_id else None
        self.db.flush()
        self.db.refresh(cs)
        return {"class_subject_id": cs.id, "subject_id": cs.subject_id,
                "subject_name": cs.subject.name if cs.subject else None,
                "teacher_id": cs.teacher_id, "teacher_name": _name(cs.teacher)}

    def copy_from(self, year_id: UUID, source_year_id: UUID, *, terms: bool = True, classes: bool = True,
                  sponsors: bool = True, subjects: bool = True) -> Dict[str, int]:
        year, source = self._year(year_id), self._year(source_year_id)
        if year.id == source.id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Choose a different school year to copy from")
        created = {"semesters": 0, "periods": 0, "classes": 0, "sponsors": 0, "class_subjects": 0}
        shift = year.start_date - source.start_date

        if terms and not self.terms_step(year.id)["semesters"]:
            layout = [
                (s["start_date"] + shift, s["end_date"] + shift,
                 [(p["start_date"] + shift, p["end_date"] + shift) for p in s["periods"]])
                for s in self.terms_step(source.id)["semesters"]
            ]
            self._add_terms(year, layout)
            created["semesters"] = len(layout)
            created["periods"] = sum(len(s[2]) for s in layout)

        target = {(c.grade_id, c.section_id): c for c in self._classes(year.id)}
        for src in self._classes(source.id):
            key = (src.grade_id, src.section_id)
            dst = target.get(key)
            if dst is None and classes:
                dst = Class(
                    tenant_id=self.tenant_id, academic_year_id=year.id, grade_id=src.grade_id, section_id=src.section_id,
                    name=src.name, capacity=src.capacity, room=src.room, start_date=year.start_date,
                    end_date=year.end_date, is_active=True,
                )
                self.db.add(dst)
                self.db.flush()
                target[key] = dst
                created["classes"] += 1
            if dst is None:
                continue
            if sponsors and not dst.class_teacher_id and src.class_teacher_id:
                dst.class_teacher_id = src.class_teacher_id
                created["sponsors"] += 1
            if subjects:
                have = {cs.subject_id for cs in self.db.query(ClassSubject).filter(
                    ClassSubject.tenant_id == self.tenant_id, ClassSubject.class_id == dst.id
                )}
                for cs in self.db.query(ClassSubject).filter(
                    ClassSubject.tenant_id == self.tenant_id, ClassSubject.class_id == src.id
                ):
                    if cs.subject_id in have:
                        continue
                    self.db.add(ClassSubject(tenant_id=self.tenant_id, class_id=dst.id, subject_id=cs.subject_id,
                                             teacher_id=cs.teacher_id, grading_schema_id=cs.grading_schema_id))
                    created["class_subjects"] += 1
        self.db.flush()
        return created
