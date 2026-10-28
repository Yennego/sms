"""Tests for Phase 4: overview, class reports, and everything reading school-day attendance."""
import asyncio
from datetime import UTC, date, datetime, timedelta

import pytest

from attendance_fixtures import TODAY, db, school  # noqa: F401  (fixtures)
from src.core.config import settings
from src.core.exceptions.business import BusinessRuleViolationError, PermissionDeniedError
from src.schemas.academics.daily_attendance import DailyBulkSet, DailyStatusSet, ParentExcuseCreate
from src.services.academics import qr_card_service
from src.services.academics.attendance_access import has_daily_attendance_history
from src.services.academics.attendance_excuse_service import AttendanceExcuseService
from src.services.academics.attendance_report_service import AttendanceReportService
from src.services.academics.attendance_scan_service import AttendanceScanService

MONDAY = TODAY - timedelta(days=1)


def at(school, db, cls=AttendanceReportService, hour=9, on=TODAY):
    svc = cls(tenant=school["tenant_id"], db=db)
    svc.now_utc = lambda: datetime(on.year, on.month, on.day, hour, 0, tzinfo=UTC)
    return svc


def mark(school, db, day, *entries):
    at(school, db, on=TODAY).bulk_set(DailyBulkSet(class_id=school["cls"].id, date=day, entries=[
        {"student_id": s.id, "status": st, **({"excuse_reason": "Clinic"} if st == "excused" else {})}
        for s, st in entries
    ]), school["sponsor"])


# --- Overview ------------------------------------------------------------------------------

def test_overview_before_and_after_cutoff(school, db, monkeypatch):
    monkeypatch.setattr(settings, "ATTENDANCE_QR_SECRET", "s")
    s0, s1 = school["students"][:2]
    scanner = at(school, db, cls=AttendanceScanService, hour=7)
    scanner.scan(qr_card_service.build_token(school["tenant_id"], s0.id, 1), "check_in", None, school["admin"])

    morning = at(school, db, hour=9).overview(TODAY, school["admin"])
    assert (morning.totals.enrolled, morning.totals.present, morning.totals.scanned, morning.totals.unmarked) == (2, 1, 1, 1)
    assert not morning.day.auto_absent_applied
    [row] = morning.classes
    assert (row.class_name, row.sponsor_name, row.present, row.unmarked) == (
        "Grade 5 - A", f"{school['sponsor'].first_name} L", 1, 1)
    assert morning.totals.attendance_rate == 100.0

    afternoon = at(school, db, hour=13).overview(TODAY, school["admin"])
    assert (afternoon.totals.absent, afternoon.totals.unmarked, afternoon.totals.attendance_rate) == (1, 0, 50.0)


def test_overview_counts_pending_excuses_and_is_admin_only(school, db):
    excuses = at(school, db, cls=AttendanceExcuseService)
    excuses.submit_parent_excuse(ParentExcuseCreate(
        student_id=school["students"][0].id, date=TODAY, reason="Fever"), school["parent"])
    svc = at(school, db)
    assert svc.overview(TODAY, school["admin"]).pending_excuses == 1
    with pytest.raises(PermissionDeniedError):
        svc.overview(TODAY, school["sponsor"])
    with pytest.raises(BusinessRuleViolationError, match="future"):
        svc.overview(TODAY + timedelta(days=1), school["admin"])
    empty = svc.overview(date(2026, 8, 3), school["admin"])  # before the academic year
    assert (empty.classes, empty.totals.enrolled) == ([], 0)


# --- Class report --------------------------------------------------------------------------

