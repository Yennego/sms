"""End of a school year, end to end: create the next year, promote, graduate, make it current.

The order the app supports (docs/guides/user-guide.md §5.5): create the next year without making
it current and copy last year into it; promote each grade level into it; graduate the final grade
level; then make the new year current. Old enrollments, report cards and fee accounts stay as
history; the new year starts with fresh fee accounts and receipt numbers.
"""
from datetime import date
from uuid import UUID

from src.db.models.academics.assessment import Assessment
from src.db.models.academics.class_model import Class
from src.db.models.academics.class_subject import ClassSubject
from src.db.models.academics.enrollment import Enrollment
from src.db.models.academics.gradebook import ResultPublication, ScoreEntry
from src.db.models.academics.period import Period
from src.db.models.academics.remedial_session import RemedialSession
from src.db.models.academics.section import Section
from src.db.models.academics.semester import Semester
from src.db.models.academics.subject import Subject
from src.db.models.people.student import Student
from src.services.academics.daily_attendance_service import DailyAttendanceService

from test_finance import F, _db, _pay, _seed as _seed_school, _setup, _statement, clock  # noqa: F401
from test_security import env, headers  # noqa: F401  shared app + two-school fixture

A = "/api/v1/academics"


def _publish_exam(ids, s, scores):
    """A published semester 1 exam in Mathematics for each class; scores: pupil index -> mark."""
    gen, db = _db()
    a, sem1 = ids["tenant_a"], UUID(s["sem1"])
    maths = Subject(tenant_id=a, name="Mathematics", code="MATH", is_active=True)
    db.add(maths)
    db.flush()
    enrollments = {str(e.student_id): e for e in db.query(Enrollment).filter(Enrollment.tenant_id == a)}
    for class_id in (UUID(s["c1"]), UUID(s["c2"])):
        cs = ClassSubject(tenant_id=a, class_id=class_id, subject_id=maths.id)
        db.add(cs)
        db.flush()
        exam = Assessment(tenant_id=a, title="Semester 1 exam", class_subject_id=cs.id, subject_id=maths.id,
                          kind="exam", semester_id=sem1, assessment_date=date(2027, 1, 20), max_score=100)
        db.add(exam)
        db.flush()
        for i, mark in scores.items():
            e = enrollments[s["pupils"][i]]
            if e.class_id == class_id:
                db.add(ScoreEntry(tenant_id=a, assessment_id=exam.id, student_id=e.student_id,
                                  enrollment_id=e.id, score=mark, status="scored"))
        db.add(ResultPublication(tenant_id=a, class_id=class_id, semester_id=sem1))
    next(gen, None)


