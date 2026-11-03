"""Phase 4 gradebook: formulas, who may enter/see marks, publishing, report cards, promotion."""
import asyncio
from datetime import date

import pytest

import main
from src.db.models.academics.academic_grade import AcademicGrade
from src.db.models.academics.academic_year import AcademicYear
from src.db.models.academics.class_model import Class
from src.db.models.academics.class_subject import ClassSubject
from src.db.models.academics.enrollment import Enrollment
from src.db.models.academics.gradebook import ScoreEntry
from src.db.models.academics.grading_schema import GradingCategory, GradingSchema
from src.db.models.academics.period import Period
from src.db.models.academics.promotion_criteria import PromotionCriteria
from src.db.models.academics.section import Section
from src.db.models.academics.semester import Semester
from src.db.models.academics.subject import Subject
from src.db.models.auth.permission import Permission
from src.db.models.auth.user_role import UserRole
from src.db.models.logging.activity_log import ActivityLog
from src.db.models.people.parent import Parent
from src.db.models.people.student import Student
from src.db.models.people.teacher import Teacher
from src.db.session import get_db
from src.services.academics import results_service as rs

from test_security import env, headers  # noqa: F401  shared app + two-school fixture

GB = "/api/v1/academics/gradebook"
PUBLISHED = "Results for this period are published. Ask the principal to unpublish them first."


# --- formulas (no database) ---------------------------------------------------------------------

WEIGHTS = {"tests": 40, "assign": 30, "quiz": 20, "part": 10}


def test_period_score_weights_and_renormalisation():
    items = [("t1", "tests", 20), ("t2", "tests", 10), ("a1", "assign", 10)]
    entries = {"t1": ("scored", 18), "t2": ("scored", 7), "a1": ("scored", 10)}
    score, complete = rs.period_score(items, entries, WEIGHTS)
    # tests (90 + 70) / 2 = 80, assignments 100; quizzes and participation have nothing: left out
    assert score == pytest.approx((40 * 80 + 30 * 100) / 70)
    assert complete is True
    # every category present: plain weighted sum
    items += [("q1", "quiz", 5), ("p1", "part", 10)]
    entries.update(q1=("scored", 5), p1=("scored", 5))
    assert rs.period_score(items, entries, WEIGHTS)[0] == pytest.approx((40 * 80 + 30 * 100 + 20 * 100 + 10 * 50) / 100)
    # a missing mark: left out, and the period is incomplete
    del entries["q1"]
    score, complete = rs.period_score(items, entries, WEIGHTS)
    assert complete is False and score == pytest.approx((40 * 80 + 30 * 100 + 10 * 50) / 80)
    assert rs.period_score([], {}, WEIGHTS) == (None, False)


def test_excused_is_left_out_and_absent_counts_zero():
    items = [("t1", "tests", 20), ("t2", "tests", 10)]
    excused = rs.period_score(items, {"t1": ("excused", None), "t2": ("scored", 7)}, WEIGHTS)
    absent = rs.period_score(items, {"t1": ("absent", None), "t2": ("scored", 7)}, WEIGHTS)
    assert excused == (pytest.approx(70), True)
    assert absent == (pytest.approx(35), True)
    assert rs.period_score(items, {"t1": ("excused", None), "t2": ("excused", None)}, WEIGHTS) == (None, True)


def test_semester_and_yearly_averages_and_rounding():
    assert rs.semester_average([84, 79, 70], 70) == (pytest.approx(75.75), True)
    avg, complete = rs.semester_average([84, 79, None], 70)  # a missing column
    assert avg == pytest.approx(77.666, abs=1e-3) and complete is False
    assert rs.semester_average([None, None, None], None) == (None, False)
    assert rs.yearly_average([78.1, None]) == pytest.approx(78.1)
    assert rs.yearly_average([80, 70]) == 75
    assert rs.display_round(84.5) == 85 and rs.display_round(77.49) == 77 and rs.display_round(None) is None
    assert rs.transport(77.66666) == 77.67
    assert rs.competition_ranks({"a": 90, "b": 80, "c": 90, "d": None, "e": 70}) == \
        {"a": 1, "c": 1, "b": 3, "e": 4, "d": None}


# --- API --------------------------------------------------------------------------------------------

def _db():
    gen = main.app.dependency_overrides[get_db]()
    return gen, next(gen)


