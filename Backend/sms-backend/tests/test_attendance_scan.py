"""Tests for QR ID cards and scanning (implementation_guide.md, section 6.4)."""
from datetime import UTC, date, datetime, time
from uuid import uuid4

import pytest

from attendance_fixtures import TODAY, db, make_user, school  # noqa: F401  (fixtures)
from src.core.config import settings
from src.core.exceptions.business import PermissionDeniedError
from src.db.models.academics.attendance import AttendanceStatus
from src.db.models.academics.daily_attendance import AttendanceEvent, AttendanceSource
from src.db.models.auth.user_role import UserRole
from src.db.models.people.teacher import Teacher
from src.schemas.academics.daily_attendance import (
    AttendanceSettingsUpdate, DailyStatusSet, SchoolCalendarDayUpsert
)
from src.services.academics import qr_card_service
from src.services.academics.attendance_scan_service import SCANNER_ROLE, AttendanceScanService

SECRET = "test-qr-secret"


@pytest.fixture(autouse=True)
def qr_secret(monkeypatch):
    monkeypatch.setattr(settings, "ATTENDANCE_QR_SECRET", SECRET)


def scanner_at(school, db, hour=7, minute=30, on=TODAY):
    svc = AttendanceScanService(tenant=school["tenant_id"], db=db)
    svc.now_utc = lambda: datetime(on.year, on.month, on.day, hour, minute, tzinfo=UTC)
    return svc


def token_for(school, student, version=1, tenant_id=None):
    return qr_card_service.build_token(tenant_id or school["tenant_id"], student.id, version)


def scan(svc, token, user, mode="check_in"):
    return svc.scan(token, mode, "Main gate", user)


# --- Token -----------------------------------------------------------------------------

def test_token_round_trip_and_tamper():
    tenant, student = uuid4(), uuid4()
    token = qr_card_service.build_token(tenant, student, 3)
    decoded = qr_card_service.verify_token(token)
    assert (decoded.tenant_id, decoded.student_id, decoded.card_version) == (tenant, student, 3)

    tampered = token.replace(".3.", ".4.")
    for bad in (tampered, token[:-1] + ("A" if token[-1] != "A" else "B"), "12345", "", "SMS1.a.b.c.d"):
        with pytest.raises(qr_card_service.InvalidToken):
            qr_card_service.verify_token(bad)
    with pytest.raises(qr_card_service.InvalidToken):
        qr_card_service.verify_token(qr_card_service.build_token(tenant, student, 1, secret="other-secret"))


def test_not_configured_is_a_clear_error(monkeypatch):
    monkeypatch.setattr(settings, "ATTENDANCE_QR_SECRET", "")
    with pytest.raises(qr_card_service.QRNotConfiguredError, match="ATTENDANCE_QR_SECRET"):
        qr_card_service.build_token(uuid4(), uuid4(), 1)


# --- Check-in precedence (guide 6.3.3) ---------------------------------------------------

def test_first_scan_present_then_duplicate(school, db):
    s0 = school["students"][0]
    svc = scanner_at(school, db, hour=7, minute=40)
    first = scan(svc, token_for(school, s0), school["admin"])
    assert (first.result, first.status, first.student.name) == ("accepted", AttendanceStatus.PRESENT, f"{s0.first_name} L")
    assert first.student.class_name == "Grade 5 - A" and first.check_in_at is not None

    again = scan(scanner_at(school, db, hour=7, minute=55), token_for(school, s0), school["admin"])
    assert (again.result, again.status) == ("duplicate", AttendanceStatus.PRESENT)
    assert again.check_in_at.replace(tzinfo=UTC).hour == 7 and again.check_in_at.replace(tzinfo=UTC).minute == 40


def test_scan_after_late_after_is_late_and_after_close_is_rejected(school, db):
    s0, s1 = school["students"][:2]
    assert scan(scanner_at(school, db, hour=9), token_for(school, s0), school["admin"]).status == AttendanceStatus.LATE
    closed = scan(scanner_at(school, db, hour=12, minute=1), token_for(school, s1), school["admin"])
    assert (closed.result, closed.reason) == ("rejected", "scan_closed")


def test_scan_never_overwrites_excused(school, db):
    s0 = school["students"][0]
    svc = scanner_at(school, db)
    svc.set_status(s0.id, TODAY, DailyStatusSet(status="excused", excuse_reason="Funeral"), school["sponsor"])
    result = scan(svc, token_for(school, s0), school["admin"])
    assert (result.result, result.status) == ("duplicate", AttendanceStatus.EXCUSED)


def test_absent_is_upgraded_by_a_scan(school, db):
    s0, s1 = school["students"][:2]
    svc = scanner_at(school, db, hour=13)
    svc.update_settings(AttendanceSettingsUpdate(auto_absent_at=time(10, 0), scan_closes_at=time(14, 0)))
    svc.get_roster(school["cls"].id, TODAY, school["sponsor"])  # auto-absent both
    svc.set_status(s1.id, TODAY, DailyStatusSet(status="absent"), school["sponsor"])  # manual absent

    for student, old_source in ((s0, "auto"), (s1, "manual")):
        result = scan(svc, token_for(school, student), school["admin"])
        assert (result.result, result.status) == ("accepted", AttendanceStatus.LATE), old_source
    events = db.query(AttendanceEvent).filter(AttendanceEvent.event_type == "scan_accepted").all()
    assert {(e.old_status, e.new_status) for e in events} == {("absent", "late")}


