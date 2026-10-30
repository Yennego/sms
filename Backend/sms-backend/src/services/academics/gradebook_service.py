"""Gradebook: assessments, score entry, review and publish, report cards (phase4-design.md §3-§4).

Access rules (§3):
- create/edit/delete assessments and enter scores: the class subject's teacher, or
  manage_academic_data;
- see a class's unpublished marks: the class subject's teacher, the class sponsor, users with
  view_academic_data (or manage_academic_data / publish_results);
- publish/unpublish: publish_results; change the pass mark: manage_academic_data;
- students see their own published results; parents their linked children's.
Once a period (or semester, for the exam) is published for the class, only manage_academic_data
may change its assessments or scores, and every such change is written to the audit log; a
teacher gets 409.

Every lookup filters by the request's school; ids from another school are 404. Changes are
flushed only: the request commits once.
"""
from datetime import date, datetime, UTC
from typing import Any, Dict, List, Optional, Set
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from src.core.security.auth import is_super_admin
from src.db.models.academics.academic_year import AcademicYear
from src.db.models.academics.assessment import ASSESSMENT_KINDS, Assessment
from src.db.models.academics.class_model import Class
from src.db.models.academics.class_subject import ClassSubject
from src.db.models.academics.enrollment import Enrollment
from src.db.models.academics.gradebook import SCORE_STATUSES, GradingSettings, ResultPublication, ScoreEntry
from src.db.models.academics.grading_schema import GradingCategory, GradingSchema
from src.db.models.academics.period import Period
from src.db.models.academics.semester import Semester
from src.services.academics import report_card_verification_service as rcv
from src.services.academics import report_identity_service as ri
from src.services.academics import results_service as rs
from src.services.academics.attendance_access import class_sponsor_id

PUBLISHED_MESSAGE = "Results for this period are published. Ask the principal to unpublish them first."
STAFF_READ = ("view_academic_data", "manage_academic_data", "publish_results")


def _404(what: str):
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"{what} not found")


def _422(detail: Any):
    return HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=detail)


def _409(detail: Any):
    return HTTPException(status_code=status.HTTP_409_CONFLICT, detail=detail)


def _403(detail: str = "You don't have access to these results"):
    return HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=detail)


def user_permissions(user: Any) -> Set[str]:
    return {p.name for role in getattr(user, "roles", []) for p in role.permissions}


