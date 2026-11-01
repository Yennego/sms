"""Period, semester and yearly results (docs/remodel/phase4-design.md §1).

- Period grade for a subject: each grading category's score is the average percentage of its
  assessments in the period; the period grade is the weighted sum. Categories with nothing to
  count are left out and the remaining weights are scaled up to 100.
- Semester average: (P1 + P2 + P3 + semester exam) / 4 over the columns that exist; when a column
  is missing the average is marked incomplete.
- Yearly average: mean of the semester averages that exist.
- A subject is passed when its yearly average >= the pass mark (school setting, overridden by the
  grade level's promotion criteria).
- Excused marks are left out; absent counts as 0. Everything is computed at full precision; the
  API rounds to 2 decimals for transport and screens show whole numbers (`display_round`).

The pure functions take plain values so they can be tested without a database; `ClassResults`
loads one class's data for a school year in a handful of queries and computes every student.
"""
from collections import defaultdict
from decimal import Decimal, ROUND_HALF_UP
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple
from uuid import UUID

from sqlalchemy import or_
from sqlalchemy.orm import Session

DEFAULT_PASS_MARK = 70
LEFT_ENROLLMENT_STATUSES = ("withdrawn", "transferred")


# --- formulas --------------------------------------------------------------------------------

def entry_percent(status: Optional[str], score: Optional[float], max_score: float) -> Optional[float]:
    """An entry's percentage: None when excused (left out), 0 when absent."""
    if status == "excused":
        return None
    if status == "absent":
        return 0.0
    if score is None or not max_score:
        return None
    return float(score) / float(max_score) * 100.0


def _mean(values: Iterable[Optional[float]]) -> Optional[float]:
    vals = [v for v in values if v is not None]
    return sum(vals) / len(vals) if vals else None


def period_score(
    assessments: Sequence[Tuple[Any, Any, float]],
    entries: Dict[Any, Tuple[Optional[str], Optional[float]]],
    weights: Dict[Any, float],
) -> Tuple[Optional[float], bool]:
    """One student's period grade for one subject.

    assessments: (assessment_id, category_id, max_score); entries: assessment_id -> (status, score)
    for this student; weights: category_id -> weight. Returns (score or None, complete), complete
    meaning every assessment has an entry (scored, absent or excused).
    """
    by_category: Dict[Any, List[float]] = defaultdict(list)
    for assessment_id, category_id, max_score in assessments:
        entry = entries.get(assessment_id)
        if entry is None:
            continue
        pct = entry_percent(entry[0], entry[1], max_score)
        if pct is not None:
            by_category[category_id].append(pct)
    complete = bool(assessments) and all(a[0] in entries for a in assessments)
    used = {c: sum(v) / len(v) for c, v in by_category.items() if v and (weights.get(c) or 0) > 0}
    total_weight = sum(weights[c] for c in used)
    if not used or total_weight <= 0:
        return None, complete
    return sum(weights[c] * avg for c, avg in used.items()) / total_weight, complete


def semester_average(periods: Sequence[Optional[float]], exam: Optional[float]) -> Tuple[Optional[float], bool]:
    """(P1 + P2 + P3 + exam) / 4 over the columns that exist; complete when none is missing."""
    columns = list(periods) + [exam]
    return _mean(columns), all(c is not None for c in columns)


def yearly_average(semesters: Sequence[Optional[float]]) -> Optional[float]:
    return _mean(semesters)


def display_round(value: Optional[float]) -> Optional[int]:
    """Whole number for display (half up: 84.5 -> 85)."""
    if value is None:
        return None
    return int(Decimal(str(value)).quantize(Decimal("1"), rounding=ROUND_HALF_UP))


def transport(value: Optional[float]) -> Optional[float]:
    return None if value is None else round(value, 2)


def competition_ranks(values: Dict[Any, Optional[float]]) -> Dict[Any, Optional[int]]:
    """1, 2, 2, 4 ranking (highest first); None for students without a value."""
    ordered = sorted((v, k) for k, v in values.items() if v is not None)
    ordered.reverse()
    ranks: Dict[Any, Optional[int]] = {k: None for k in values}
    for position, (value, key) in enumerate(ordered, start=1):
        ranks[key] = position if position == 1 or value != ordered[position - 2][0] else ranks[ordered[position - 2][1]]
    return ranks


