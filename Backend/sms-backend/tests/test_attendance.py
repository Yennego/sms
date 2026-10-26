"""Regression tests for the attendance fixes (implementation_guide.md, section 6.2)."""
from datetime import timedelta
from uuid import uuid4

import pytest
from fastapi import HTTPException

from attendance_fixtures import TODAY, db, run, school  # noqa: F401  (fixtures)
from src.db.models.academics.attendance import (
    Attendance, AttendanceStatus, calculate_attendance_rate
)
from src.schemas.academics.attendance import BulkAttendanceCreate
from src.services.academics.attendance_service import SuperAdminAttendanceService
from src.core.exceptions.business import BusinessRuleViolationError, PermissionDeniedError
from src.api.v1.endpoints.academics import attendance_api


def _bulk(school, statuses, period="Daily", day=TODAY, by=None):
    return BulkAttendanceCreate(
        class_id=school["cls"].id, academic_year_id=school["ay"].id, date=day, period=period,
        marked_by=(by or school["sponsor"]).id,
        attendances=[{"student_id": str(s.id), "status": st} for s, st in statuses],
    )


# --- S3: one definition of "present" -------------------------------------------------

def test_rate_excludes_excused_and_counts_tardy():
    counts = {AttendanceStatus.PRESENT: 2, AttendanceStatus.TARDY: 1,
              AttendanceStatus.ABSENT: 1, AttendanceStatus.EXCUSED: 4}
    assert calculate_attendance_rate(counts) == 75.0           # 3 present / (8 - 4 excused)
    assert calculate_attendance_rate({"excused": 2}) == 0.0      # no countable days


# --- Bulk marking (F1 payload, S4, S6) ----------------------------------------------

def test_sponsor_bulk_mark_saves_and_accepts_uppercase(school):
    s0, s1 = school["students"][:2]
    results = run(school["service"].bulk_mark_attendance(_bulk(school, [(s0, "PRESENT"), (s1, "absent")])))
    assert {r.status for r in results} == {AttendanceStatus.PRESENT, AttendanceStatus.ABSENT}

    # Re-saving updates in place instead of duplicating
    run(school["service"].bulk_mark_attendance(_bulk(school, [(s0, "late")])))
    rows = school["service"].get_multi(class_id=school["cls"].id, start_date=TODAY, end_date=TODAY)
    assert len(rows) == 2
    assert {r.student_id: r.status for r in rows}[s0.id] == AttendanceStatus.LATE


def test_bulk_is_all_or_nothing_when_a_student_is_not_enrolled(school):
    s0, _, outsider = school["students"]
    with pytest.raises(BusinessRuleViolationError, match="not actively enrolled"):
        run(school["service"].bulk_mark_attendance(_bulk(school, [(s0, "present"), (outsider, "present")])))
    assert school["service"].get_multi(class_id=school["cls"].id) == []


def test_bulk_requires_schedule_or_period(school):
    with pytest.raises(BusinessRuleViolationError, match="schedule_id or period"):
        run(school["service"].bulk_mark_attendance(_bulk(school, [(school["students"][0], "present")], period=None)))


def test_bulk_rejects_invalid_status(school):
    with pytest.raises(BusinessRuleViolationError, match="Invalid attendance status"):
        run(school["service"].bulk_mark_attendance(_bulk(school, [(school["students"][0], "here")])))


# --- S2: periods no longer overwrite each other -------------------------------------

def test_two_periods_same_day_are_kept_separately(school):
    s0 = school["students"][0]
    run(school["service"].bulk_mark_attendance(_bulk(school, [(s0, "present")], period="1")))
    run(school["service"].bulk_mark_attendance(_bulk(school, [(s0, "absent")], period="2")))
    rows = school["service"].get_multi(student_id=s0.id)
    assert sorted((r.period, r.status.value) for r in rows) == [("1", "present"), ("2", "absent")]


# --- S5: sponsor / admin permission --------------------------------------------------

def test_non_sponsor_teacher_cannot_mark(school):
    with pytest.raises(PermissionDeniedError):
        run(school["service"].bulk_mark_attendance(
            _bulk(school, [(school["students"][0], "present")], by=school["other_teacher"])))


def test_unknown_user_is_denied_not_allowed(school):
    bulk = _bulk(school, [(school["students"][0], "present")])
    bulk.marked_by = uuid4()
    with pytest.raises(PermissionDeniedError):
        run(school["service"].bulk_mark_attendance(bulk))


def test_admin_can_mark_any_class(school):
    results = run(school["service"].bulk_mark_attendance(
        _bulk(school, [(school["students"][0], "present")], by=school["admin"])))
    assert len(results) == 1


# --- S1: notes survive a status update ----------------------------------------------

