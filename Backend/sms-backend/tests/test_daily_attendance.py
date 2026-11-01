"""Tests for school-day attendance (implementation_guide.md, section 6.3)."""
from datetime import UTC, date, datetime, time, timedelta

import pytest
from pydantic import ValidationError

from attendance_fixtures import TODAY, db, school  # noqa: F401  (fixtures)
from src.core.exceptions.business import (
    BusinessRuleViolationError, EntityNotFoundError, PermissionDeniedError
)
from src.db.models.academics.attendance import AttendanceStatus
from src.db.models.academics.daily_attendance import (
    AttendanceEvent, AttendanceSource, DailyAttendance, ExcuseStatus
)
from src.schemas.academics.daily_attendance import (
    AttendanceSettingsUpdate, DailyBulkSet, DailyStatusSet, ExcuseReview, ExcuseSet,
    SchoolCalendarDayUpsert
)
from src.services.academics.daily_attendance_service import DailyAttendanceService

SATURDAY = date(2026, 10, 24)


def service_at(school, db, hour=9, minute=0, on=TODAY):
    """Service whose clock reads `on` at hour:minute UTC (default timezone Africa/Monrovia = UTC)."""
    svc = DailyAttendanceService(tenant=school["tenant_id"], db=db)
    svc.now_utc = lambda: datetime(on.year, on.month, on.day, hour, minute, tzinfo=UTC)
    return svc


def bulk(school, *entries, day=TODAY):
    return DailyBulkSet(class_id=school["cls"].id, date=day, entries=[
        dict(student_id=s.id, status=st, **extra) for s, st, *rest in entries for extra in [rest[0] if rest else {}]
    ])


def events_for(db, record):
    return [e.event_type for e in db.query(AttendanceEvent)
            .filter(AttendanceEvent.daily_attendance_id == record.id)
            .order_by(AttendanceEvent.occurred_at, AttendanceEvent.created_at)]


# --- School calendar & settings ------------------------------------------------------

def test_weekday_weekend_holiday_and_makeup_day(school, db):
    svc = service_at(school, db, on=SATURDAY)
    assert svc.day_info(TODAY).is_school_day
    sat = svc.day_info(SATURDAY)
    assert not sat.is_school_day and sat.reason == "Not a school day of the week"

    svc.set_calendar_day(TODAY, SchoolCalendarDayUpsert(is_school_day=False, label="Founders Day"))
    svc.set_calendar_day(SATURDAY, SchoolCalendarDayUpsert(is_school_day=True))
    assert svc.day_info(TODAY).reason == "Founders Day"
    assert not svc.day_info(TODAY).is_school_day
    assert svc.day_info(SATURDAY).is_school_day

    svc.delete_calendar_day(TODAY)
    assert svc.day_info(TODAY).is_school_day
    assert not svc.day_info(date(2026, 8, 3)).is_school_day  # before the academic year


def test_school_today_uses_tenant_timezone(school, db):
    svc = service_at(school, db, hour=12)  # 12:00 UTC on Oct 20
    svc.update_settings(AttendanceSettingsUpdate(timezone="Pacific/Kiritimati"))  # UTC+14
    assert svc.school_today() == TODAY + timedelta(days=1)


def test_settings_validation():
    with pytest.raises(ValidationError, match="Unknown timezone"):
        AttendanceSettingsUpdate(timezone="Mars/Olympus")
    with pytest.raises(ValidationError, match="late_after"):
        AttendanceSettingsUpdate(late_after=time(13, 0), scan_closes_at=time(12, 0))
    with pytest.raises(ValidationError, match="weekday"):
        AttendanceSettingsUpdate(school_days=[7])


def test_settings_default_then_persisted(school, db):
    svc = service_at(school, db)
    assert svc.get_settings().late_after == time(8, 0)
    svc.update_settings(AttendanceSettingsUpdate(late_after=time(7, 45), school_days=[4, 0, 0]))
    fresh = service_at(school, db).get_settings()
    assert fresh.late_after == time(7, 45) and fresh.school_days == [0, 4]


# --- Roster & auto-absent ------------------------------------------------------------