# --- school data --------------------------------------------------------------------------------

def pass_mark_for(db: Session, tenant_id: UUID, academic_year_id: Optional[UUID], grade_id: Optional[UUID]) -> int:
    """The grade level's promotion criteria pass mark, else the school's, else 70."""
    from src.db.models.academics.gradebook import GradingSettings
    from src.db.models.academics.promotion_criteria import PromotionCriteria

    if academic_year_id and grade_id:
        criteria = db.query(PromotionCriteria).filter(
            PromotionCriteria.tenant_id == tenant_id,
            PromotionCriteria.academic_year_id == academic_year_id,
            PromotionCriteria.grade_id == grade_id,
        ).first()
        if criteria and criteria.passing_mark is not None:
            return int(criteria.passing_mark)
    settings = db.query(GradingSettings).filter(GradingSettings.tenant_id == tenant_id).first()
    return int(settings.pass_mark) if settings else DEFAULT_PASS_MARK


def year_terms(db: Session, tenant_id: UUID, academic_year_id: UUID):
    """The year's semesters (by number) with their periods (by number)."""
    from src.db.models.academics.period import Period
    from src.db.models.academics.semester import Semester

    semesters = db.query(Semester).filter(
        Semester.tenant_id == tenant_id, Semester.academic_year_id == academic_year_id
    ).order_by(Semester.semester_number).all()
    periods = db.query(Period).filter(
        Period.tenant_id == tenant_id, Period.semester_id.in_([s.id for s in semesters] or [None])
    ).order_by(Period.period_number).all() if semesters else []
    by_semester = defaultdict(list)
    for p in periods:
        by_semester[p.semester_id].append(p)
    return [(s, by_semester[s.id]) for s in semesters]


def class_roster(db: Session, tenant_id: UUID, class_id: UUID, *, active_only: bool):
    """Enrollments in a class: active ones (score entry) or everyone who didn't leave (results)."""
    from src.db.models.academics.enrollment import Enrollment

    query = db.query(Enrollment).filter(Enrollment.tenant_id == tenant_id, Enrollment.class_id == class_id)
    if active_only:
        query = query.filter(Enrollment.is_active == True, Enrollment.status == "active")  # noqa: E712
    else:
        query = query.filter(or_(Enrollment.status.is_(None), Enrollment.status.notin_(LEFT_ENROLLMENT_STATUSES)))
    return query.all()


def person_name(user: Any) -> Optional[str]:
    if user is None:
        return None
    return f"{user.first_name or ''} {user.last_name or ''}".strip() or None


def published_sets(db: Session, tenant_id: UUID, class_id: UUID):
    from src.db.models.academics.gradebook import ResultPublication

    rows = db.query(ResultPublication).filter(
        ResultPublication.tenant_id == tenant_id, ResultPublication.class_id == class_id
    ).all()
    return ({r.period_id for r in rows if r.period_id}, {r.semester_id for r in rows if r.semester_id})


