"""Paged roster, bulk class placement, graduation candidates and "Not graded" promotion results."""
from datetime import date

import main
from src.db.models.academics.academic_grade import AcademicGrade
from src.db.models.academics.academic_year import AcademicYear
from src.db.models.academics.class_model import Class
from src.db.models.academics.enrollment import Enrollment
from src.db.models.academics.section import Section
from src.db.models.people.student import Student
from src.db.session import get_db

from test_security import env, headers  # noqa: F401  shared app + two-school fixture


def _db():
    gen = main.app.dependency_overrides[get_db]()
    return gen, next(gen)


def _seed(ids, students=60):
    """School A, current year, Grade 1 and Grade 2 (final), one class each, N students (none placed)."""
    gen, db = _db()
    a = ids["tenant_a"]
    start, end = date(2026, 9, 1), date(2027, 6, 30)
    year = AcademicYear(tenant_id=a, name="2026/2027", start_date=start, end_date=end, is_current=True,
                        semester_1_start=start, semester_1_end=date(2027, 1, 31),
                        semester_2_start=date(2027, 2, 1), semester_2_end=end)
    g1 = AcademicGrade(tenant_id=a, name="Grade 1", sequence=1, is_active=True)
    g2 = AcademicGrade(tenant_id=a, name="Grade 2", sequence=2, is_active=True)
    db.add_all([year, g1, g2])
    db.flush()
    s1 = Section(tenant_id=a, name="A", grade_id=g1.id, capacity=30, is_active=True)
    s2 = Section(tenant_id=a, name="A", grade_id=g2.id, capacity=30, is_active=True)
    db.add_all([s1, s2])
    db.flush()
    c1 = Class(tenant_id=a, name="Grade 1 - A", academic_year_id=year.id, grade_id=g1.id, section_id=s1.id,
               capacity=30, start_date=start, is_active=True)
    c2 = Class(tenant_id=a, name="Grade 2 - A", academic_year_id=year.id, grade_id=g2.id, section_id=s2.id,
               capacity=30, start_date=start, is_active=True)
    db.add_all([c1, c2])
    pupils = [Student(tenant_id=a, first_name=f"Pupil{i:03d}", last_name="Test", password_hash="x",
                      admission_number=f"STU{i:04d}") for i in range(students)]
    db.add_all(pupils)
    db.flush()
    out = {"year": year.id, "c1": c1.id, "c2": c2.id, "students": [p.id for p in pupils]}
    next(gen, None)
    return out


ROSTER = "/api/v1/academics/class-placement/roster"


def test_roster_pages_filters_and_counts(env):
    client, ids = env
    s = _seed(ids)
    h = headers(ids, "admin_a")

    first = client.get(f"{ROSTER}?q=pupil&page=1&page_size=25", headers=h).json()  # the fixture has one more student
    assert first["total"] == 60 and first["pages"] == 3 and len(first["items"]) == 25
    assert first["counts"] == {"all": 60, "placed": 0, "unplaced": 60}
    last = client.get(f"{ROSTER}?q=pupil&page=3&page_size=25", headers=h).json()
    assert len(last["items"]) == 10
    names = [i["name"] for i in first["items"]] + [i["name"] for i in last["items"]]
    assert len(set(names)) == 35  # pages don't overlap

    found = client.get(f"{ROSTER}?q=stu0042", headers=h).json()
    assert [i["admission_number"] for i in found["items"]] == ["STU0042"]
    assert client.get(f"{ROSTER}?page_size=500", headers=h).status_code == 422  # capped at 100