def test_end_of_year_promote_graduate_and_start_the_new_year(env, clock, monkeypatch):
    client, ids = env
    s = _seed_school(ids)  # 2026/2027 (current): Grade 1 pupils 0-2, Grade 2 (final) pupil 3
    h = headers(ids, "admin_a")
    old = s["year"]
    pupil = s["pupils"]

    # Last year's fees: pupil 0 pays in USD, receipt 2026-00001
    _setup(client, ids, s)
    assert _pay(client, ids, s, pupil=0, currency="USD").json()["receipt_number"] == "2026-00001"
    # Results: pupil 0 passes, pupil 1 fails, pupil 2 has no marks, pupil 3 (final grade) passes
    _publish_exam(ids, s, {0: 90, 1: 40, 3: 85})

    # 1. Create the next year, not current, and copy last year's classes into it
    r = client.post(f"{A}/academic-years", headers=h, json={
        "name": "2027/2028", "start_date": "2027-09-01", "end_date": "2028-07-15", "is_current": False})
    assert r.status_code == 200, r.text
    new = r.json()["id"]
    setup = client.get(f"{A}/year-setup/{new}", headers=h).json()
    assert setup["previous_year"]["id"] == old and not setup["year"]["is_current"]
    periods = [p for sem in setup["steps"]["terms"]["semesters"] for p in sem["periods"]]
    assert len(periods) == 6
    assert all(a["end_date"] < b["start_date"] for a, b in zip(periods, periods[1:]))  # no shared days
    copied = client.post(f"{A}/year-setup/{new}/copy-from/{old}", headers=h, json={}).json()
    assert copied["classes"] == 2 and copied["class_subjects"] == 2
    new_classes = {c["grade_id"]: c["id"] for c in
                   client.get(f"{A}/year-setup/{new}", headers=h).json()["steps"]["classes"]["classes"]}

    # 2. Promotion, one grade level at a time. "Not graded" is shown, never judged
    evaluation = client.post(f"{A}/promotions/evaluate", headers=h,
                             json={"academic_year_id": old, "grade_id": s["g1"]})
    assert evaluation.status_code == 200, evaluation.text
    assert {e["student_id"]: e["status"] for e in evaluation.json()} == {
        pupil[0]: "Eligible", pupil[1]: "Conditional", pupil[2]: "Not graded"}
    # Never into a year that started earlier
    back = client.post(f"{A}/promotions/transition", headers=h,
                       params={"current_year_id": new, "target_year_name": "2026/2027"})
    assert back.status_code == 400
    grade1 = {"current_year_id": old, "target_year_name": "2027/2028", "grade_id": s["g1"]}
    result = client.post(f"{A}/promotions/transition", headers=h, params=grade1).json()
    assert [p["student_id"] for p in result["promoted"]] == [pupil[0]]
    assert result["promoted"][0]["class_id"] == new_classes[s["g2"]]  # last year's class, copied
    # Conditional: the rules keep them in Grade 1, so remedial sessions and next year's Grade 1 class
    assert [(x["student_id"], x["class_id"]) for x in result["remedial"]] == [(pupil[1], new_classes[s["g1"]])]
    assert [x["student_id"] for x in result["skipped"]] == [pupil[2]]
    assert result["errors"] == [] and result["graduating"] == []
    # Running it again changes nothing and books no second remedial session
    again = client.post(f"{A}/promotions/transition", headers=h, params=grade1).json()
    assert again["promoted"] == [] and again["remedial"] == [] and again["errors"] == []
    gen, db = _db()
    assert db.query(RemedialSession).filter(RemedialSession.student_id == ids["pupil1"]).count() == 1
    next(gen, None)
    # The final grade level isn't promoted: it is left for Graduation
    final = client.post(f"{A}/promotions/transition", headers=h, params={
        "current_year_id": old, "target_year_name": "2027/2028", "grade_id": s["g2"]}).json()
    assert [x["student_id"] for x in final["graduating"]] == [pupil[3]] and final["promoted"] == []

    # 3. Graduate the final grade level (last year, still current)
    candidates = client.get(f"{A}/enrollments/graduation-candidates", headers=h,
                            params={"academic_year_id": old}).json()["candidates"]
    assert [(c["student_id"], c["promotion_status"]) for c in candidates] == [(pupil[3], "Eligible")]
    graduated = client.post(f"{A}/enrollments/graduate", headers=h,
                            json={"academic_year_id": old, "student_ids": [pupil[3]]}).json()
    assert graduated == {"graduated": 1, "skipped": 0}

    # 4. Make the new year current, as the Years page's Activate does
    r = client.put(f"{A}/academic-years/{new}", headers=h, json={"is_current": True})
    assert r.status_code == 200, r.text
    assert client.get(f"{A}/academic-years/current", headers=h).json()["id"] == new
    r = client.put(f"{A}/academic-years/{old}/set-current", headers=h)
    assert r.status_code == 200 and r.json()["is_current"]
    assert client.put(f"{A}/academic-years/{new}/set-current", headers=h).status_code == 200

    # Students are in their new classes; last year's enrollments stay as history
    gen, db = _db()
    rows = {(str(e.student_id), str(e.academic_year_id)): e for e in db.query(Enrollment)}
    assert str(rows[(pupil[0], new)].class_id) == new_classes[s["g2"]] and rows[(pupil[0], new)].is_active
    assert (rows[(pupil[0], old)].status, rows[(pupil[0], old)].is_active) == ("completed", False)
    assert str(rows[(pupil[1], new)].class_id) == new_classes[s["g1"]]  # repeats Grade 1
    assert (rows[(pupil[1], old)].status, rows[(pupil[1], old)].is_active) == ("completed", False)
    assert (pupil[2], new) not in rows and rows[(pupil[2], old)].status == "active"  # not graded: skipped
    assert rows[(pupil[3], old)].status == "graduated"
    assert db.query(Student).filter(Student.id == ids["pupil3"]).one().status == "graduated"
    next(gen, None)

    roster = client.get(f"{A}/class-placement/roster", headers=h,
                        params={"academic_year_id": old, "placement": "placed"}).json()
    assert {i["student_id"] for i in roster["items"]} == {pupil[0], pupil[1], pupil[2]}  # pupil 3 graduated

    # Last year's report cards are still there
    for i, class_name in ((0, "Grade 1 - A"), (3, "Grade 2 - A")):
        card = client.get(f"{A}/gradebook/report-cards/students/{pupil[i]}", headers=h,
                          params={"academic_year_id": old})
        assert card.status_code == 200, card.text
        assert card.json()["class"]["name"] == class_name
    cards = client.get(f"{A}/gradebook/report-cards/classes/{s['c1']}", headers=h).json()["items"]
    assert len(cards) == 3

    # Attendance works in the new year
    monkeypatch.setattr(DailyAttendanceService, "school_today", lambda self: date(2027, 9, 6))  # a Monday
    r = client.post(f"{A}/attendance/daily/bulk", headers=h, json={
        "class_id": new_classes[s["g2"]], "date": "2027-09-06",
        "entries": [{"student_id": pupil[0], "status": "present"}]})
    assert r.status_code == 200, r.text
    assert r.json()[0]["academic_year_id"] == new

    # Fees start fresh: a new account with no currency yet, receipts restart for the new year
    clock(2027, 9, 10, 9, 0)
    gen, db = _db()
    sem1 = db.query(Semester).filter(Semester.academic_year_id == UUID(new), Semester.semester_number == 1).one()
    assert db.query(Period).filter(Period.semester_id == sem1.id).count() == 3
    sem1_id = str(sem1.id)
    next(gen, None)
    tuition = client.get(f"{F}/categories", headers=h).json()[0]["id"]
    assert client.post(f"{F}/schedules", headers=h, json={
        "academic_year_id": new, "semester_id": sem1_id, "category_id": tuition,
        "amount_usd": "120", "amount_lrd": "21000"}).status_code == 200
    issued = client.post(f"{F}/invoices/issue", headers=h, json={"academic_year_id": new, "semester_id": sem1_id})
    assert issued.json()["students"] == 2  # pupils 0 (promoted) and 1 (repeating) so far
    assert _statement(client, ids, s, pupil=0)["account"]["currency"] is None
    paid = client.post(f"{F}/payments", headers=h, json={
        "student_id": pupil[0], "academic_year_id": new, "amount": "1000", "currency": "LRD", "method": "cash"})
    assert paid.status_code == 200, paid.text
    assert paid.json()["receipt_number"] == "2027-00001"
    old_statement = client.get(f"{F}/accounts/{pupil[0]}", headers=h, params={"academic_year_id": old}).json()
    assert old_statement["account"]["currency"] == "USD"


