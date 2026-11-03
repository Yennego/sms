"""School-year setup wizard API (docs/remodel/phase3-api.md §1)."""
from datetime import date

import main
from src.db.models.academics.academic_grade import AcademicGrade
from src.db.models.academics.academic_year import AcademicYear
from src.db.models.academics.section import Section
from src.db.models.academics.subject import Subject
from src.db.models.people.teacher import Teacher
from src.db.session import get_db

from test_security import env, headers  # noqa: F401  shared app + two-school fixture


def _year(tenant_id, name, start_date, end_date, **extra):
    """A school year; the old semester date columns are still required by the model."""
    middle = start_date + (end_date - start_date) / 2
    return AcademicYear(tenant_id=tenant_id, name=name, start_date=start_date, end_date=end_date,
                        semester_1_start=start_date, semester_1_end=middle,
                        semester_2_start=middle, semester_2_end=end_date, **extra)


def _seed(ids):
    """School A: last year and this year, Grade 1 (A, B), Grade 2 (A), a teacher, two subjects."""
    gen = main.app.dependency_overrides[get_db]()
    db = next(gen)
    a = ids["tenant_a"]
    last = _year(a, "2025/2026", start_date=date(2025, 9, 1), end_date=date(2026, 6, 30))
    this = _year(a, "2026/2027", start_date=date(2026, 9, 1), end_date=date(2027, 6, 30), is_current=True)
    g1 = AcademicGrade(tenant_id=a, name="Grade 1", sequence=1, is_active=True)
    g2 = AcademicGrade(tenant_id=a, name="Grade 2", sequence=2, is_active=True)
    db.add_all([last, this, g1, g2])
    db.flush()
    db.add_all([Section(tenant_id=a, name=n, grade_id=g.id, capacity=30, is_active=True)
                for g, n in ((g1, "A"), (g1, "B"), (g2, "A"))])
    teacher = Teacher(tenant_id=a, email=None, password_hash="x", first_name="Ama", last_name="Kollie", employee_id="T1")
    maths = Subject(tenant_id=a, name="Mathematics", code="MATH", is_active=True)
    english = Subject(tenant_id=a, name="English", code="ENG", is_active=True)
    db.add_all([teacher, maths, english])
    db.flush()
    out = {"last": last.id, "this": this.id, "g1": g1.id, "teacher": teacher.id, "maths": maths.id, "english": english.id}
    next(gen, None)  # commit
    return out


def test_wizard_builds_a_year_step_by_step(env):
    client, ids = env
    s = _seed(ids)
    h = headers(ids, "admin_a")
    base = f"/api/v1/academics/year-setup/{s['last']}"

    steps = client.get(base, headers=h).json()["steps"]
    assert not steps["terms"]["complete"] and len(steps["classes"]["missing"]) == 3

    terms = client.post(f"{base}/terms/default", headers=h).json()
    assert [len(x["periods"]) for x in terms["semesters"]] == [3, 3] and terms["complete"]
    assert client.post(f"{base}/terms/default", headers=h).status_code == 409

    classes = client.post(f"{base}/classes/generate", json={"capacity": 40}, headers=h).json()
    assert {c["name"] for c in classes["classes"]} == {"Grade 1 - A", "Grade 1 - B", "Grade 2 - A"}
    assert {c["capacity"] for c in classes["classes"]} == {40}
    assert not classes["missing"] and not classes["complete"]  # no sponsors yet

    class_id = classes["classes"][0]["id"]
    row = client.put(f"/api/v1/academics/year-setup/classes/{class_id}/sponsor",
                     json={"teacher_id": str(s["teacher"])}, headers=h).json()
    assert row["sponsor_name"] == "Ama Kollie"

    subjects = client.post(f"{base}/subjects", headers=h, json={
        "grade_id": str(s["g1"]), "subject_ids": [str(s["maths"]), str(s["english"])],
        "teachers": {str(s["maths"]): str(s["teacher"])},
    }).json()
    grade1 = [c for c in subjects["classes"] if c["class_name"].startswith("Grade 1")]
    assert all(len(c["subjects"]) == 2 for c in grade1)
    assert subjects["unassigned_teachers"] == 2  # English in both Grade 1 classes

    # Next year: copy everything from last year
    counts = client.post(f"/api/v1/academics/year-setup/{s['this']}/copy-from/{s['last']}", json={}, headers=h).json()
    assert counts == {"semesters": 2, "periods": 6, "classes": 3, "sponsors": 1, "class_subjects": 4}
    this = client.get(f"/api/v1/academics/year-setup/{s['this']}", headers=h).json()
    assert this["previous_year"]["name"] == "2025/2026"
    assert this["steps"]["terms"]["semesters"][0]["start_date"] == "2026-09-01"
    # Copying again creates nothing new
    again = client.post(f"/api/v1/academics/year-setup/{s['this']}/copy-from/{s['last']}", json={}, headers=h).json()
    assert again == {"semesters": 0, "periods": 0, "classes": 0, "sponsors": 0, "class_subjects": 0}


def test_wizard_is_scoped_to_the_school_and_needs_permission(env):
    client, ids = env
    s = _seed(ids)
    other_school = headers(ids, "admin_b")
    assert client.get(f"/api/v1/academics/year-setup/{s['this']}", headers=other_school).status_code == 404
    assert client.get(f"/api/v1/academics/year-setup/{s['this']}", headers=headers(ids, "student_a")).status_code == 403