def test_bulk_placement_moves_and_is_all_or_nothing(env):
    client, ids = env
    s = _seed(ids)
    h = headers(ids, "admin_a")
    batch = [str(x) for x in s["students"][:20]]

    placed = client.post("/api/v1/academics/class-placement", headers=h,
                         json={"class_id": str(s["c1"]), "student_ids": batch}).json()
    assert placed["placed"] == 20 and placed["enrolled"] == 20 and not placed["over_capacity"]
    roster = client.get(f"{ROSTER}?q=pupil&placement=placed&class_id={s['c1']}&page_size=100", headers=h).json()
    assert roster["total"] == 20 and roster["counts"]["unplaced"] == 40
    assert roster["items"][0]["enrollment"]["class_name"] == "Grade 1 - A"

    again = client.post("/api/v1/academics/class-placement", headers=h,
                        json={"class_id": str(s["c1"]), "student_ids": batch[:5]}).json()
    assert again["unchanged"] == 5
    moved = client.post("/api/v1/academics/class-placement", headers=h,
                        json={"class_id": str(s["c2"]), "student_ids": batch[:5]}).json()
    assert moved["moved"] == 5

    # One graduated student blocks the whole batch
    gen, db = _db()
    db.get(Student, s["students"][30]).status = "graduated"
    next(gen, None)
    refused = client.post("/api/v1/academics/class-placement", headers=h, json={
        "class_id": str(s["c1"]), "student_ids": [str(x) for x in s["students"][25:35]]})
    assert refused.status_code == 409 and len(refused.json()["detail"]["problems"]) == 1
    gen, db = _db()
    assert db.query(Enrollment).filter(Enrollment.student_id.in_(s["students"][25:35])).count() == 0


def test_roster_and_placement_are_scoped_to_the_school(env):
    client, ids = env
    s = _seed(ids, students=3)
    other = headers(ids, "admin_b")
    assert client.get(ROSTER, headers=other).status_code == 404  # school B has no current year
    resp = client.post("/api/v1/academics/class-placement", headers=other,
                       json={"class_id": str(s["c1"]), "student_ids": [str(s["students"][0])]})
    assert resp.status_code == 404


def test_graduation_candidates_are_the_final_grade_only(env):
    client, ids = env
    s = _seed(ids, students=4)
    h = headers(ids, "admin_a")
    client.post("/api/v1/academics/class-placement", headers=h,
                json={"class_id": str(s["c1"]), "student_ids": [str(x) for x in s["students"][:2]]})
    client.post("/api/v1/academics/class-placement", headers=h,
                json={"class_id": str(s["c2"]), "student_ids": [str(x) for x in s["students"][2:]]})

    result = client.get(f"/api/v1/academics/enrollments/graduation-candidates?academic_year_id={s['year']}", headers=h).json()
    assert result["final_grade"]["name"] == "Grade 2"
    assert {c["student_id"] for c in result["candidates"]} == {str(x) for x in s["students"][2:]}

    # Asking to graduate a Grade 1 student too: only the real candidates graduate
    everyone = [str(x) for x in s["students"]]
    done = client.post("/api/v1/academics/enrollments/graduate", headers=h,
                       json={"academic_year_id": str(s["year"]), "student_ids": everyone}).json()
    assert done == {"graduated": 2, "skipped": 2}
    gen, db = _db()
    assert {st.status for st in db.query(Student).filter(Student.id.in_(s["students"][:2]))} == {"active"}
    assert {st.status for st in db.query(Student).filter(Student.id.in_(s["students"][2:]))} == {"graduated"}


def test_student_without_grades_is_not_graded_not_repeating(env):
    import asyncio
    from src.services.academics.promotion_service import NOT_GRADED, PromotionService

    client, ids = env
    s = _seed(ids, students=1)
    h = headers(ids, "admin_a")
    client.post("/api/v1/academics/class-placement", headers=h,
                json={"class_id": str(s["c1"]), "student_ids": [str(s["students"][0])]})
    gen, db = _db()
    enrollment = db.query(Enrollment).filter(Enrollment.student_id == s["students"][0]).one()
    result = asyncio.run(PromotionService(tenant=ids["tenant_a"], db=db).evaluate_eligibility(enrollment.id))
    assert result["status"] == NOT_GRADED and result["failed_subject_ids"] == []