def test_status_update_keeps_comment_in_notes(school):
    s0 = school["students"][0]
    rec = run(school["service"].bulk_mark_attendance(_bulk(school, [(s0, "absent")])))[0]
    updated = run(school["service"].update_attendance_status(
        rec.id, AttendanceStatus.EXCUSED, school["sponsor"].id, comments="Doctor's note"))
    assert updated.status == AttendanceStatus.EXCUSED
    assert updated.notes == "Doctor's note"


def test_other_teacher_cannot_update_status(school):
    rec = run(school["service"].bulk_mark_attendance(_bulk(school, [(school["students"][0], "absent")])))[0]
    with pytest.raises(PermissionDeniedError):
        run(school["service"].update_attendance_status(
            rec.id, AttendanceStatus.PRESENT, school["other_teacher"].id))


# --- B7: who may read whose attendance ----------------------------------------------

def test_student_only_sees_own_attendance(school):
    me, other = school["students"][:2]
    svc = school["service"]
    assert svc.resolve_viewable_student_id(me, None) == me.id
    with pytest.raises(PermissionDeniedError):
        svc.resolve_viewable_student_id(me, other.id)


def test_parent_only_sees_linked_child(school):
    child, not_child = school["students"][:2]
    svc = school["service"]
    assert svc.resolve_viewable_student_id(school["parent"], None) == child.id
    with pytest.raises(PermissionDeniedError):
        svc.resolve_viewable_student_id(school["parent"], not_child.id)


def test_teacher_filter_passes_through(school):
    assert school["service"].resolve_viewable_student_id(school["sponsor"], None) is None


# --- Attendance -> grade sync (schema GradeType was missing ATTENDANCE) -------------

def test_attendance_assessment_creates_grades(school, db, monkeypatch):
    from types import SimpleNamespace
    import src.db.crud.base.base as crud_base

    # TenantCRUDBase.create stringifies UUIDs via jsonable_encoder; PostgreSQL accepts
    # that, SQLite's UUID type doesn't. Keep native types for this test only.
    monkeypatch.setattr(crud_base, "jsonable_encoder", lambda obj: obj.model_dump())
    from src.db.models.academics.subject import Subject
    from src.db.models.academics.grade import Grade, GradeType

    s0, s1 = school["students"][:2]
    run(school["service"].bulk_mark_attendance(_bulk(school, [(s0, "present"), (s1, "absent")])))

    subject = Subject(tenant_id=school["tenant_id"], name="Math", code="MTH")
    db.add(subject)
    db.commit()
    cls = school["cls"]
    assessment = SimpleNamespace(
        id=uuid4(), academic_year_id=school["ay"].id, section_id=cls.section_id, grade_id=cls.grade_id,
        subject_id=subject.id, max_score=10, title="Attendance", assessment_date=TODAY,
        grading_category_id=None,
    )
    count = run(school["service"].sync_assessment_attendance(assessment, school["sponsor"].id))
    assert count == 2
    scores = {g.student_id: g.score for g in db.query(Grade).filter(Grade.assessment_type == GradeType.ATTENDANCE)}
    assert scores == {s0.id: 10.0, s1.id: 0.0}


# --- B1–B4: endpoints that used to crash --------------------------------------------

def test_report_absent_late_endpoints_run(school):
    s0, s1 = school["students"][:2]
    svc = school["service"]
    run(svc.bulk_mark_attendance(_bulk(school, [(s0, "absent"), (s1, "late")])))
    user = school["sponsor"]

    report = run(attendance_api.generate_attendance_report(
        attendance_service=svc, class_id=school["cls"].id, student_id=None,
        start_date=TODAY - timedelta(days=1), end_date=TODAY, report_type="summary", current_user=user))
    assert report.summary.absent_count == 1

    absent = run(attendance_api.get_absent_students(
        attendance_service=svc, class_id=school["cls"].id, attendance_date=TODAY, current_user=user))
    late = run(attendance_api.get_late_students(
        attendance_service=svc, class_id=school["cls"].id, attendance_date=TODAY, current_user=user))
    assert [a.student_id for a in absent] == [s0.id]
    assert [a.student_id for a in late] == [s1.id]


def test_global_stats_endpoint_runs(school, db):
    run(school["service"].bulk_mark_attendance(_bulk(school, [(school["students"][0], "present")])))
    stats = run(attendance_api.get_global_attendance_stats(
        super_admin_service=SuperAdminAttendanceService(db=db),
        start_date=None, end_date=None, current_user=None))
    assert stats["total_records"] == 1
    assert stats["global_attendance_rate"] == 100.0


def test_status_patch_missing_record_returns_404(school):
    with pytest.raises(HTTPException) as exc:
        run(attendance_api.update_attendance_status(
            attendance_service=school["service"], attendance_id=uuid4(),
            attendance_status=AttendanceStatus.PRESENT, check_in_time=None, check_out_time=None,
            comments=None, current_user=school["sponsor"]))
    assert exc.value.status_code == 404