def test_repeater_goes_to_the_class_with_most_free_places_when_their_section_has_none(env):
    client, ids = env
    s = _seed_school(ids)
    h = headers(ids, "admin_a")
    _publish_exam(ids, s, {1: 40})  # pupil 1 fails Grade 1 (section A)
    new = client.post(f"{A}/academic-years", headers=h, json={
        "name": "2027/2028", "start_date": "2027-09-01", "end_date": "2028-07-15"}).json()["id"]
    gen, db = _db()
    a, g1 = ids["tenant_a"], UUID(s["g1"])
    b, c = (Section(tenant_id=a, name=n, grade_id=g1, capacity=30, is_active=True) for n in "BC")
    db.add_all([b, c])
    db.flush()
    small = Class(tenant_id=a, name="Grade 1 - B", academic_year_id=UUID(new), grade_id=g1, section_id=b.id,
                  capacity=1, is_active=True)
    roomy = Class(tenant_id=a, name="Grade 1 - C", academic_year_id=UUID(new), grade_id=g1, section_id=c.id,
                  capacity=30, is_active=True)
    db.add_all([small, roomy])
    db.flush()
    roomy_id = str(roomy.id)
    next(gen, None)
    result = client.post(f"{A}/promotions/transition", headers=h, params={
        "current_year_id": s["year"], "target_year_name": "2027/2028", "grade_id": s["g1"]}).json()
    assert [(x["student_id"], x["class_id"]) for x in result["remedial"]] == [(s["pupils"][1], roomy_id)]


def test_transition_needs_this_schools_years(env):
    client, ids = env
    s = _seed_school(ids)
    r = client.post(f"{A}/promotions/transition", headers=headers(ids, "admin_b"),
                    params={"current_year_id": s["year"], "target_year_name": "2026/2027"})
    assert r.status_code in (400, 403)  # another school's year is never found


def _year_with_repeater(client, ids, s, h):
    """Last year's results with pupil 1 Conditional (failed one subject), the new year copied from
    last year, and Grade 1 moved on: pupil 1 is placed again in next year's Grade 1 class."""
    _publish_exam(ids, s, {0: 90, 1: 40, 3: 85})
    new = client.post(f"{A}/academic-years", headers=h, json={
        "name": "2027/2028", "start_date": "2027-09-01", "end_date": "2028-07-15", "is_current": False}).json()["id"]
    client.post(f"{A}/year-setup/{new}/copy-from/{s['year']}", headers=h, json={})
    classes = {c["grade_id"]: c["id"] for c in
               client.get(f"{A}/year-setup/{new}", headers=h).json()["steps"]["classes"]["classes"]}
    return new, classes