def test_roster_before_cutoff_shows_unmarked(school, db):
    roster = service_at(school, db, hour=9).get_roster(school["cls"].id, TODAY, school["sponsor"])
    assert len(roster.entries) == 2                      # the non-enrolled student is not listed
    assert all(e.record is None for e in roster.entries)
    assert not roster.day.auto_absent_applied
    assert db.query(DailyAttendance).count() == 0


def test_roster_after_cutoff_fills_absent_once_and_keeps_marks(school, db):
    s0, s1 = school["students"][:2]
    service_at(school, db, hour=9).bulk_set(bulk(school, (s0, "present")), school["sponsor"])

    late = service_at(school, db, hour=13)
    roster = late.get_roster(school["cls"].id, TODAY, school["sponsor"])
    by_student = {e.student_id: e.record for e in roster.entries}
    assert by_student[s0.id].status == AttendanceStatus.PRESENT
    assert (by_student[s1.id].status, by_student[s1.id].source) == (AttendanceStatus.ABSENT, AttendanceSource.AUTO)

    late.get_roster(school["cls"].id, TODAY, school["sponsor"])   # repeat: nothing new
    assert db.query(DailyAttendance).count() == 2
    assert db.query(AttendanceEvent).filter(AttendanceEvent.event_type == "auto_absent").count() == 1


def test_no_auto_absent_on_holidays_or_before_class_started(school, db):
    svc = service_at(school, db, hour=13)
    svc.set_calendar_day(TODAY, SchoolCalendarDayUpsert(is_school_day=False, label="Holiday"))
    svc.get_roster(school["cls"].id, TODAY, school["sponsor"])
    school["cls"].start_date = date(2026, 10, 1)
    db.commit()
    svc.get_roster(school["cls"].id, date(2026, 9, 29), school["sponsor"])
    assert db.query(DailyAttendance).count() == 0


def test_roster_permissions_and_future_dates(school, db):
    svc = service_at(school, db)
    with pytest.raises(PermissionDeniedError):
        svc.get_roster(school["cls"].id, TODAY, school["other_teacher"])
    assert len(svc.get_roster(school["cls"].id, TODAY, school["admin"]).entries) == 2
    with pytest.raises(BusinessRuleViolationError, match="future"):
        svc.get_roster(school["cls"].id, TODAY + timedelta(days=1), school["sponsor"])


# --- Manual marking ------------------------------------------------------------------

def test_manual_mark_overrides_auto_absent_and_logs_events(school, db):
    s0 = school["students"][0]
    svc = service_at(school, db, hour=13)
    svc.get_roster(school["cls"].id, TODAY, school["sponsor"])  # auto absent
    record = svc.set_status(s0.id, TODAY, DailyStatusSet(status="LATE", notes="Bus broke down"), school["sponsor"])
    assert (record.status, record.source, record.notes) == (AttendanceStatus.LATE, AttendanceSource.MANUAL, "Bus broke down")
    assert events_for(db, record) == ["auto_absent", "manual_set"]
    last = db.query(AttendanceEvent).filter(AttendanceEvent.event_type == "manual_set").one()
    assert (last.old_status, last.new_status, last.actor_id) == ("absent", "late", school["sponsor"].id)


def test_excused_requires_reason_and_is_preapproved(school, db):
    s0 = school["students"][0]
    with pytest.raises(ValidationError, match="excuse_reason is required"):
        DailyStatusSet(status="excused")
    with pytest.raises(ValidationError, match="can't be set manually"):
        DailyStatusSet(status="tardy")

    svc = service_at(school, db)
    rec = svc.set_status(s0.id, TODAY, DailyStatusSet(status="excused", excuse_reason="Funeral"), school["sponsor"])
    assert (rec.excuse_status, rec.excuse_reason, rec.excuse_reviewed_by) == (
        ExcuseStatus.APPROVED, "Funeral", school["sponsor"].id)

    rec = svc.set_status(s0.id, TODAY, DailyStatusSet(status="present"), school["sponsor"])
    assert rec.excuse_status is None and rec.excuse_reason is None
    assert events_for(db, rec) == ["excuse_set", "manual_set"]