# --- Rejections ---------------------------------------------------------------------------

def test_rejections_are_logged_with_reasons(school, db):
    s0, _, outsider = school["students"]
    svc = scanner_at(school, db)
    admin = school["admin"]

    assert scan(svc, "not-a-card", admin).reason == "invalid_signature"
    assert scan(svc, token_for(school, s0, tenant_id=uuid4()), admin).reason == "wrong_tenant"
    assert scan(svc, qr_card_service.build_token(school["tenant_id"], uuid4(), 1), admin).reason == "unknown_student"
    assert scan(svc, token_for(school, s0, version=2), admin).reason == "revoked"
    assert scan(svc, token_for(school, outsider), admin).reason == "not_enrolled"
    assert scan(svc, token_for(school, s0), school["other_teacher"]).reason == "not_your_class"

    s0.status = "withdrawn"
    db.commit()
    assert scan(svc, token_for(school, s0), admin).reason == "inactive_student"
    s0.status = "active"
    db.commit()

    svc.set_calendar_day(TODAY, SchoolCalendarDayUpsert(is_school_day=False, label="Holiday"))
    assert scan(svc, token_for(school, s0), admin).reason == "not_school_day"

    rejected = db.query(AttendanceEvent).filter(AttendanceEvent.event_type == "scan_rejected").count()
    assert rejected == 8
    assert db.query(AttendanceEvent).filter(AttendanceEvent.device_label == "Main gate").count() == 8


def test_who_can_scan(school, db):
    s0, s1 = school["students"][:2]
    scanner = make_user(Teacher, school["tenant_id"], UserRole(name=SCANNER_ROLE), employee_id="G1")
    db.add(scanner)
    db.commit()
    svc = scanner_at(school, db)
    assert scan(svc, token_for(school, s0), school["sponsor"]).result == "accepted"   # own class
    assert scan(svc, token_for(school, s1), scanner).result == "accepted"             # gate staff


# --- Check-out ----------------------------------------------------------------------------

def test_check_out(school, db):
    s0, s1 = school["students"][:2]
    svc = scanner_at(school, db, hour=15)
    assert scan(svc, token_for(school, s0), school["admin"], "check_out").reason == "checkout_disabled"

    svc.update_settings(AttendanceSettingsUpdate(allow_checkout_scan=True))
    assert scan(svc, token_for(school, s0), school["admin"], "check_out").reason == "not_checked_in"
    scan(scanner_at(school, db, hour=7), token_for(school, s0), school["admin"])
    out = scan(svc, token_for(school, s0), school["admin"], "check_out")
    assert out.result == "accepted" and out.check_out_at is not None
    assert scan(svc, token_for(school, s0), school["admin"], "check_out").result == "duplicate"
    assert scan(svc, token_for(school, s1), school["admin"], "check_out").reason == "not_checked_in"


# --- Manual check-in at the scanner -------------------------------------------------------

def test_manual_check_in_by_admission_number(school, db):
    s0 = school["students"][0]
    svc = scanner_at(school, db, hour=8, minute=30)
    result = svc.manual_check_in(s0.admission_number, "Main gate", school["admin"])
    assert (result.result, result.status) == ("accepted", AttendanceStatus.LATE)
    record = svc.get_roster(school["cls"].id, TODAY, school["sponsor"]).entries
    sources = {e.student_id: e.record.source for e in record if e.record}
    assert sources[s0.id] == AttendanceSource.MANUAL
    assert svc.manual_check_in("NOPE", None, school["admin"]).reason == "unknown_student"


# --- ID cards -----------------------------------------------------------------------------

def test_class_cards_and_reissue_revokes_old_card(school, db):
    svc = scanner_at(school, db)
    cards = svc.class_cards(school["cls"].id, school["admin"])
    assert len(cards) == 2
    assert all(c.qr_svg.startswith("<svg") and c.card_version == 1 and c.card_issued_at for c in cards)
    with pytest.raises(PermissionDeniedError):
        svc.class_cards(school["cls"].id, school["sponsor"])

    s0 = school["students"][0]
    old_token = token_for(school, s0, version=1)
    new_card = svc.reissue_card(s0.id, school["admin"])
    assert new_card.card_version == 2
    assert scan(svc, old_token, school["admin"]).reason == "revoked"
    assert scan(svc, token_for(school, s0, version=2), school["admin"]).result == "accepted"


def test_fill_unmarked_absences_used_by_cron(school, db):
    svc = scanner_at(school, db, hour=13)
    assert svc.fill_unmarked_absences(TODAY) == 2
    assert svc.fill_unmarked_absences(TODAY) == 0


@pytest.mark.parametrize("method,path,endpoint", [
    ("GET", "/attendance/id-cards", "get_class_id_cards"),
    ("POST", "/attendance/scan", "scan_card"),
])
def test_scan_routes_win_over_attendance_id_route(method, path, endpoint):
    from starlette.routing import Match
    from src.api.v1.endpoints.academics import router

    scope = {"type": "http", "method": method, "path": path}
    first = next(r for r in router.routes if r.matches(scope)[0] == Match.FULL)
    assert first.endpoint.__name__ == endpoint