class ClassResults:
    """Every student's results in one class for its school year.

    published_only: periods count only when published for the class; the exam and the semester
    average only when the semester is published (what students and parents see).
    """

    def __init__(self, db: Session, tenant_id: UUID, cls: Any, *, published_only: bool):
        from src.db.models.academics.assessment import Assessment
        from src.db.models.academics.class_subject import ClassSubject
        from src.db.models.academics.gradebook import ScoreEntry
        from src.db.models.academics.grading_schema import GradingCategory

        self.db, self.tenant_id, self.cls = db, tenant_id, cls
        self.published_only = published_only
        self.terms = year_terms(db, tenant_id, cls.academic_year_id)
        self.published_periods, self.published_semesters = published_sets(db, tenant_id, cls.id)
        self.class_subjects = db.query(ClassSubject).filter(
            ClassSubject.tenant_id == tenant_id, ClassSubject.class_id == cls.id
        ).all()
        self.class_subjects.sort(key=lambda cs: ((cs.subject.name if cs.subject else "") or "").lower())
        cs_ids = [cs.id for cs in self.class_subjects]
        assessments = db.query(Assessment).filter(
            Assessment.tenant_id == tenant_id, Assessment.class_subject_id.in_(cs_ids or [None])
        ).all() if cs_ids else []
        self.assessments_by_cs = defaultdict(list)
        for a in assessments:
            self.assessments_by_cs[a.class_subject_id].append(a)
        category_ids = {a.grading_category_id for a in assessments if a.grading_category_id}
        self.weights = {c.id: float(c.weight or 0) for c in db.query(GradingCategory).filter(
            GradingCategory.tenant_id == tenant_id, GradingCategory.id.in_(category_ids)
        ).all()} if category_ids else {}
        self.entries = defaultdict(dict)  # student_id -> assessment_id -> (status, score)
        if assessments:
            for e in db.query(ScoreEntry).filter(
                ScoreEntry.tenant_id == tenant_id, ScoreEntry.assessment_id.in_([a.id for a in assessments])
            ).all():
                self.entries[e.student_id][e.assessment_id] = (e.status, e.score)
        self.roster = class_roster(db, tenant_id, cls.id, active_only=False)
        self._cache: Dict[Any, Dict[str, Any]] = {}

    # visibility
    def period_visible(self, period_id) -> bool:
        return not self.published_only or period_id in self.published_periods

    def semester_visible(self, semester_id) -> bool:
        return not self.published_only or semester_id in self.published_semesters

    def subject_result(self, student_id, cs) -> Dict[str, Any]:
        entries = self.entries.get(student_id, {})
        assessments = self.assessments_by_cs.get(cs.id, [])
        semesters = []
        for semester, periods in self.terms:
            period_values = []
            for p in periods:
                if not self.period_visible(p.id):
                    period_values.append(None)
                    continue
                items = [(a.id, a.grading_category_id, a.max_score) for a in assessments
                         if a.kind != "exam" and a.period_id == p.id]
                period_values.append(period_score(items, entries, self.weights)[0])
            exam_value = None
            if self.semester_visible(semester.id):
                exam = next((a for a in assessments if a.kind == "exam" and a.semester_id == semester.id), None)
                if exam is not None and exam.id in entries:
                    status, score = entries[exam.id]
                    exam_value = entry_percent(status, score, exam.max_score)
                average, complete = semester_average(period_values, exam_value)
            else:
                average, complete = None, False
            semesters.append({
                "id": semester.id, "number": semester.semester_number, "periods": period_values,
                "exam": exam_value, "average": average, "complete": complete,
                "published": {
                    "periods": [p.id in self.published_periods for p in periods],
                    "exam": semester.id in self.published_semesters,
                },
            })
        return {"semesters": semesters, "yearly_average": yearly_average([s["average"] for s in semesters])}

    def student(self, student_id) -> Dict[str, Any]:
        if student_id not in self._cache:
            subjects = {cs.id: self.subject_result(student_id, cs) for cs in self.class_subjects}
            semester_count = len(self.terms)
            overall_semesters = [
                _mean(s["semesters"][i]["average"] for s in subjects.values()) for i in range(semester_count)
            ]
            self._cache[student_id] = {
                "subjects": subjects,
                "semester_averages": overall_semesters,
                "yearly_average": _mean(s["yearly_average"] for s in subjects.values()),
            }
        return self._cache[student_id]

    def ranks(self) -> Dict[Any, Optional[int]]:
        if "_ranks" not in self._cache:
            self._cache["_ranks"] = competition_ranks(
                {e.student_id: self.student(e.student_id)["yearly_average"] for e in self.roster}
            )
        return self._cache["_ranks"]


