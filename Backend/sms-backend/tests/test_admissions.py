"""Admit-and-enroll, guardian search and spreadsheet import (docs/remodel/phase3-api.md §2)."""
from datetime import date
from uuid import UUID

import main
from src.db.models.academics.academic_grade import AcademicGrade
from src.db.models.academics.academic_year import AcademicYear
from src.db.models.academics.class_model import Class
from src.db.models.academics.enrollment import Enrollment
from src.db.models.academics.section import Section
from src.db.models.auth.user_role import UserRole
from src.db.models.people.parent import Parent
from src.db.models.people.student import Student
from src.db.session import get_db

from test_security import env, headers  # noqa: F401  shared app + two-school fixture


def _year(tenant_id, name, start_date, end_date, **extra):
    """A school year; the old semester date columns are still required by the model."""
    middle = start_date + (end_date - start_date) / 2
    return AcademicYear(tenant_id=tenant_id, name=name, start_date=start_date, end_date=end_date,
                        semester_1_start=start_date, semester_1_end=middle,
                        semester_2_start=middle, semester_2_end=end_date, **extra)


def _db():
    gen = main.app.dependency_overrides[get_db]()
    return gen, next(gen)


def _seed(ids):
    gen, db = _db()
    a = ids["tenant_a"]
    year = _year(a, "2026/2027", start_date=date(2026, 9, 1), end_date=date(2027, 6, 30), is_current=True)
    grade = AcademicGrade(tenant_id=a, name="Grade 1", sequence=1, is_active=True)
    db.add_all([year, grade, UserRole(name="parent")])
    db.flush()
    section = Section(tenant_id=a, name="A", grade_id=grade.id, capacity=30, is_active=True)
    db.add(section)
    db.flush()
    klass = Class(tenant_id=a, name="Grade 1 - A", academic_year_id=year.id, grade_id=grade.id, section_id=section.id,
                  capacity=30, start_date=year.start_date, is_active=True)
    db.add(klass)
    db.flush()
    out = {"class": klass.id, "year": year.id}
    next(gen, None)
    return out


def test_admit_creates_student_guardian_and_enrollment(env):
    client, ids = env
    s = _seed(ids)
    h = headers(ids, "admin_a")
    resp = client.post("/api/v1/people/admissions", headers=h, json={
        "student": {"first_name": "Esi", "last_name": "Dahn", "gender": "female"},
        "guardian": {"first_name": "Kofi", "last_name": "Dahn", "relationship_type": "father", "phone_number": "0770000001"},
        "class_id": str(s["class"]),
    })
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["student"]["username"] == "esi.dahn" and body["student"]["admission_number"]
    assert body["guardian"]["created"] and body["enrollment"]["class_name"] == "Grade 1 - A"
    assert {c["who"] for c in body["credentials"]} == {"student", "guardian"}

    gen, db = _db()
    student = db.get(Student, UUID(body["student"]["id"]))
    enrollment = db.query(Enrollment).filter(Enrollment.student_id == student.id).one()
    assert enrollment.class_id == s["class"] and enrollment.academic_year_id == s["year"]
    assert student.is_first_login and [p.username for p in student.parents] == ["kofi.dahn"]

    # A sibling links the same guardian, found by search
    found = client.get("/api/v1/people/guardians/search?q=0770", headers=h).json()
    assert [g["children"] for g in found] == [["Esi Dahn"]]
    sibling = client.post("/api/v1/people/admissions", headers=h, json={
        "student": {"first_name": "Ama", "last_name": "Dahn"}, "guardian": {"existing_id": found[0]["id"]},
        "class_id": str(s["class"]),
    }).json()
    assert sibling["guardian"]["created"] is False and [c["who"] for c in sibling["credentials"]] == ["student"]


def test_failed_admission_saves_nothing(env):
    client, ids = env
    s = _seed(ids)
    h = headers(ids, "admin_a")
    resp = client.post("/api/v1/people/admissions", headers=h, json={
        "student": {"first_name": "Esi", "last_name": "Dahn"},
        "guardian": {"existing_id": "00000000-0000-0000-0000-000000000000"},  # no such guardian
        "class_id": str(s["class"]),
    })
    assert resp.status_code == 404
    gen, db = _db()
    assert db.query(Student).filter(Student.first_name == "Esi").count() == 0


def test_admission_is_scoped_to_the_school(env):
    client, ids = env
    s = _seed(ids)
    resp = client.post("/api/v1/people/admissions", headers=headers(ids, "admin_b"), json={
        "student": {"first_name": "X", "last_name": "Y"}, "class_id": str(s["class"]),
    })
    assert resp.status_code in (400, 404)  # school B has no current year / can't see A's class


def test_import_checks_rows_then_saves_all_or_nothing(env):
    client, ids = env
    _seed(ids)
    h = headers(ids, "admin_a")
    rows = [
        {"first_name": "Esi", "last_name": "Dahn", "class_name": "grade 1 - a", "guardian_first_name": "Kofi",
         "guardian_last_name": "Dahn", "guardian_phone": "0770000001"},
        {"first_name": "Ama", "last_name": "Dahn", "class_name": "Grade 1 - A", "guardian_first_name": "Kofi",
         "guardian_last_name": "Dahn", "guardian_phone": "0770000001"},
        {"first_name": "", "last_name": "Kollie", "class_name": "Grade 9 - Z", "date_of_birth": "02/03/2018"},
    ]
    checked = client.post("/api/v1/people/admissions/import", headers=h, json={"dry_run": True, "rows": rows}).json()
    assert checked["valid"] is False and [r["ok"] for r in checked["rows"]] == [True, True, False]
    assert checked["rows"][2]["row"] == 4 and len(checked["rows"][2]["errors"]) == 3

    refused = client.post("/api/v1/people/admissions/import", headers=h, json={"dry_run": False, "rows": rows}).json()
    assert refused["created"] == 0
    gen, db = _db()
    assert db.query(Student).filter(Student.last_name == "Dahn").count() == 0

    done = client.post("/api/v1/people/admissions/import", headers=h, json={"dry_run": False, "rows": rows[:2]}).json()
    assert done["created"] == 2
    gen, db = _db()
    assert db.query(Parent).filter(Parent.last_name == "Dahn").count() == 1  # one guardian for both children
    assert {c["who"] for c in done["credentials"]} == {"student", "guardian"} and len(done["credentials"]) == 3