def test_set_excuse_endpoint_path(school, db):
    svc = service_at(school, db)
    rec = svc.bulk_set(bulk(school, (school["students"][0], "absent")), school["sponsor"])[0]
    rec = svc.set_excuse(rec.id, ExcuseSet(reason="Hospital visit"), school["sponsor"])
    assert (rec.status, rec.excuse_status) == (AttendanceStatus.EXCUSED, ExcuseStatus.APPROVED)
    with pytest.raises(PermissionDeniedError):
        svc.set_excuse(rec.id, ExcuseSet(reason="x"), school["other_teacher"])


def test_set_status_permissions(school, db):
    s0, _, outsider = school["students"]
    svc = service_at(school, db)
    with pytest.raises(PermissionDeniedError):
        svc.set_status(s0.id, TODAY, DailyStatusSet(status="present"), school["other_teacher"])
    assert svc.set_status(s0.id, TODAY, DailyStatusSet(status="present"), school["admin"]).marked_by == school["admin"].id
    with pytest.raises(BusinessRuleViolationError, match="not actively enrolled"):
        svc.set_status(outsider.id, TODAY, DailyStatusSet(status="present"), school["admin"])


def test_bulk_rules(school, db):
    s0, s1, outsider = school["students"]
    svc = service_at(school, db, on=SATURDAY)
    with pytest.raises(BusinessRuleViolationError, match="not actively enrolled"):
        svc.bulk_set(bulk(school, (s0, "present"), (outsider, "present")), school["sponsor"])
    with pytest.raises(BusinessRuleViolationError, match="only once"):
        svc.bulk_set(bulk(school, (s0, "present"), (s0, "absent")), school["sponsor"])
    with pytest.raises(BusinessRuleViolationError, match="not a school day"):
        svc.bulk_set(bulk(school, (s0, "present"), day=SATURDAY), school["sponsor"])
    with pytest.raises(BusinessRuleViolationError, match="future"):
        service_at(school, db).bulk_set(bulk(school, (s0, "present"), day=TODAY + timedelta(days=1)), school["sponsor"])
    assert db.query(DailyAttendance).count() == 0

    saved = svc.bulk_set(bulk(school, (s0, "present"), (s1, "excused", {"excuse_reason": "Sick note"})), school["sponsor"])
    assert {r.status for r in saved} == {AttendanceStatus.PRESENT, AttendanceStatus.EXCUSED}


def test_concurrent_create_reports_reload_message(school, db, monkeypatch):
    s0 = school["students"][0]
    svc = service_at(school, db)
    svc.bulk_set(bulk(school, (s0, "present")), school["sponsor"])
    # Another request saved first: this request didn't see the row when it looked
    monkeypatch.setattr(svc, "_records_on", lambda *a, **k: {})
    with pytest.raises(BusinessRuleViolationError, match="Reload and try again"):
        svc.bulk_set(bulk(school, (s0, "absent")), school["sponsor"])
    assert db.query(DailyAttendance).one().status == AttendanceStatus.PRESENT


# --- Excuse review -------------------------------------------------------------------

def test_review_pending_excuse(school, db):
    svc = service_at(school, db)
    rec = svc.bulk_set(bulk(school, (school["students"][0], "absent")), school["sponsor"])[0]
    with pytest.raises(BusinessRuleViolationError, match="pending"):
        svc.review_excuse(rec.id, ExcuseReview(approve=True), school["admin"])

    rec.excuse_status, rec.excuse_reason = ExcuseStatus.PENDING, "Parent note"  # parent flow, later
    db.commit()
    with pytest.raises(PermissionDeniedError):
        svc.review_excuse(rec.id, ExcuseReview(approve=True), school["sponsor"])
    rec = svc.review_excuse(rec.id, ExcuseReview(approve=True), school["admin"])
    assert (rec.status, rec.excuse_status) == (AttendanceStatus.EXCUSED, ExcuseStatus.APPROVED)


# --- Close day -----------------------------------------------------------------------

def test_close_day(school, db):
    with pytest.raises(BusinessRuleViolationError, match="cut-off"):
        service_at(school, db, hour=9).close_day(TODAY, school["admin"])
    with pytest.raises(PermissionDeniedError):
        service_at(school, db, hour=13).close_day(TODAY, school["sponsor"])

    svc = service_at(school, db, hour=13)
    assert svc.close_day(TODAY, school["admin"]) == 2
    assert svc.close_day(TODAY, school["admin"]) == 0
    with pytest.raises(BusinessRuleViolationError, match="not a school day"):
        svc.close_day(date(2026, 10, 18), school["admin"])  # Sunday