def attendance_summary(db: Session, tenant_id: UUID, student_id: UUID, academic_year_id: UUID) -> Dict[str, int]:
    from sqlalchemy import func
    from src.db.models.academics.daily_attendance import DailyAttendance

    counts = dict(db.query(DailyAttendance.status, func.count(DailyAttendance.id)).filter(
        DailyAttendance.tenant_id == tenant_id, DailyAttendance.student_id == student_id,
        DailyAttendance.academic_year_id == academic_year_id,
    ).group_by(DailyAttendance.status).all())
    by_name = defaultdict(int)
    for status, n in counts.items():
        name = getattr(status, "value", status)
        by_name[{"tardy": "late", "sick": "excused"}.get(name, name)] += n
    return {k: by_name.get(k, 0) for k in ("present", "absent", "late", "excused")}


def report_card(results: ClassResults, enrollment: Any, *, student: Any, year: Any, pass_mark: int,
                sponsor: Any = None) -> Dict[str, Any]:
    """One report card in the API shape (§4)."""
    cls = results.cls
    data = results.student(enrollment.student_id)
    staff = not results.published_only
    subjects = []
    for cs in results.class_subjects:
        r = data["subjects"][cs.id]
        semesters = []
        for s in r["semesters"]:
            item = {
                "number": s["number"], "periods": [transport(v) for v in s["periods"]],
                "exam": transport(s["exam"]), "average": transport(s["average"]), "complete": s["complete"],
            }
            if staff:
                item["published"] = s["published"]
            semesters.append(item)
        yearly = r["yearly_average"]
        subjects.append({
            "subject_id": cs.subject_id, "name": cs.subject.name if cs.subject else None,
            "teacher_name": person_name(cs.teacher),
            "semesters": semesters, "yearly_average": transport(yearly),
            "passed": None if yearly is None else yearly >= pass_mark,
        })
    roster_ids = {e.student_id for e in results.roster}
    return {
        "student": {
            "id": student.id, "name": person_name(student), "first_name": student.first_name,
            "last_name": student.last_name, "admission_number": getattr(student, "admission_number", None),
        },
        "class": {"id": cls.id, "name": cls.name, "sponsor_name": person_name(sponsor)},
        "year": {"id": year.id, "name": year.name},
        "pass_mark": pass_mark,
        "published_only": results.published_only,
        "semesters": [
            {"id": s.id, "number": s.semester_number, "name": s.name, "published": s.id in results.published_semesters,
             "periods": [{"id": p.id, "number": p.period_number, "name": p.name,
                          "published": p.id in results.published_periods} for p in periods]}
            for s, periods in results.terms
        ],
        "subjects": subjects,
        "overall": {
            "semester_averages": [transport(v) for v in data["semester_averages"]],
            "yearly_average": transport(data["yearly_average"]),
            "rank": results.ranks().get(enrollment.student_id) if enrollment.student_id in roster_ids else None,
            "class_size": len(results.roster),
        },
        "attendance": attendance_summary(results.db, results.tenant_id, enrollment.student_id, cls.academic_year_id),
        "remarks": {"sponsor": None, "principal": None},
    }


def subject_outcomes(db: Session, tenant_id: UUID, enrollment: Any, *, cache: Optional[dict] = None):
    """Published yearly averages per subject for one enrollment (promotion and remedial).

    Returns (pass_mark, {subject_id: yearly_average}, overall_yearly); subjects without a published
    yearly average are left out.
    """
    from src.db.models.academics.class_model import Class

    cache = cache if cache is not None else {}
    results = cache.get(enrollment.class_id)
    if results is None:
        cls = db.query(Class).filter(Class.tenant_id == tenant_id, Class.id == enrollment.class_id).first()
        if cls is None:
            return pass_mark_for(db, tenant_id, enrollment.academic_year_id, enrollment.grade_id), {}, None
        results = cache[enrollment.class_id] = ClassResults(db, tenant_id, cls, published_only=True)
    data = results.student(enrollment.student_id)
    by_subject = {}
    for cs in results.class_subjects:
        value = data["subjects"][cs.id]["yearly_average"]
        if value is not None:
            by_subject[cs.subject_id] = value
    pass_mark = pass_mark_for(db, tenant_id, enrollment.academic_year_id, enrollment.grade_id)
    return pass_mark, by_subject, data["yearly_average"]