class GradebookService:
    def __init__(self, db: Session, tenant_id: UUID, user: Any):
        self.db = db
        self.tenant_id = tenant_id if isinstance(tenant_id, UUID) else UUID(str(tenant_id))
        self.user = user
        self.super = is_super_admin(user)
        self.perms = user_permissions(user)

    # --- access ----------------------------------------------------------------------------

    def can(self, permission: str) -> bool:
        return self.super or permission in self.perms

    def staff_reader(self) -> bool:
        return any(self.can(p) for p in STAFF_READ)

    def is_teacher_of(self, cs: ClassSubject) -> bool:
        return cs.teacher_id is not None and str(cs.teacher_id) == str(self.user.id)

    def is_sponsor_of(self, cls: Class) -> bool:
        sponsor = class_sponsor_id(self.db, cls)
        return sponsor is not None and str(sponsor) == str(self.user.id)

    def may_edit(self, cs: ClassSubject) -> bool:
        return self.is_teacher_of(cs) or self.can("manage_academic_data")

    def require_edit(self, cs: ClassSubject) -> None:
        if not self.may_edit(cs):
            raise _403("Only this subject's teacher can change its assessments and scores")

    def require_view(self, cs: ClassSubject, cls: Class) -> None:
        if not (self.may_edit(cs) or self.staff_reader() or self.is_sponsor_of(cls)):
            raise _403()

    def require_class_view(self, cls: Class) -> None:
        if not (self.staff_reader() or self.is_sponsor_of(cls)):
            raise _403()

    def require(self, permission: str) -> None:
        if not self.can(permission):
            raise _403(f"User does not have permission: {permission}")

    # --- lookups (always scoped to the school) ------------------------------------------------

    def _get(self, model, id_, what):
        obj = self.db.query(model).filter(model.tenant_id == self.tenant_id, model.id == id_).first()
        if obj is None:
            raise _404(what)
        return obj

    def class_subject(self, cs_id) -> ClassSubject:
        return self._get(ClassSubject, cs_id, "Class subject")

    def klass(self, class_id) -> Class:
        return self._get(Class, class_id, "Class")

    def assessment(self, assessment_id) -> Assessment:
        return self._get(Assessment, assessment_id, "Assessment")

    def year(self, academic_year_id: Optional[UUID]) -> AcademicYear:
        q = self.db.query(AcademicYear).filter(AcademicYear.tenant_id == self.tenant_id)
        year = (q.filter(AcademicYear.id == academic_year_id) if academic_year_id
                else q.filter(AcademicYear.is_current == True)).first()  # noqa: E712
        if year is None:
            raise _404("School year" if academic_year_id else "Current school year")
        return year

    def period_in_year(self, period_id, academic_year_id) -> Period:
        period = self._get(Period, period_id, "Period")
        semester = self._get(Semester, period.semester_id, "Semester")
        if semester.academic_year_id != academic_year_id:
            raise _422("The period is not in this class's school year")
        return period

    def semester_in_year(self, semester_id, academic_year_id) -> Semester:
        semester = self._get(Semester, semester_id, "Semester")
        if semester.academic_year_id != academic_year_id:
            raise _422("The semester is not in this class's school year")
        return semester

    def _scope(self, period_id, semester_id):
        if bool(period_id) == bool(semester_id):
            raise _422("Give either period_id or semester_id")

    # --- publication state ----------------------------------------------------------------------

    def is_published(self, class_id, *, period_id=None, semester_id=None) -> bool:
        q = self.db.query(ResultPublication.id).filter(
            ResultPublication.tenant_id == self.tenant_id, ResultPublication.class_id == class_id)
        q = q.filter(ResultPublication.period_id == period_id) if period_id else q.filter(
            ResultPublication.semester_id == semester_id)
        return q.first() is not None

    def assessment_published(self, a: Assessment, cs: ClassSubject) -> bool:
        return self.is_published(cs.class_id, period_id=a.period_id, semester_id=a.semester_id)

    def guard_published(self, cs: ClassSubject, *, period_id=None, semester_id=None,
                        entity_id=None, action="update", details=None) -> None:
        """Teachers can't change published results; admins can, and it is audit-logged."""
        if not self.is_published(cs.class_id, period_id=period_id, semester_id=semester_id):
            return
        if not self.can("manage_academic_data"):
            raise _409(PUBLISHED_MESSAGE)
        from src.db.models.logging.activity_log import ActivityLog
        self.db.add(ActivityLog(
            tenant_id=self.tenant_id, user_id=self.user.id, action=action, entity_type="published_results",
            entity_id=entity_id, new_values=details,
        ))

    # --- grading schema -------------------------------------------------------------------------

    def schema_for(self, cs: ClassSubject, cls: Class) -> Optional[GradingSchema]:
        q = self.db.query(GradingSchema).filter(GradingSchema.tenant_id == self.tenant_id)
        if cs.grading_schema_id:
            schema = q.filter(GradingSchema.id == cs.grading_schema_id).first()
            if schema:
                return schema
        active = q.filter(GradingSchema.is_active == True)  # noqa: E712
        return (active.filter(GradingSchema.academic_year_id == cls.academic_year_id).first()
                or active.filter(GradingSchema.academic_year_id.is_(None)).first()
                or active.first())

    def categories_for(self, cs: ClassSubject, cls: Class, extra_ids=()) -> List[GradingCategory]:
        schema = self.schema_for(cs, cls)
        cats = sorted(schema.categories, key=lambda c: (-(c.weight or 0), c.name.lower())) if schema else []
        have = {c.id for c in cats}
        missing = [i for i in extra_ids if i and i not in have]
        if missing:
            cats += self.db.query(GradingCategory).filter(
                GradingCategory.tenant_id == self.tenant_id, GradingCategory.id.in_(missing)).all()
        return cats

    # --- class subjects the user may open -----------------------------------------------------

    def class_subjects(self, academic_year_id: Optional[UUID]) -> List[Dict[str, Any]]:
        year = self.year(academic_year_id)
        q = (self.db.query(ClassSubject).join(Class, Class.id == ClassSubject.class_id)
             .filter(ClassSubject.tenant_id == self.tenant_id, Class.tenant_id == self.tenant_id,
                     Class.academic_year_id == year.id))
        rows = q.all()
        if not self.staff_reader():
            sponsored = {c.id for c in self.db.query(Class).filter(
                Class.tenant_id == self.tenant_id, Class.academic_year_id == year.id).all()
                if self.is_sponsor_of(c)}
            rows = [cs for cs in rows if self.is_teacher_of(cs) or cs.class_id in sponsored]
        out = [{
            "class_subject_id": cs.id, "class_id": cs.class_id,
            "class_name": cs.class_obj.name if cs.class_obj else None,
            "subject_id": cs.subject_id, "subject_name": cs.subject.name if cs.subject else None,
            "teacher_id": cs.teacher_id, "teacher_name": rs.person_name(cs.teacher),
            "can_edit": self.may_edit(cs),
        } for cs in rows]
        out.sort(key=lambda r: ((r["class_name"] or "").lower(), (r["subject_name"] or "").lower()))
        return out

    # --- assessments ----------------------------------------------------------------------------

    def _assessment_out(self, a: Assessment, entered: int = 0, students: int = 0) -> Dict[str, Any]:
        return {
            "id": a.id, "class_subject_id": a.class_subject_id, "kind": a.kind, "title": a.title,
            "description": a.description, "period_id": a.period_id, "semester_id": a.semester_id,
            "grading_category_id": a.grading_category_id, "assessment_date": a.assessment_date,
            "due_date": a.due_date, "max_score": a.max_score, "created_by": a.created_by,
            "entered": entered, "students": students,
        }

    def _entered_counts(self, ids) -> Dict[Any, int]:
        from sqlalchemy import func
        if not ids:
            return {}
        return dict(self.db.query(ScoreEntry.assessment_id, func.count(ScoreEntry.id)).filter(
            ScoreEntry.tenant_id == self.tenant_id, ScoreEntry.assessment_id.in_(ids)
        ).group_by(ScoreEntry.assessment_id).all())

    def _assessments_in(self, cs: ClassSubject, period_id=None, semester_id=None) -> List[Assessment]:
        q = self.db.query(Assessment).filter(Assessment.tenant_id == self.tenant_id,
                                             Assessment.class_subject_id == cs.id)
        if period_id:
            q = q.filter(Assessment.period_id == period_id)
        if semester_id:
            q = q.filter(Assessment.semester_id == semester_id, Assessment.kind == "exam")
        return q.order_by(Assessment.assessment_date, Assessment.created_at).all()

    def list_assessments(self, class_subject_id, period_id=None, semester_id=None) -> List[Dict[str, Any]]:
        cs = self.class_subject(class_subject_id)
        cls = self.klass(cs.class_id)
        self.require_view(cs, cls)
        items = self._assessments_in(cs, period_id, semester_id)
        counts = self._entered_counts([a.id for a in items])
        size = len(rs.class_roster(self.db, self.tenant_id, cls.id, active_only=True))
        return [self._assessment_out(a, counts.get(a.id, 0), size) for a in items]

    def _validate_placement(self, cs: ClassSubject, cls: Class, data: Dict[str, Any], current: Optional[Assessment]):
        kind = data.get("kind")
        if kind not in ASSESSMENT_KINDS:
            raise _422(f"kind must be one of: {', '.join(ASSESSMENT_KINDS)}")
        title = (data.get("title") or "").strip()
        if not title:
            raise _422("title is required")
        max_score = data.get("max_score")
        if max_score is None or float(max_score) <= 0:
            raise _422("max_score must be greater than 0")
        if kind == "exam":
            if not data.get("semester_id") or data.get("period_id"):
                raise _422("The semester exam needs semester_id (and no period_id)")
            self.semester_in_year(data["semester_id"], cls.academic_year_id)
            clash = self.db.query(Assessment.id).filter(
                Assessment.tenant_id == self.tenant_id, Assessment.class_subject_id == cs.id,
                Assessment.kind == "exam", Assessment.semester_id == data["semester_id"])
            if current is not None:
                clash = clash.filter(Assessment.id != current.id)
            if clash.first():
                raise _409("This subject already has an exam for that semester")
            data["period_id"] = None
            data["grading_category_id"] = None
        else:
            if not data.get("period_id") or data.get("semester_id"):
                raise _422("This assessment needs period_id (and no semester_id)")
            self.period_in_year(data["period_id"], cls.academic_year_id)
            if not data.get("grading_category_id"):
                raise _422("grading_category_id is required")
            self._get(GradingCategory, data["grading_category_id"], "Grading category")
            data["semester_id"] = None
        data["title"] = title
        data["max_score"] = float(max_score)
        return data

    def create_assessment(self, data: Dict[str, Any]) -> Dict[str, Any]:
        cs = self.class_subject(data["class_subject_id"])
        cls = self.klass(cs.class_id)
        self.require_edit(cs)
        data = self._validate_placement(cs, cls, dict(data), None)
        self.guard_published(cs, period_id=data["period_id"], semester_id=data["semester_id"],
                             action="create", details={"title": data["title"]})
        a = Assessment(
            tenant_id=self.tenant_id, class_subject_id=cs.id, kind=data["kind"], title=data["title"],
            description=data.get("description"), period_id=data["period_id"], semester_id=data["semester_id"],
            grading_category_id=data["grading_category_id"],
            assessment_date=data.get("assessment_date") or date.today(), due_date=data.get("due_date"),
            max_score=data["max_score"], created_by=self.user.id, subject_id=cs.subject_id,
        )
        self.db.add(a)
        self.db.flush()
        return self._assessment_out(a)

    def update_assessment(self, assessment_id, data: Dict[str, Any]) -> Dict[str, Any]:
        a = self.assessment(assessment_id)
        cs = self.class_subject(a.class_subject_id)
        cls = self.klass(cs.class_id)
        self.require_edit(cs)
        merged = {k: getattr(a, k) for k in ("kind", "title", "description", "period_id", "semester_id",
                                             "grading_category_id", "assessment_date", "due_date", "max_score")}
        merged.update({k: v for k, v in data.items() if k != "class_subject_id"})
        merged = self._validate_placement(cs, cls, merged, a)
        # Both where it was and where it goes must be open for changes
        self.guard_published(cs, period_id=a.period_id, semester_id=a.semester_id, entity_id=a.id,
                             details={"assessment": str(a.id), "change": "assessment"})
        if (merged["period_id"], merged["semester_id"]) != (a.period_id, a.semester_id):
            self.guard_published(cs, period_id=merged["period_id"], semester_id=merged["semester_id"],
                                 entity_id=a.id, details={"assessment": str(a.id), "change": "moved"})
        top = self.db.query(ScoreEntry.score).filter(
            ScoreEntry.tenant_id == self.tenant_id, ScoreEntry.assessment_id == a.id,
            ScoreEntry.score > merged["max_score"]).first()
        if top:
            raise _422("Some scores are above the new max score; change them first")
        for k, v in merged.items():
            setattr(a, k, v)
        self.db.flush()
        counts = self._entered_counts([a.id])
        return self._assessment_out(a, counts.get(a.id, 0))

    def delete_assessment(self, assessment_id, force: bool = False) -> Dict[str, Any]:
        a = self.assessment(assessment_id)
        cs = self.class_subject(a.class_subject_id)
        self.require_edit(cs)
        entered = self._entered_counts([a.id]).get(a.id, 0)
        self.guard_published(cs, period_id=a.period_id, semester_id=a.semester_id, entity_id=a.id,
                             action="delete", details={"assessment": str(a.id), "title": a.title, "scores": entered})
        if entered and not force:
            raise _409({"message": f"{entered} score(s) are recorded for this assessment. "
                                   "Delete with force=true to remove them too.", "scores": entered})
        self.db.delete(a)
        self.db.flush()
        return {"deleted": True, "scores_deleted": entered}

    # --- score sheet ---------------------------------------------------------------------------

    def _student_rows(self, cs, cls, assessments, enrollments, kind_exam: bool, weights) -> List[Dict[str, Any]]:
        from src.db.models.people.student import Student

        ids = [a.id for a in assessments]
        entries: Dict[Any, Dict[Any, ScoreEntry]] = {}
        if ids:
            for e in self.db.query(ScoreEntry).filter(
                    ScoreEntry.tenant_id == self.tenant_id, ScoreEntry.assessment_id.in_(ids)).all():
                entries.setdefault(e.student_id, {})[e.assessment_id] = e
        students = {s.id: s for s in self.db.query(Student).filter(
            Student.id.in_([e.student_id for e in enrollments] or [None]))} if enrollments else {}
        rows = []
        for en in enrollments:
            st = students.get(en.student_id)
            mine = entries.get(en.student_id, {})
            if kind_exam:
                exam = assessments[0] if assessments else None
                e = mine.get(exam.id) if exam else None
                value = rs.entry_percent(e.status, e.score, exam.max_score) if e else None
                complete = e is not None
            else:
                value, complete = rs.period_score(
                    [(a.id, a.grading_category_id, a.max_score) for a in assessments],
                    {aid: (e.status, e.score) for aid, e in mine.items()}, weights)
            rows.append({
                "student_id": en.student_id, "name": rs.person_name(st),
                "admission_number": getattr(st, "admission_number", None),
                "scores": {str(aid): {"score": e.score, "status": e.status, "comment": e.comment}
                           for aid, e in mine.items()},
                "period_score": rs.transport(value), "complete": complete,
            })
        rows.sort(key=lambda r: (r["name"] or "").lower())
        return rows

    def _sheet_parts(self, cs, cls, period_id, semester_id):
        if period_id:
            period = self.period_in_year(period_id, cls.academic_year_id)
            semester = self._get(Semester, period.semester_id, "Semester")
        else:
            period = None
            semester = self.semester_in_year(semester_id, cls.academic_year_id)
        assessments = self._assessments_in(cs, period_id, semester_id)
        weights = {}
        cats = []
        if period is not None:
            cats = self.categories_for(cs, cls, [a.grading_category_id for a in assessments])
            weights = {c.id: float(c.weight or 0) for c in cats}
        return period, semester, assessments, cats, weights

    def sheet(self, class_subject_id, period_id=None, semester_id=None) -> Dict[str, Any]:
        self._scope(period_id, semester_id)
        cs = self.class_subject(class_subject_id)
        cls = self.klass(cs.class_id)
        self.require_view(cs, cls)
        period, semester, assessments, cats, weights = self._sheet_parts(cs, cls, period_id, semester_id)
        published = self.is_published(cls.id, period_id=period_id, semester_id=semester_id)
        enrollments = rs.class_roster(self.db, self.tenant_id, cls.id, active_only=True)
        rows = self._student_rows(cs, cls, assessments, enrollments, period is None, weights)
        can_edit = self.may_edit(cs) and (not published or self.can("manage_academic_data"))
        return {
            "class": {"id": cls.id, "name": cls.name},
            "subject": {"id": cs.subject_id, "name": cs.subject.name if cs.subject else None},
            "class_subject_id": cs.id,
            "teacher": {"id": cs.teacher_id, "name": rs.person_name(cs.teacher)} if cs.teacher_id else None,
            "period": {"id": period.id, "name": period.name, "number": period.period_number} if period else None,
            "semester": {"id": semester.id, "name": semester.name, "number": semester.semester_number},
            "published": published,
            "can_edit": can_edit,
            "can_manage": self.can("manage_academic_data"),
            "categories": [{"id": c.id, "name": c.name, "weight": c.weight} for c in cats],
            "assessments": [{"id": a.id, "title": a.title, "kind": a.kind, "max_score": a.max_score,
                             "grading_category_id": a.grading_category_id, "assessment_date": a.assessment_date,
                             "due_date": a.due_date} for a in assessments],
            "students": rows,
            "class_average": rs.transport(rs._mean(r["period_score"] for r in rows)),
        }

    def save_scores(self, assessment_id, entries: List[Dict[str, Any]]) -> Dict[str, Any]:
        a = self.assessment(assessment_id)
        cs = self.class_subject(a.class_subject_id)
        cls = self.klass(cs.class_id)
        self.require_edit(cs)
        enrolled = {e.student_id: e for e in rs.class_roster(self.db, self.tenant_id, cls.id, active_only=True)}
        problems, seen, clean = [], set(), []
        for item in entries:
            sid = item.get("student_id")
            try:
                sid = UUID(str(sid))
            except (TypeError, ValueError):
                problems.append({"student_id": str(sid), "error": "not a valid id"})
                continue
            if sid in seen:
                problems.append({"student_id": str(sid), "error": "listed twice"})
                continue
            seen.add(sid)
            if sid not in enrolled:
                problems.append({"student_id": str(sid), "error": "not enrolled in this class"})
                continue
            st = item.get("status") or "scored"
            score = item.get("score")
            if st not in SCORE_STATUSES:
                problems.append({"student_id": str(sid), "error": f"status must be one of {', '.join(SCORE_STATUSES)}"})
                continue
            if st == "scored" and score is not None:
                try:
                    score = float(score)
                except (TypeError, ValueError):
                    problems.append({"student_id": str(sid), "error": "score must be a number"})
                    continue
                if score < 0 or score > a.max_score:
                    problems.append({"student_id": str(sid), "error": f"score must be between 0 and {a.max_score:g}"})
                    continue
            if st != "scored":
                score = None
            clean.append((sid, st, score, item.get("comment")))
        if problems:
            raise _422({"message": "No scores were saved.", "problems": problems})

        self.guard_published(cs, period_id=a.period_id, semester_id=a.semester_id, entity_id=a.id,
                             details={"assessment": str(a.id), "entries": [
                                 {"student_id": str(s), "status": st, "score": sc} for s, st, sc, _ in clean]})
        existing = {e.student_id: e for e in self.db.query(ScoreEntry).filter(
            ScoreEntry.tenant_id == self.tenant_id, ScoreEntry.assessment_id == a.id,
            ScoreEntry.student_id.in_([c[0] for c in clean] or [None]))}
        now = datetime.now(UTC)
        for sid, st, score, comment in clean:
            row = existing.get(sid)
            if st == "scored" and score is None:  # clearing a mark
                if row is not None:
                    self.db.delete(row)
                continue
            if row is None:
                row = ScoreEntry(tenant_id=self.tenant_id, assessment_id=a.id, student_id=sid,
                                 enrollment_id=enrolled[sid].id, entered_at=now)
                self.db.add(row)
            row.status, row.score, row.comment = st, score, comment
            row.entered_by = self.user.id
            row.updated_at = now
        self.db.flush()

        period_id, semester_id = a.period_id, a.semester_id
        period, semester, assessments, cats, weights = self._sheet_parts(cs, cls, period_id, semester_id)
        roster = list(enrolled.values())
        all_rows = self._student_rows(cs, cls, assessments, roster, period is None, weights)
        touched = {c[0] for c in clean}
        return {
            "students": [r for r in all_rows if r["student_id"] in touched],
            "class_average": rs.transport(rs._mean(r["period_score"] for r in all_rows)),
        }

    # --- review and publish --------------------------------------------------------------------

    def progress(self, class_id, period_id=None, semester_id=None) -> Dict[str, Any]:
        self._scope(period_id, semester_id)
        cls = self.klass(class_id)
        self.require_class_view(cls)
        if period_id:
            self.period_in_year(period_id, cls.academic_year_id)
        else:
            self.semester_in_year(semester_id, cls.academic_year_id)
        published = self.is_published(cls.id, period_id=period_id, semester_id=semester_id)
        roster = rs.class_roster(self.db, self.tenant_id, cls.id, active_only=True)
        subjects = []
        css = self.db.query(ClassSubject).filter(ClassSubject.tenant_id == self.tenant_id,
                                                 ClassSubject.class_id == cls.id).all()
        for cs in css:
            _, _, assessments, _, weights = self._sheet_parts(cs, cls, period_id, semester_id)
            rows = self._student_rows(cs, cls, assessments, roster, period_id is None, weights)
            scored = [r["period_score"] for r in rows if r["period_score"] is not None]
            subjects.append({
                "class_subject_id": cs.id, "subject_id": cs.subject_id,
                "subject_name": cs.subject.name if cs.subject else None,
                "teacher_name": rs.person_name(cs.teacher), "assessments": len(assessments),
                "scored": len(scored), "students": len(roster),
                "class_average": rs.transport(rs._mean(scored)), "published": published,
            })
        subjects.sort(key=lambda s: (s["subject_name"] or "").lower())
        return {"class_id": cls.id, "class_name": cls.name, "class_size": len(roster),
                "published": published, "subjects": subjects}

    def _publication_out(self, p: ResultPublication) -> Dict[str, Any]:
        from src.db.models.auth.user import User
        by = self.db.query(User).filter(User.id == p.published_by).first() if p.published_by else None
        return {"id": p.id, "class_id": p.class_id, "period_id": p.period_id, "semester_id": p.semester_id,
                "published_at": p.published_at, "published_by": p.published_by,
                "published_by_name": rs.person_name(by)}

    def publish(self, class_id, period_id=None, semester_id=None) -> Dict[str, Any]:
        self.require("publish_results")
        self._scope(period_id, semester_id)
        cls = self.klass(class_id)
        if period_id:
            self.period_in_year(period_id, cls.academic_year_id)
        else:
            self.semester_in_year(semester_id, cls.academic_year_id)
            periods = self.db.query(Period).filter(Period.tenant_id == self.tenant_id,
                                                   Period.semester_id == semester_id).all()
            missing = [p.name for p in sorted(periods, key=lambda p: p.period_number)
                       if not self.is_published(cls.id, period_id=p.id)]
            if not periods or missing:
                raise _409({"message": "Publish all of the semester's periods first.", "missing_periods": missing})
        existing = self.db.query(ResultPublication).filter(
            ResultPublication.tenant_id == self.tenant_id, ResultPublication.class_id == cls.id,
            ResultPublication.period_id == period_id if period_id else ResultPublication.semester_id == semester_id,
        ).first()
        if existing:
            return self._publication_out(existing)
        # The sponsor's and principal's signatures in use now are fixed on the publication (§6)
        signers = ri.signers_snapshot(self.db, self.tenant_id, class_sponsor_id(self.db, cls))
        p = ResultPublication(tenant_id=self.tenant_id, class_id=cls.id, period_id=period_id,
                              semester_id=semester_id, published_by=self.user.id,
                              published_at=datetime.now(UTC), **signers)
        self.db.add(p)
        self.db.flush()
        return self._publication_out(p)

    def unpublish(self, class_id, period_id=None, semester_id=None) -> Dict[str, Any]:
        self.require("publish_results")
        self._scope(period_id, semester_id)
        cls = self.klass(class_id)
        q = self.db.query(ResultPublication).filter(
            ResultPublication.tenant_id == self.tenant_id, ResultPublication.class_id == cls.id)
        row = (q.filter(ResultPublication.period_id == period_id) if period_id
               else q.filter(ResultPublication.semester_id == semester_id)).first()
        if row is None:
            raise _404("Publication")
        if period_id:
            period = self._get(Period, period_id, "Period")
            if self.is_published(cls.id, semester_id=period.semester_id):
                raise _409("The semester is published. Unpublish the semester first.")
        self.db.delete(row)
        self.db.flush()
        return {"unpublished": True}

    def publications(self, academic_year_id: Optional[UUID]) -> List[Dict[str, Any]]:
        from src.db.models.people.teacher import Teacher
        if not self.staff_reader():
            if self.db.query(Teacher.id).filter(Teacher.id == self.user.id).first() is None:
                raise _403()
        year = self.year(academic_year_id)
        rows = (self.db.query(ResultPublication).join(Class, Class.id == ResultPublication.class_id)
                .filter(ResultPublication.tenant_id == self.tenant_id, Class.tenant_id == self.tenant_id,
                        Class.academic_year_id == year.id)
                .order_by(ResultPublication.published_at).all())
        return [self._publication_out(p) for p in rows]

    # --- settings -------------------------------------------------------------------------------

    def settings(self) -> Dict[str, Any]:
        row = self.db.query(GradingSettings).filter(GradingSettings.tenant_id == self.tenant_id).first()
        return {"pass_mark": row.pass_mark if row else rs.DEFAULT_PASS_MARK,
                "updated_at": row.updated_at if row else None}

    def update_settings(self, pass_mark: int) -> Dict[str, Any]:
        self.require("manage_academic_data")
        if pass_mark is None or not 0 <= int(pass_mark) <= 100:
            raise _422("pass_mark must be between 0 and 100")
        row = self.db.query(GradingSettings).filter(GradingSettings.tenant_id == self.tenant_id).first()
        if row is None:
            row = GradingSettings(tenant_id=self.tenant_id)
            self.db.add(row)
        row.pass_mark = int(pass_mark)
        row.updated_at = datetime.now(UTC)
        self.db.flush()
        return self.settings()

    # --- report cards ---------------------------------------------------------------------------

    def _is_parent_of(self, student_id) -> bool:
        from src.db.models.people.parent import parent_student
        return self.db.query(parent_student.c.student_id).filter(
            parent_student.c.parent_id == self.user.id, parent_student.c.student_id == student_id
        ).first() is not None

    def _identity(self, cls) -> Dict[str, Any]:
        """School block and signatures (§6), the same for every card of the class."""
        return {"school": ri.school_block(self.db, self.tenant_id),
                "signatures": ri.card_signatures(self.db, self.tenant_id, cls.id)}

    def _published_view(self, results):
        """The published-only results behind the verification snapshot (§7), or None when the
        class has nothing published."""
        if results.published_only:
            return results if rcv.has_publications(results) else None
        if not rcv.has_publications(results):
            return None
        return rs.ClassResults(self.db, self.tenant_id, results.cls, published_only=True)

    def _card(self, results, enrollment, year, student, identity=None, published=None):
        from src.db.models.auth.user import User
        sponsor_id = class_sponsor_id(self.db, results.cls)
        sponsor = self.db.query(User).filter(User.id == sponsor_id).first() if sponsor_id else None
        pass_mark = rs.pass_mark_for(self.db, self.tenant_id, year.id, results.cls.grade_id)
        card = rs.report_card(results, enrollment, student=student, year=year, pass_mark=pass_mark, sponsor=sponsor)
        card.update(identity if identity is not None else self._identity(results.cls))
        # Verification QR (§7): always from published results, whoever is looking
        card["verification"] = None
        if published is not None:
            snapshot = rcv.build_snapshot(published, enrollment, student=student, year=year, pass_mark=pass_mark)
            record = rcv.issue(self.db, self.tenant_id, student.id, year.id, snapshot)
            card["verification"] = rcv.verification_block(record)
        return card

    def student_report_card(self, student_id, academic_year_id: Optional[UUID]) -> Dict[str, Any]:
        from src.db.models.people.student import Student
        student = self.db.query(Student).filter(Student.tenant_id == self.tenant_id, Student.id == student_id).first()
        if student is None:
            raise _404("Student")
        year = self.year(academic_year_id)
        enrollment = self.db.query(Enrollment).filter(
            Enrollment.tenant_id == self.tenant_id, Enrollment.student_id == student.id,
            Enrollment.academic_year_id == year.id).first()
        own = str(student.id) == str(self.user.id) or self._is_parent_of(student.id)
        cls = self.klass(enrollment.class_id) if enrollment else None
        staff = self.staff_reader() or (cls is not None and self.is_sponsor_of(cls))
        if not staff and not own:
            raise _403()
        if not staff:
            # Fees hold (phase5-design.md §1): only the student's and parents' view; staff and the
            # public verification page are unaffected
            from src.services.finance.fee_service import HOLD_MESSAGE, report_card_held
            if report_card_held(self.db, self.tenant_id, student.id, year.id):
                raise _403(HOLD_MESSAGE)
        if enrollment is None:
            raise _404("Enrollment for this school year")
        results = rs.ClassResults(self.db, self.tenant_id, cls, published_only=not staff)
        return self._card(results, enrollment, year, student, published=self._published_view(results))

    def class_report_cards(self, class_id, academic_year_id: Optional[UUID] = None) -> Dict[str, Any]:
        from src.db.models.people.student import Student
        cls = self.klass(class_id)
        self.require_class_view(cls)
        if academic_year_id and academic_year_id != cls.academic_year_id:
            raise _422("The class is not in that school year")
        year = self.year(cls.academic_year_id)
        results = rs.ClassResults(self.db, self.tenant_id, cls, published_only=False)
        students = {s.id: s for s in self.db.query(Student).filter(
            Student.id.in_([e.student_id for e in results.roster] or [None]))}
        identity = self._identity(cls)
        published = self._published_view(results)
        cards = [self._card(results, e, year, students[e.student_id], identity, published)
                 for e in results.roster if e.student_id in students]
        cards.sort(key=lambda c: (c["student"]["name"] or "").lower())
        return {"items": cards}