def test_class_report(school, db):
    s0, s1 = school["students"][:2]
    mark(school, db, MONDAY, (s0, "present"), (s1, "excused"))
    mark(school, db, TODAY, (s0, "late"), (s1, "absent"))

    report = at(school, db, hour=9).class_report(school["cls"].id, MONDAY - timedelta(days=7), TODAY, school["sponsor"])
    assert report.school_days == 7  # Mon 12 – Tue 20, weekdays
    rows = {r.student_id: r for r in report.rows}
    assert (rows[s0.id].present, rows[s0.id].late, rows[s0.id].unmarked, rows[s0.id].attendance_rate) == (1, 1, 5, 100.0)
    assert (rows[s1.id].excused, rows[s1.id].absent, rows[s1.id].attendance_rate) == (1, 1, 0.0)
    assert (report.totals.present, report.totals.late, report.totals.absent, report.totals.excused) == (1, 1, 1, 1)

    with pytest.raises(PermissionDeniedError):
        at(school, db).class_report(school["cls"].id, None, None, school["other_teacher"])
    with pytest.raises(BusinessRuleViolationError, match="on or before"):
        at(school, db).class_report(school["cls"].id, TODAY, MONDAY, school["admin"])

    default = at(school, db).class_report(school["cls"].id, None, None, school["admin"])
    assert (default.start_date, default.end_date) == (school["ay"].start_date, TODAY)

    # A valid range that runs past today is clamped, not rejected
    clamped = at(school, db).class_report(school["cls"].id, MONDAY, TODAY + timedelta(days=30), school["admin"])
    assert (clamped.start_date, clamped.end_date) == (MONDAY, TODAY)
    with pytest.raises(BusinessRuleViolationError, match="future"):
        at(school, db).class_report(school["cls"].id, TODAY + timedelta(days=1), TODAY + timedelta(days=5), school["admin"])
    with pytest.raises(BusinessRuleViolationError, match="academic year runs"):
        at(school, db).class_report(school["cls"].id, school["ay"].start_date - timedelta(days=60),
                                    school["ay"].start_date - timedelta(days=30), school["admin"])


# --- Everything reads daily attendance -----------------------------------------------------

def test_attendance_percentage_uses_daily_records(school, db):
    s0 = school["students"][0]
    mark(school, db, MONDAY, (s0, "excused"))
    mark(school, db, TODAY, (s0, "late"))
    # A period mark saying absent no longer counts toward the rate
    from src.schemas.academics.attendance import BulkAttendanceCreate
    asyncio.run(school["service"].bulk_mark_attendance(BulkAttendanceCreate(
        class_id=school["cls"].id, academic_year_id=school["ay"].id, date=TODAY, period="1",
        marked_by=school["sponsor"].id, attendances=[{"student_id": str(s0.id), "status": "absent"}],
    )))
    rate = asyncio.run(school["service"].get_student_attendance_percentage(s0.id, MONDAY, TODAY))
    assert rate == 100.0  # excused Monday is left out; late Tuesday counts as attended


def test_student_dashboard_rate_uses_daily_records(school, db):
    from src.services.academics.dashboard_service import AcademicDashboardService

    s0 = school["students"][0]
    mark(school, db, MONDAY, (s0, "absent"))
    mark(school, db, TODAY, (s0, "late"))
    rate = asyncio.run(school["service"].get_student_attendance_percentage(s0.id))
    assert rate == 50.0  # late counts as attended; one absence out of two days

    svc = AcademicDashboardService(db, school["tenant_id"], current_user=s0)
    assert svc._get_student_dashboard_stats()["attendance_percentage"] == 50.0


def test_deletion_guard_sees_daily_history(school, db):
    s0, s1 = school["students"][:2]
    assert not has_daily_attendance_history(db, school["tenant_id"], student_id=s0.id)
    at(school, db).set_status(s0.id, TODAY, DailyStatusSet(status="present"), school["sponsor"])
    assert has_daily_attendance_history(db, school["tenant_id"], student_id=s0.id)
    assert has_daily_attendance_history(db, school["tenant_id"], user_id=school["sponsor"].id)
    assert not has_daily_attendance_history(db, school["tenant_id"], student_id=s1.id)
    assert not has_daily_attendance_history(db, school["tenant_id"], user_id=school["other_teacher"].id)