# --- History -------------------------------------------------------------------------

def test_student_history_summary_and_access(school, db):
    s0, s1 = school["students"][:2]
    mon, tue = date(2026, 10, 19), TODAY
    svc = service_at(school, db, hour=13)
    svc.bulk_set(bulk(school, (s0, "excused", {"excuse_reason": "Clinic"}), day=mon), school["sponsor"])
    svc.bulk_set(bulk(school, (s0, "late"), day=tue), school["sponsor"])

    start, end, summary, records = svc.student_history(s0.id, date(2026, 10, 12), None, s0)
    assert (start, end) == (date(2026, 10, 12), TODAY)
    assert summary.school_days == 7      # Mon 12 – Tue 20, weekdays only
    assert (summary.late, summary.excused, summary.attendance_rate) == (1, 1, 100.0)
    assert [r.date for r in records] == [tue, mon]

    assert svc.student_history(s0.id, None, None, school["parent"])[2].late == 1
    only_excused = svc.student_history(s0.id, mon, mon, s0)[2]
    assert (only_excused.excused, only_excused.attendance_rate) == (1, None)
    with pytest.raises(PermissionDeniedError):
        svc.student_history(s1.id, None, None, s0)
    with pytest.raises(PermissionDeniedError):
        svc.student_history(s1.id, None, None, school["parent"])


def test_events_visible_to_sponsor_only(school, db):
    svc = service_at(school, db)
    rec = svc.bulk_set(bulk(school, (school["students"][0], "present")), school["sponsor"])[0]
    events = svc.list_events(rec.id, school["sponsor"])
    assert [(e.event_type, name) for e, name in events] == [("manual_set", f"{school['sponsor'].first_name} L")]
    with pytest.raises(PermissionDeniedError):
        svc.list_events(rec.id, school["other_teacher"])
    with pytest.raises(EntityNotFoundError):
        svc.list_events(school["cls"].id, school["sponsor"])


def test_endpoints_serialize_responses(school, db):
    from src.api.v1.endpoints.academics import daily_attendance_api as api
    from src.schemas.academics.daily_attendance import (
        AttendanceSettingsRead, DailyAttendanceRead, DailyRoster
    )

    svc = service_at(school, db)
    saved = api.bulk_set_daily(service=svc, bulk_in=bulk(school, (school["students"][0], "present")),
                               current_user=school["sponsor"])
    DailyAttendanceRead.model_validate(saved[0])
    DailyRoster.model_validate(api.get_daily_roster(service=svc, class_id=school["cls"].id, day=TODAY,
                                                    current_user=school["sponsor"]))
    AttendanceSettingsRead.model_validate(api.get_attendance_settings(service=svc, current_user=school["admin"]))
    events = api.list_daily_events(service=svc, daily_id=saved[0].id, current_user=school["sponsor"])
    assert events[0].actor_name and events[0].new_status == "present"
    history = api.get_student_daily_history(service=svc, student_id=school["students"][0].id,
                                            start_date=None, end_date=None, current_user=school["admin"])
    assert history.summary.present == 1


# --- Routing -------------------------------------------------------------------------

@pytest.mark.parametrize("method,path,endpoint", [
    ("GET", "/attendance/daily", "get_daily_roster"),
    ("GET", "/attendance/settings", "get_attendance_settings"),
    ("GET", "/attendance/calendar", "list_calendar_days"),
    ("GET", "/attendance/calendar/day-info", "get_day_info"),
    ("POST", "/attendance/daily/bulk", "bulk_set_daily"),
    ("POST", "/attendance/daily/close-day", "close_day"),
])
def test_daily_routes_win_over_attendance_id_route(method, path, endpoint):
    from starlette.routing import Match
    from src.api.v1.endpoints.academics import router

    scope = {"type": "http", "method": method, "path": path}
    first = next(r for r in router.routes if r.matches(scope)[0] == Match.FULL)
    assert first.endpoint.__name__ == endpoint