def _seed(ids):
    """School A: current year, 2 semesters x 3 periods, one class with Math and English, a sponsor,
    two subject teachers, another teacher, three students, a parent, an academic admin."""
    gen, db = _db()
    a = ids["tenant_a"]
    perms = {}
    for name in ("view_academic_data", "manage_academic_data", "publish_results", "view_exam", "view_assignments"):
        perms[name] = db.query(Permission).filter(Permission.name == name).first() or Permission(name=name)
        db.add(perms[name])
    admin_role = db.query(UserRole).filter(UserRole.name == "admin").one()
    admin_role.permissions += [p for p in (perms["view_academic_data"], perms["manage_academic_data"], perms["publish_results"])
                               if p not in admin_role.permissions]
    acad = UserRole(name="academic-admin")
    acad.permissions = [perms["view_academic_data"], perms["publish_results"]]
    teacher_role, parent_role = UserRole(name="teacher"), UserRole(name="parent")
    student_role = db.query(UserRole).filter(UserRole.name == "student").one()
    db.add_all([acad, teacher_role, parent_role])

    start, end = date(2026, 9, 1), date(2027, 6, 30)
    year = AcademicYear(tenant_id=a, name="2026/2027", start_date=start, end_date=end, is_current=True,
                        semester_1_start=start, semester_1_end=date(2027, 1, 31),
                        semester_2_start=date(2027, 2, 1), semester_2_end=end)
    grade = AcademicGrade(tenant_id=a, name="Grade 5", sequence=5, is_active=True)
    db.add_all([year, grade])
    db.flush()
    section = Section(tenant_id=a, name="A", grade_id=grade.id, capacity=30, is_active=True)
    db.add(section)
    db.flush()

    sem = [Semester(tenant_id=a, academic_year_id=year.id, name=f"Semester {n}", semester_number=n,
                    start_date=start if n == 1 else date(2027, 2, 1), end_date=date(2027, 1, 31) if n == 1 else end)
           for n in (1, 2)]
    db.add_all(sem)
    db.flush()
    periods = [Period(tenant_id=a, semester_id=sem[(n - 1) // 3].id, name=f"Period {n}", period_number=n,
                      start_date=start, end_date=end) for n in range(1, 7)]
    db.add_all(periods)

    n = iter(range(100))

    def person(cls, role, **extra):
        i = next(n)
        u = cls(tenant_id=a, email=f"p{i}@school-a.org", password_hash="x", first_name=f"First{i}",
                last_name=f"Last{i}", is_first_login=False, **extra)
        u.roles.append(role)
        db.add(u)
        return u

    math_t = person(Teacher, teacher_role, employee_id="T1")
    eng_t = person(Teacher, teacher_role, employee_id="T2")
    sponsor = person(Teacher, teacher_role, employee_id="T3")
    other_t = person(Teacher, teacher_role, employee_id="T4")
    academic = person(Teacher, acad, employee_id="T5")
    pupils = [person(Student, student_role, admission_number=f"S{i}") for i in range(3)]
    parent = person(Parent, parent_role, relationship_type="mother")
    db.flush()
    parent.students.append(pupils[0])

    cls = Class(tenant_id=a, name="Grade 5 - A", academic_year_id=year.id, grade_id=grade.id, section_id=section.id,
                capacity=30, start_date=start, is_active=True, class_teacher_id=sponsor.id)
    math = Subject(tenant_id=a, name="Math", code="MTH", is_active=True)
    english = Subject(tenant_id=a, name="English", code="ENG", is_active=True)
    db.add_all([cls, math, english])
    db.flush()
    cs_math = ClassSubject(tenant_id=a, class_id=cls.id, subject_id=math.id, teacher_id=math_t.id)
    cs_eng = ClassSubject(tenant_id=a, class_id=cls.id, subject_id=english.id, teacher_id=eng_t.id)
    schema = GradingSchema(tenant_id=a, name="Standard", academic_year_id=year.id, is_active=True)
    db.add_all([cs_math, cs_eng, schema])
    db.flush()
    cats = {name: GradingCategory(tenant_id=a, name=name, weight=w, schema_id=schema.id)
            for name, w in (("Tests", 40), ("Assignments", 30), ("Quizzes", 20), ("Participation", 10))}
    db.add_all(cats.values())
    for p in pupils:
        db.add(Enrollment(tenant_id=a, student_id=p.id, academic_year_id=year.id, grade_id=grade.id,
                          section_id=section.id, class_id=cls.id, status="active", is_active=True))
    db.flush()
    out = {
        "year": year.id, "grade": grade.id, "class": cls.id, "cs_math": cs_math.id, "cs_eng": cs_eng.id,
        "math": math.id, "sem": [s.id for s in sem], "periods": [p.id for p in periods],
        "cats": {k: v.id for k, v in cats.items()}, "pupils": [p.id for p in pupils],
    }
    ids.update(math_t=math_t.id, eng_t=eng_t.id, sponsor=sponsor.id, other_t=other_t.id, academic=academic.id,
               pupil0=pupils[0].id, pupil1=pupils[1].id, parent=parent.id)
    next(gen, None)
    return out


def _assessment(client, ids, s, who="math_t", period=0, cat="Tests", max_score=20, cs="cs_math", **extra):
    body = {"class_subject_id": str(s[cs]), "kind": "test", "period_id": str(s["periods"][period]),
            "grading_category_id": str(s["cats"][cat]), "title": "Test", "max_score": max_score, **extra}
    return client.post(f"{GB}/assessments", json=body, headers=headers(ids, who))


def _scores(client, ids, assessment_id, entries, who="math_t"):
    return client.put(f"{GB}/assessments/{assessment_id}/scores", json={"entries": entries}, headers=headers(ids, who))


def _exam(client, ids, s, semester=0, who="math_t", cs="cs_math"):
    body = {"class_subject_id": str(s[cs]), "kind": "exam", "semester_id": str(s["sem"][semester]),
            "title": "Semester exam", "max_score": 100}
    return client.post(f"{GB}/assessments", json=body, headers=headers(ids, who))


def _publish(client, ids, s, period=None, semester=None, who="academic"):
    body = {"class_id": str(s["class"])}
    if period is not None:
        body["period_id"] = str(s["periods"][period])
    else:
        body["semester_id"] = str(s["sem"][semester])
    return client.post(f"{GB}/publications", json=body, headers=headers(ids, who))


def test_score_entry_is_limited_to_the_subject_teacher(env):
    client, ids = env
    s = _seed(ids)
    created = _assessment(client, ids, s)
    assert created.status_code == 201, created.text
    aid = created.json()["id"]
    p0, p1 = (str(x) for x in s["pupils"][:2])

    assert _assessment(client, ids, s, who="eng_t").status_code == 403  # English teacher, Math subject
    ok = _scores(client, ids, aid, [{"student_id": p0, "score": 18}, {"student_id": p1, "status": "absent"}])
    assert ok.status_code == 200, ok.text
    assert {r["student_id"]: r["period_score"] for r in ok.json()["students"]} == {p0: 90.0, p1: 0.0}

    sheet = f"{GB}/sheet?class_subject_id={s['cs_math']}&period_id={s['periods'][0]}"
    mine = client.get(sheet, headers=headers(ids, "math_t")).json()
    assert mine["can_edit"] is True and mine["published"] is False and len(mine["students"]) == 3
    assert [c["weight"] for c in mine["categories"]] == [40, 30, 20, 10]
    assert mine["teacher"]["id"] == str(ids["math_t"]) and mine["class_average"] == 45.0

    # The class sponsor reads but can't write; another teacher can't even read
    sponsor = client.get(sheet, headers=headers(ids, "sponsor"))
    assert sponsor.status_code == 200 and sponsor.json()["can_edit"] is False
    assert _scores(client, ids, aid, [{"student_id": p0, "score": 1}], who="sponsor").status_code == 403
    assert client.get(sheet, headers=headers(ids, "other_t")).status_code == 403
    assert _scores(client, ids, aid, [{"student_id": p0, "score": 1}], who="other_t").status_code == 403
    assert client.get(sheet, headers=headers(ids, "student_a")).status_code == 403

    # Another school: not found
    assert client.get(sheet, headers=headers(ids, "admin_b")).status_code == 404
    assert _scores(client, ids, aid, [{"student_id": p0, "score": 1}], who="admin_b").status_code == 404

    # Class subjects a user may open
    listed = client.get(f"{GB}/class-subjects", headers=headers(ids, "sponsor")).json()
    assert {r["subject_name"]: r["can_edit"] for r in listed} == {"English": False, "Math": False}
    assert [r["subject_name"] for r in client.get(f"{GB}/class-subjects", headers=headers(ids, "math_t")).json()] == ["Math"]
    assert client.get(f"{GB}/class-subjects", headers=headers(ids, "other_t")).json() == []


def test_scores_are_validated_all_or_nothing_and_can_be_cleared(env):
    client, ids = env
    s = _seed(ids)
    aid = _assessment(client, ids, s).json()["id"]
    p0, p1 = (str(x) for x in s["pupils"][:2])
    bad = _scores(client, ids, aid, [{"student_id": p0, "score": 15}, {"student_id": p1, "score": 21},
                                     {"student_id": str(ids["student_a"]), "score": 3}])
    assert bad.status_code == 422 and len(bad.json()["detail"]["problems"]) == 2
    gen, db = _db()
    assert db.query(ScoreEntry).count() == 0
    next(gen, None)

    assert _scores(client, ids, aid, [{"student_id": p0, "score": 15, "comment": "good"}]).status_code == 200
    cleared = _scores(client, ids, aid, [{"student_id": p0, "score": None, "status": "scored"}])
    assert cleared.status_code == 200 and cleared.json()["students"][0]["scores"] == {}

    # Deleting an assessment with marks needs force, which its teacher may use
    _scores(client, ids, aid, [{"student_id": p0, "score": 15}])
    assert client.delete(f"{GB}/assessments/{aid}", headers=headers(ids, "math_t")).status_code == 409
    gone = client.delete(f"{GB}/assessments/{aid}?force=true", headers=headers(ids, "math_t"))
    assert gone.status_code == 200 and gone.json()["scores_deleted"] == 1


def test_publish_flow_and_published_period_edits(env):
    client, ids = env
    s = _seed(ids)
    aid = _assessment(client, ids, s).json()["id"]
    p0 = str(s["pupils"][0])
    _scores(client, ids, aid, [{"student_id": p0, "score": 16}])

    assert _publish(client, ids, s, period=0, who="math_t").status_code == 403  # teachers can't publish
    assert _publish(client, ids, s, semester=0).status_code == 409  # its periods first
    pub = _publish(client, ids, s, period=0)
    assert pub.status_code == 201 and pub.json()["published_by_name"]

    # Teachers can't change a published period; an admin can, and it's audit-logged
    blocked = _scores(client, ids, aid, [{"student_id": p0, "score": 10}])
    assert blocked.status_code == 409 and blocked.json()["detail"] == PUBLISHED
    assert _assessment(client, ids, s, title="Late test").status_code == 409
    sheet = client.get(f"{GB}/sheet?class_subject_id={s['cs_math']}&period_id={s['periods'][0]}",
                       headers=headers(ids, "math_t")).json()
    assert sheet["published"] is True and sheet["can_edit"] is False
    assert _scores(client, ids, aid, [{"student_id": p0, "score": 10}], who="admin_a").status_code == 200
    gen, db = _db()
    assert db.query(ActivityLog).filter(ActivityLog.entity_type == "published_results").count() == 1
    next(gen, None)

    _publish(client, ids, s, period=1)
    _publish(client, ids, s, period=2)
    assert _publish(client, ids, s, semester=0).status_code == 201
    # A period can't be unpublished under a published semester
    url = f"{GB}/publications?class_id={s['class']}&period_id={s['periods'][0]}"
    assert client.delete(url, headers=headers(ids, "academic")).status_code == 409
    assert client.delete(f"{GB}/publications?class_id={s['class']}&semester_id={s['sem'][0]}",
                         headers=headers(ids, "academic")).status_code == 200
    assert client.delete(url, headers=headers(ids, "academic")).status_code == 200
    listed = client.get(f"{GB}/publications", headers=headers(ids, "math_t")).json()
    assert len(listed) == 2
    assert client.get(f"{GB}/publications", headers=headers(ids, "student_a")).status_code == 403

    progress = client.get(f"{GB}/classes/{s['class']}/progress?period_id={s['periods'][1]}",
                          headers=headers(ids, "academic")).json()
    assert progress["class_size"] == 3 and progress["published"] is True
    assert {x["subject_name"] for x in progress["subjects"]} == {"Math", "English"}
    assert client.get(f"{GB}/classes/{s['class']}/progress?period_id={s['periods'][1]}",
                      headers=headers(ids, "math_t")).status_code == 403


def _fill_semester_one(client, ids, s, math=(80, 70, 60), exam=50):
    """Math for pupil 0: one 100-point test per period and the semester exam."""
    p0, p1 = (str(x) for x in s["pupils"][:2])
    for period, score in enumerate(math):
        aid = _assessment(client, ids, s, period=period, max_score=100).json()["id"]
        _scores(client, ids, aid, [{"student_id": p0, "score": score}, {"student_id": p1, "score": 100}])
    eid = _exam(client, ids, s).json()["id"]
    _scores(client, ids, eid, [{"student_id": p0, "score": exam}, {"student_id": p1, "score": 100}])


def test_students_and_parents_see_published_results_only(env):
    client, ids = env
    s = _seed(ids)
    _fill_semester_one(client, ids, s)
    p0 = s["pupils"][0]
    card_url = f"{GB}/report-cards/students/{p0}"

    staff = client.get(card_url, headers=headers(ids, "academic")).json()
    math = next(x for x in staff["subjects"] if x["name"] == "Math")
    assert math["semesters"][0]["periods"] == [80, 70, 60] and math["semesters"][0]["exam"] == 50
    assert math["semesters"][0]["average"] == 65 and math["semesters"][0]["complete"] is True
    assert math["semesters"][0]["published"] == {"periods": [False, False, False], "exam": False}
    assert staff["overall"]["rank"] == 2 and staff["overall"]["class_size"] == 3

    own = client.get(card_url, headers=headers(ids, "pupil0"))
    assert own.status_code == 200
    m = next(x for x in own.json()["subjects"] if x["name"] == "Math")
    assert m["semesters"][0]["periods"] == [None, None, None] and m["yearly_average"] is None
    assert "published" not in m["semesters"][0] and own.json()["overall"]["rank"] is None

    _publish(client, ids, s, period=0)
    m = next(x for x in client.get(card_url, headers=headers(ids, "parent")).json()["subjects"] if x["name"] == "Math")
    assert m["semesters"][0]["periods"] == [80, None, None] and m["semesters"][0]["average"] is None

    _publish(client, ids, s, period=1)
    _publish(client, ids, s, period=2)
    _publish(client, ids, s, semester=0)
    card = client.get(card_url, headers=headers(ids, "parent")).json()
    m = next(x for x in card["subjects"] if x["name"] == "Math")
    assert m["semesters"][0]["average"] == 65 and m["yearly_average"] == 65 and m["passed"] is False
    assert card["overall"]["rank"] == 2 and card["student"]["admission_number"] == "S0"
    assert card["class"]["sponsor_name"] and card["year"]["name"] == "2026/2027"

    # Other children: no
    assert client.get(f"{GB}/report-cards/students/{s['pupils'][1]}", headers=headers(ids, "parent")).status_code == 403
    assert client.get(f"{GB}/report-cards/students/{s['pupils'][1]}", headers=headers(ids, "pupil0")).status_code == 403
    assert client.get(card_url, headers=headers(ids, "admin_b")).status_code == 404


def test_class_report_cards_and_pass_mark_override(env):
    client, ids = env
    s = _seed(ids)
    _fill_semester_one(client, ids, s)
    url = f"{GB}/report-cards/classes/{s['class']}"
    cards = client.get(url, headers=headers(ids, "sponsor")).json()["items"]
    assert len(cards) == 3 and all(c["pass_mark"] == 70 for c in cards)
    assert sorted(c["overall"]["rank"] or 0 for c in cards) == [0, 1, 2]
    assert client.get(url, headers=headers(ids, "pupil0")).status_code == 403
    assert client.get(url, headers=headers(ids, "math_t")).status_code == 403

    assert client.get(f"{GB}/settings", headers=headers(ids, "math_t")).json()["pass_mark"] == 70
    assert client.put(f"{GB}/settings", json={"pass_mark": 60}, headers=headers(ids, "math_t")).status_code == 403
    assert client.put(f"{GB}/settings", json={"pass_mark": 60}, headers=headers(ids, "admin_a")).json()["pass_mark"] == 60
    card = client.get(f"{GB}/report-cards/students/{s['pupils'][0]}", headers=headers(ids, "admin_a")).json()
    assert card["pass_mark"] == 60
    assert next(x for x in card["subjects"] if x["name"] == "Math")["passed"] is True  # 65 >= 60

    gen, db = _db()
    db.add(PromotionCriteria(tenant_id=ids["tenant_a"], academic_year_id=s["year"], grade_id=s["grade"], passing_mark=66))
    next(gen, None)
    card = client.get(f"{GB}/report-cards/students/{s['pupils'][0]}", headers=headers(ids, "admin_a")).json()
    assert card["pass_mark"] == 66
    assert next(x for x in card["subjects"] if x["name"] == "Math")["passed"] is False


def test_promotion_uses_published_yearly_averages(env):
    from src.services.academics.promotion_service import NOT_GRADED, PromotionService

    client, ids = env
    s = _seed(ids)
    _fill_semester_one(client, ids, s)  # pupil 0: Math 65, pupil 1: Math 100

    def evaluate(index):
        gen, db = _db()
        enrollment = db.query(Enrollment).filter(Enrollment.student_id == s["pupils"][index]).one()
        result = asyncio.run(PromotionService(tenant=ids["tenant_a"], db=db).evaluate_eligibility(enrollment.id))
        next(gen, None)
        return result

    assert evaluate(0)["status"] == NOT_GRADED  # nothing published yet
    for period in range(3):
        _publish(client, ids, s, period=period)
    _publish(client, ids, s, semester=0)
    failed = evaluate(0)
    assert failed["status"] == "Conditional" and [str(x) for x in failed["failed_subject_ids"]] == [str(s["math"])]
    assert failed["total_score"] == 65
    passed = evaluate(1)
    assert passed["status"] == "Eligible" and passed["failed_subject_ids"] == []


def test_exam_rules(env):
    client, ids = env
    s = _seed(ids)
    assert _exam(client, ids, s).status_code == 201
    assert _exam(client, ids, s).status_code == 409  # one exam per subject and semester
    bad = {"class_subject_id": str(s["cs_math"]), "kind": "exam", "period_id": str(s["periods"][0]),
           "title": "x", "max_score": 10}
    assert client.post(f"{GB}/assessments", json=bad, headers=headers(ids, "math_t")).status_code == 422
    no_cat = {"class_subject_id": str(s["cs_math"]), "kind": "quiz", "period_id": str(s["periods"][0]),
              "title": "x", "max_score": 10}
    assert client.post(f"{GB}/assessments", json=no_cat, headers=headers(ids, "math_t")).status_code == 422
    listed = client.get(f"{GB}/assessments?class_subject_id={s['cs_math']}&semester_id={s['sem'][0]}",
                        headers=headers(ids, "math_t")).json()
    assert [(a["kind"], a["entered"], a["students"]) for a in listed] == [("exam", 0, 3)]


def test_categories_status_counts_gradebook_assessments(env):
    client, ids = env
    s = _seed(ids)
    _assessment(client, ids, s, max_score=20)
    _assessment(client, ids, s, max_score=15)
    _assessment(client, ids, s, period=1, max_score=30)  # another period
    _assessment(client, ids, s, cs="cs_eng", who="eng_t", max_score=5)  # another subject
    _exam(client, ids, s)  # no category

    def status(**scope):
        q = "&".join(f"{k}={v}" for k, v in scope.items())
        r = client.get(f"/api/v1/academics/categories-status?class_id={s['class']}&subject_id={s['math']}&{q}",
                       headers=headers(ids, "math_t"))
        assert r.status_code == 200, r.text
        return {c["name"]: (c["allocated_marks"], c["remaining_marks"]) for c in r.json()}

    assert status(period_id=s["periods"][0])["Tests"] == (35, 5)
    assert status(period_id=s["periods"][0])["Quizzes"] == (0, 20)
    assert status(semester_id=s["sem"][0])["Tests"] == (65, 0)
    assert status(semester_id=s["sem"][1])["Tests"] == (0, 40)


def test_old_grade_reads_are_closed(env):
    client, ids = env
    h = headers(ids, "student_a")
    assert client.get("/api/v1/academics/grades", headers=h).status_code == 404  # retired
    assert client.get("/api/v1/academics/exams", headers=h).status_code == 404  # retired
    assert client.get("/api/v1/academics/assignments", headers=h).status_code == 403
    assert client.get("/api/v1/academics/promotions/criteria", headers=h).status_code == 403
    assert client.get("/api/v1/academics/remedial/sessions", headers=h).status_code == 403