def test_conditional_student_moves_up_after_passing_remedial_work(env, clock):
    """Passing remedial work in every failed subject moves a Conditional student up to the next
    grade's class in the new year, and their unpaid bill takes the new grade's fees."""
    client, ids = env
    s = _seed_school(ids)
    h = headers(ids, "admin_a")
    pupil = s["pupils"]
    new, classes = _year_with_repeater(client, ids, s, h)
    client.post(f"{A}/promotions/transition", headers=h,
                params={"current_year_id": s["year"], "target_year_name": "2027/2028", "grade_id": s["g1"]})

    # New-year fees: tuition for everyone, plus a fee for each of Grade 1 and Grade 2
    clock(2027, 9, 10, 9, 0)
    gen, db = _db()
    sem1 = str(db.query(Semester).filter(Semester.academic_year_id == UUID(new), Semester.semester_number == 1).one().id)
    next(gen, None)
    cats = {c: client.post(f"{F}/categories", headers=h, json={"name": c}).json()["id"] for c in ("Tuition", "G1 books", "G2 lab")}
    for cat, grade, usd in (("Tuition", None, "100"), ("G1 books", s["g1"], "10"), ("G2 lab", s["g2"], "30")):
        body = {"academic_year_id": new, "semester_id": sem1, "category_id": cats[cat], "amount_usd": usd}
        if grade:
            body["grade_id"] = grade
        assert client.post(f"{F}/schedules", headers=h, json=body).status_code == 200
    client.post(f"{F}/invoices/issue", headers=h, json={"academic_year_id": new, "semester_id": sem1})
    owed = lambda: client.get(f"{F}/accounts/{pupil[1]}", headers=h, params={"academic_year_id": new}).json()["owed"]
    assert owed() == {"USD": "110.00"}  # tuition + Grade 1 books

    # Passing the remedial session moves them up and re-prices the unpaid bill
    gen, db = _db()
    session_id = str(db.query(RemedialSession).filter(RemedialSession.student_id == ids["pupil1"]).one().id)
    next(gen, None)
    r = client.put(f"{A}/remedial/sessions/{session_id}", headers=h,
                   json={"status": "completed", "new_score": 75, "passed": True})
    assert r.status_code == 200, r.text
    moved = r.json()["moved_up"]
    assert moved["type"] == "moved_up" and moved["class_id"] == classes[s["g2"]] and moved["fees_need_review"] is False
    gen, db = _db()
    now = db.query(Enrollment).filter(Enrollment.student_id == ids["pupil1"], Enrollment.academic_year_id == UUID(new)).one()
    assert str(now.class_id) == classes[s["g2"]] and str(now.grade_id) == s["g2"]
    next(gen, None)
    assert owed() == {"USD": "130.00"}  # tuition + Grade 2 lab
    # Recording it again moves nothing more
    again = client.put(f"{A}/remedial/sessions/{session_id}", headers=h, json={"passed": True}).json()
    assert again["moved_up"] is None
    # The school-wide list and a student's list both carry the names (no "Unknown")
    listed = client.get(f"{A}/remedial/sessions", headers=h).json()
    row = next(x for x in listed if x["id"] == session_id)
    assert row["student_name"] and row["student_name"] != "Unknown" and row["subject_name"]
    mine = client.get(f"{A}/remedial/sessions", headers=h, params={"enrollment_id": row["enrollment_id"]}).json()
    assert mine and all(x["student_name"] and x["subject_name"] for x in mine)


def test_conditional_student_who_passed_remedial_work_is_promoted_at_year_end(env, clock):
    """Remedial work passed before the transition: promoted, not placed back in the same grade."""
    client, ids = env
    s = _seed_school(ids)
    h = headers(ids, "admin_a")
    new, classes = _year_with_repeater(client, ids, s, h)
    # The first evaluation books the remedial session (as the transition would); mark it passed
    gen, db = _db()
    from src.db.models.academics.subject import Subject as SubjectModel
    maths = db.query(SubjectModel).filter(SubjectModel.code == "MATH").one()
    e1 = db.query(Enrollment).filter(Enrollment.student_id == ids["pupil1"]).one()
    db.add(RemedialSession(tenant_id=ids["tenant_a"], student_id=ids["pupil1"], enrollment_id=e1.id,
                           subject_id=maths.id, academic_year_id=UUID(s["year"]), scheduled_date=date(2027, 6, 1),
                           status="completed", new_score=72, passed=True))
    next(gen, None)
    result = client.post(f"{A}/promotions/transition", headers=h, params={
        "current_year_id": s["year"], "target_year_name": "2027/2028", "grade_id": s["g1"]}).json()
    promoted = {p["student_id"]: p["class_id"] for p in result["promoted"]}
    assert promoted[s["pupils"][1]] == classes[s["g2"]] and result["remedial"] == []
