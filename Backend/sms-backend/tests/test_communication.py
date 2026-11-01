"""Phase 6 communication: notify idempotency, the alert hooks (absent, late, results, payment),
announcements and their audiences, the inbox, email switches, the delivery worker, queued gate
scans and school isolation."""
from datetime import UTC, date, datetime, timedelta

import pytest

from attendance_fixtures import TODAY, db, school  # noqa: F401  service-level attendance fixtures
from src.core.config import settings
from src.db.models.academics.attendance import AttendanceStatus
from src.db.models.academics.daily_attendance import AttendanceEvent, DailyAttendance
from src.db.models.auth.permission import Permission
from src.db.models.auth.user_role import UserRole
from src.db.models.communication.notification import Notification, NotificationDelivery
from src.schemas.academics.daily_attendance import DailyStatusSet
from src.services.academics import qr_card_service
from src.services.academics.attendance_scan_service import AttendanceScanService
from src.services.academics.daily_attendance_service import DailyAttendanceService
from src.services.notification import dispatch
from src.services.notification.notify import notify
from src.services.notification.senders import MessageSender, SendResult, SmtpEmailSender

from test_security import env, headers  # noqa: F401  shared app + two-school fixture
from test_gradebook import _db, _publish, _seed as gradebook_school
from test_finance import _pay, _seed as fee_school, _setup as fee_setup, clock  # noqa: F401  (clock: fixture)

C = "/api/v1/communication"


def _notes(db, user_id, event=None):
    q = db.query(Notification).filter(Notification.user_id == user_id)
    if event:
        q = q.filter(Notification.event == event)
    return q.order_by(Notification.created_at).all()


def _grant(ids, *names):
    """Give school admins more permissions (the shared fixture's admin role lacks Phase 6 ones)."""
    gen, db = _db()
    role = db.query(UserRole).filter(UserRole.name == "admin").one()
    for name in names:
        perm = db.query(Permission).filter(Permission.name == name).first() or Permission(name=name)
        if perm not in role.permissions:
            role.permissions.append(perm)
    next(gen, None)


# --- notify -----------------------------------------------------------------------------------------

def test_notify_is_idempotent_and_queues_email_for_users_with_an_address(school, db):
    t, parent, student = school["tenant_id"], school["parent"], school["students"][0]
    student.email = None
    db.flush()
    args = dict(event="announcement", title="Hello", body="Body", source_key="announcement:1")
    assert notify(db, t, recipients=[parent.id, student.id], **args) == 2
    assert notify(db, t, recipients=[parent.id, student.id], **args) == 0  # repeat: nothing new
    assert notify(db, t, recipients=[parent.id], **{**args, "source_key": "announcement:2"}) == 1
    db.commit()
    assert len(_notes(db, parent.id)) == 2 and len(_notes(db, student.id)) == 1
    # an email copy only for the user with an address; SMS is off for the school
    deliveries = db.query(NotificationDelivery).all()
    assert len(deliveries) == 2 and {d.channel for d in deliveries} == {"email"}
    assert {d.status for d in deliveries} == {"queued"}
    with pytest.raises(ValueError):
        notify(db, t, recipients=[parent.id], event="nope", title="x", body="x", source_key="x")


# --- attendance alerts --------------------------------------------------------------------------------

def _attendance(school, db, hour=13, minute=0, on=TODAY, cls=DailyAttendanceService):
    svc = cls(tenant=school["tenant_id"], db=db)
    svc.now_utc = lambda: datetime(on.year, on.month, on.day, hour, minute, tzinfo=UTC)
    return svc


def test_absent_alerts_at_the_cut_off_and_when_staff_mark_absent(school, db):
    parent, s0 = school["parent"], school["students"][0]
    svc = _attendance(school, db, hour=13)
    assert svc.fill_unmarked_absences(TODAY) == 2
    alerts = _notes(db, parent.id, "attendance_absent")
    assert len(alerts) == 1  # only students[0] has a linked parent
    a = alerts[0]
    assert a.body == f"{s0.first_name} L was marked absent on Tue 20 Oct 2026."
    assert a.link == f"/test/parent/attendance?child={s0.id}" and a.source_key == f"absent:{s0.id}:2026-10-20"
    # running the cut-off again, or staff confirming the absence, sends nothing new
    assert svc.fill_unmarked_absences(TODAY) == 0
    svc.set_status(s0.id, TODAY, DailyStatusSet(status=AttendanceStatus.ABSENT), school["sponsor"])
    assert len(_notes(db, parent.id, "attendance_absent")) == 1

    # staff marking absent on another day: one alert; present marks send none
    monday = date(2026, 10, 19)
    svc.set_status(s0.id, monday, DailyStatusSet(status=AttendanceStatus.PRESENT), school["sponsor"])
    assert len(_notes(db, parent.id, "attendance_absent")) == 1
    svc.set_status(s0.id, monday, DailyStatusSet(status=AttendanceStatus.ABSENT), school["sponsor"])
    assert len(_notes(db, parent.id, "attendance_absent")) == 2
    # the email copy is queued with the alert
    assert db.query(NotificationDelivery).filter(NotificationDelivery.status == "queued").count() == 2


@pytest.fixture
def qr(monkeypatch):
    monkeypatch.setattr(settings, "ATTENDANCE_QR_SECRET", "test-qr-secret")


def _scanner(school, db, hour, minute=0, on=TODAY):
    return _attendance(school, db, hour, minute, on, cls=AttendanceScanService)


def _token(school, student):
    return qr_card_service.build_token(school["tenant_id"], student.id, 1)


def test_late_alert_on_an_accepted_late_scan(school, db, qr):
    parent, s0, s1 = school["parent"], school["students"][0], school["students"][1]
    on_time = _scanner(school, db, 7, 30).scan(_token(school, s1), "check_in", "Gate", school["admin"])
    assert on_time.status == AttendanceStatus.PRESENT
    late = _scanner(school, db, 8, 42).scan(_token(school, s0), "check_in", "Gate", school["admin"])
    assert (late.result, late.status) == ("accepted", AttendanceStatus.LATE)
    alerts = _notes(db, parent.id, "attendance_late")
    assert len(alerts) == 1 and alerts[0].body == f"{s0.first_name} L arrived late at 08:42 on Tue 20 Oct 2026."
    again = _scanner(school, db, 8, 50).scan(_token(school, s0), "check_in", "Gate", school["admin"])
    assert again.result == "duplicate" and len(_notes(db, parent.id, "attendance_late")) == 1


# --- queued (offline) scans -----------------------------------------------------------------------------

def test_scanned_at_counts_only_within_its_limits(school, db, qr):
    s0, s1 = school["students"][:2]
    admin = school["admin"]
    # read at 07:40, sent at 09:30: judged at 07:40 (present)
    r = _scanner(school, db, 9, 30).scan(_token(school, s0), "check_in", "Gate", admin,
                                         scanned_at=datetime(2026, 10, 20, 7, 40, tzinfo=UTC))
    assert r.status == AttendanceStatus.PRESENT and r.check_in_at.replace(tzinfo=UTC).hour == 7
    # in the future: the server's time (09:30, late)
    r = _scanner(school, db, 9, 30).scan(_token(school, s1), "check_in", "Gate", admin,
                                         scanned_at=datetime(2026, 10, 20, 10, 0, tzinfo=UTC))
    assert r.status == AttendanceStatus.LATE and r.check_in_at.replace(tzinfo=UTC).hour == 9

    # yesterday, or more than 12 hours old: too old to count
    for scanned_at in (datetime(2026, 10, 19, 23, 50, tzinfo=UTC), datetime(2026, 10, 20, 0, 20, tzinfo=UTC)):
        db.query(AttendanceEvent).delete()
        db.query(DailyAttendance).delete()
        db.commit()
        r = _scanner(school, db, 12, 30).scan(_token(school, s0), "check_in", "Gate", admin, scanned_at=scanned_at)
        assert (r.result, r.reason) == ("rejected", "scan_expired")
    # five hours old and today: counts (no offset means UTC)
    r = _scanner(school, db, 12, 30).scan(_token(school, s0), "check_in", "Gate", admin,
                                          scanned_at=datetime(2026, 10, 20, 7, 30))
    assert (r.result, r.status) == ("accepted", AttendanceStatus.PRESENT)


def test_a_scan_sent_twice_is_counted_once(school, db, qr):
    s0 = school["students"][0]
    admin = school["admin"]
    first = _scanner(school, db, 7, 45).scan(_token(school, s0), "check_in", "Gate", admin, client_scan_id="dev1-0001")
    assert first.result == "accepted"
    # resent later (the queue didn't hear back): same scan, not a second arrival
    again = _scanner(school, db, 9, 0).scan(_token(school, s0), "check_in", "Gate", admin, client_scan_id="dev1-0001")
    assert (again.result, again.status) == ("duplicate", AttendanceStatus.PRESENT)
    assert again.student.id == s0.id
    events = db.query(AttendanceEvent).filter(AttendanceEvent.student_id == s0.id).all()
    assert len(events) == 1 and events[0].client_scan_id == "dev1-0001"

    # a rejected scan resent returns the same rejection, logged once
    closed = _scanner(school, db, 12, 30)
    s1 = school["students"][1]
    assert closed.scan(_token(school, s1), "check_in", "Gate", admin, client_scan_id="dev1-0002").reason == "scan_closed"
    assert closed.scan(_token(school, s1), "check_in", "Gate", admin, client_scan_id="dev1-0002").reason == "scan_closed"
    assert db.query(AttendanceEvent).filter(AttendanceEvent.client_scan_id == "dev1-0002").count() == 1


def test_scan_endpoint_accepts_the_queue_fields(env):
    client, ids = env
    r = client.post("/api/v1/academics/attendance/scan", headers=headers(ids, "admin_a"),
                    json={"token": "bad", "scanned_at": "2026-10-20T07:40:00Z", "client_scan_id": "x" * 65})
    assert r.status_code == 422  # client_scan_id is at most 64 characters


# --- results and payment alerts --------------------------------------------------------------------------

def test_results_published_alerts_students_and_parents_once(env):
    client, ids = env
    s = gradebook_school(ids)
    assert _publish(client, ids, s, period=0).status_code == 201
    gen, db = _db()
    alerts = db.query(Notification).filter(Notification.event == "results_published").all()
    assert len(alerts) == 4  # three students and the parent of the first
    parent_alert = next(a for a in alerts if a.user_id == ids["parent"])
    assert parent_alert.body.endswith("'s Period 1 results (Grade 5 - A) are published.")
    assert parent_alert.link == f"/school-a/parent/results?child={ids['pupil0']}"
    own = next(a for a in alerts if a.user_id == ids["pupil0"])
    assert own.body == "Your Period 1 results (Grade 5 - A) are published." and own.link == "/school-a/student/grades"
    next(gen, None)
    # publishing again (already published) adds nothing
    assert _publish(client, ids, s, period=0).status_code in (200, 201)
    gen, db = _db()
    assert db.query(Notification).filter(Notification.event == "results_published").count() == 4
    next(gen, None)


def test_payment_received_alerts_the_parents(env, clock):
    client, ids = env
    s = fee_school(ids)
    fee_setup(client, ids, s)
    paid = _pay(client, ids, s, pupil=0, amount="50")
    assert paid.status_code == 200, paid.text
    _pay(client, ids, s, pupil=1, amount="10")  # pupil 1 has no linked parent: no alert
    gen, db = _db()
    alerts = db.query(Notification).filter(Notification.event == "payment_received").all()
    assert len(alerts) == 1 and alerts[0].user_id == ids["parent"]
    assert alerts[0].body == f"USD 50.00 received for First0 Last00, receipt {paid.json()['receipt_number']}."
    next(gen, None)
    # a void sends nothing
    client.post(f"/api/v1/finance/payments/{paid.json()['id']}/void", json={"reason": "x"}, headers=headers(ids, "cashier"))
    gen, db = _db()
    assert db.query(Notification).filter(Notification.event == "payment_received").count() == 1
    next(gen, None)


# --- announcements -----------------------------------------------------------------------------------------

def _announce(client, ids, who, **body):
    body.setdefault("title", "Sports day")
    body.setdefault("body", "Sports day is on Friday.")
    return client.post(f"{C}/announcements", json=body, headers=headers(ids, who))


def test_announcement_audiences_for_admins(env):
    client, ids = env
    s = gradebook_school(ids)
    _grant(ids, "send_announcements")
    aud = client.get(f"{C}/announcements/audiences", headers=headers(ids, "admin_a")).json()
    assert aud["roles"] == ["parents", "students", "teachers", "staff"] and aud["family"] is True
    assert [c["name"] for c in aud["classes"]] == ["Grade 5 - A"]

    # School A: admin_a (author), new_admin_a, student_a, 5 teachers, 3 pupils, 1 parent; the
    # platform super-admin whose account lives in school A is never a recipient
    counts = {
        "all": _announce(client, ids, "admin_a", audience="all"),
        "parents": _announce(client, ids, "admin_a", audience="role", audience_role="parents"),
        "students": _announce(client, ids, "admin_a", audience="role", audience_role="students"),
        "teachers": _announce(client, ids, "admin_a", audience="role", audience_role="teachers"),
        "staff": _announce(client, ids, "admin_a", audience="role", audience_role="staff"),
        "class": _announce(client, ids, "admin_a", audience="class", class_id=str(s["class"])),
        "family": _announce(client, ids, "admin_a", audience="family", student_id=str(ids["pupil0"])),
    }
    assert {k: r.json()["recipient_count"] for k, r in counts.items()} == {
        "all": 11, "parents": 1, "students": 4, "teachers": 5, "staff": 6, "class": 4, "family": 2}
    fam = counts["family"].json()
    assert fam["audience_label"] == "Family of First5 Last5" and fam["can_withdraw"] is True
    assert counts["class"].json()["audience_label"] == "Class Grade 5 - A"
    assert counts["staff"].json()["audience_label"] == "Staff" and counts["all"].json()["author_name"]
    gen, db = _db()
    assert not _notes(db, ids["super"]) and not _notes(db, ids["admin_a"])
    next(gen, None)
    # validation
    assert _announce(client, ids, "admin_a", audience="role").status_code == 422
    assert _announce(client, ids, "admin_a", audience="class").status_code == 404
    assert _announce(client, ids, "admin_a", audience="all", title="").status_code == 422


def test_teachers_announce_only_to_classes_they_teach_or_sponsor(env):
    client, ids = env
    s = gradebook_school(ids)
    cls = str(s["class"])
    for who in ("math_t", "sponsor"):
        aud = client.get(f"{C}/announcements/audiences", headers=headers(ids, who)).json()
        assert aud == {"roles": [], "classes": [{"id": cls, "name": "Grade 5 - A"}], "family": False}
        r = _announce(client, ids, who, audience="class", class_id=cls)
        assert r.status_code == 200 and r.json()["recipient_count"] == 4
    assert client.get(f"{C}/announcements/audiences", headers=headers(ids, "other_t")).json()["classes"] == []
    assert _announce(client, ids, "other_t", audience="class", class_id=cls).status_code == 403
    assert _announce(client, ids, "math_t", audience="all").status_code == 403
    assert _announce(client, ids, "math_t", audience="family", student_id=str(ids["pupil0"])).status_code == 403
    assert _announce(client, ids, "student_a", audience="all").status_code == 403

    # who sees what: the parent both, the math teacher their own, the other teacher none
    assert client.get(f"{C}/announcements", headers=headers(ids, "parent")).json()["total"] == 2
    mine = client.get(f"{C}/announcements", headers=headers(ids, "math_t")).json()
    assert mine["total"] == 1 and mine["items"][0]["can_withdraw"] is True
    assert client.get(f"{C}/announcements", headers=headers(ids, "other_t")).json()["total"] == 0


def test_withdraw_removes_the_announcement_from_inboxes(env):
    client, ids = env
    s = gradebook_school(ids)
    _grant(ids, "send_announcements")
    sent = _announce(client, ids, "math_t", audience="class", class_id=str(s["class"])).json()
    parent = headers(ids, "parent")
    assert client.get(f"{C}/inbox/unread-count", headers=parent).json() == {"unread": 1}
    # another teacher can't withdraw it; the author (or an admin) can, once
    assert client.post(f"{C}/announcements/{sent['id']}/withdraw", headers=headers(ids, "sponsor")).status_code == 403
    r = client.post(f"{C}/announcements/{sent['id']}/withdraw", headers=headers(ids, "math_t"))
    assert r.status_code == 200 and r.json()["withdrawn_at"] and r.json()["can_withdraw"] is False
    assert client.post(f"{C}/announcements/{sent['id']}/withdraw", headers=headers(ids, "admin_a")).status_code == 409
    assert client.get(f"{C}/inbox", headers=parent).json()["items"] == []
    assert client.get(f"{C}/announcements", headers=parent).json()["total"] == 0
    admin_view = client.get(f"{C}/announcements", headers=headers(ids, "admin_a")).json()["items"][0]
    assert admin_view["withdrawn_at"] and admin_view["recipient_count"] == 4
    gen, db = _db()
    assert db.query(Notification).count() == 0 and db.query(NotificationDelivery).count() == 0
    next(gen, None)


# --- inbox and email switches --------------------------------------------------------------------------------

def test_inbox_read_and_unread(env):
    client, ids = env
    _grant(ids, "send_announcements")
    for n in range(3):
        _announce(client, ids, "admin_a", audience="role", audience_role="students", title=f"Notice {n}")
    h = headers(ids, "student_a")
    inbox = client.get(f"{C}/inbox", params={"page_size": 2}, headers=h).json()
    assert (inbox["total"], inbox["pages"], inbox["unread"], len(inbox["items"])) == (3, 2, 3, 2)
    item = inbox["items"][0]
    assert item["title"] == "Notice 2" and item["event"] == "announcement" and item["read_at"] is None
    assert set(item) == {"id", "event", "title", "body", "link", "created_at", "read_at"}
    assert client.post(f"{C}/inbox/{item['id']}/read", headers=h).json() == {"unread": 2}
    assert client.post(f"{C}/inbox/{item['id']}/read", headers=h).json() == {"unread": 2}  # again: no change
    assert client.get(f"{C}/inbox", params={"unread_only": True}, headers=h).json()["total"] == 2
    assert client.post(f"{C}/inbox/read-all", headers=h).json() == {"unread": 0}
    assert client.get(f"{C}/inbox/unread-count", headers=h).json() == {"unread": 0}
    # someone else's notification is not found
    assert client.post(f"{C}/inbox/{item['id']}/read", headers=headers(ids, "admin_a")).status_code == 404


def test_preferences_turn_email_off_per_event(env, monkeypatch):
    client, ids = env
    _grant(ids, "send_announcements")
    monkeypatch.setattr(settings, "SMTP_SERVER", "")
    h = headers(ids, "student_a")
    prefs = client.get(f"{C}/preferences", headers=h).json()
    assert prefs["email"].endswith("@school-a.org") and prefs["email_configured"] is False
    assert [i["event"] for i in prefs["items"]] == ["attendance_absent", "attendance_late", "results_published",
                                                    "payment_received", "announcement"]
    assert all(i["email"] for i in prefs["items"]) and prefs["items"][4]["label"] == "Announcements"
    r = client.put(f"{C}/preferences", json=[{"event": "announcement", "email": False}], headers=h)
    assert r.status_code == 200 and [i["email"] for i in r.json()["items"]] == [True, True, True, True, False]
    assert client.put(f"{C}/preferences", json=[{"event": "nope", "email": False}], headers=h).status_code == 422

    _announce(client, ids, "admin_a", audience="all")
    gen, db = _db()
    # still in the inbox, but no email copy for the student who turned it off
    assert len(_notes(db, ids["student_a"])) == 1
    with_email = {r[0] for r in db.query(Notification.user_id).join(
        NotificationDelivery, NotificationDelivery.notification_id == Notification.id)}
    assert ids["student_a"] not in with_email and ids["new_admin_a"] in with_email
    next(gen, None)


# --- the delivery worker ----------------------------------------------------------------------------------------

class FakeSender(MessageSender):
    channel = "email"

    def __init__(self, configured=True):
        self._configured = configured
        self.sent = []

    def configured(self):
        return self._configured

    def send(self, message):
        self.sent.append(message)
        if message.to.startswith("fail"):
            return SendResult("failed", error="Mailbox unavailable")
        return SendResult("sent", provider_ref=f"<{len(self.sent)}@test>")


def test_worker_marks_sent_retries_then_failed_and_skipped(env):
    client, ids = env
    _grant(ids, "send_announcements")
    gen, db = _db()
    from src.db.models.auth.user import User
    db.query(User).filter(User.id == ids["new_admin_a"]).one().email = "fail@school-a.org"
    db.flush()
    t = ids["tenant_a"]
    notify(db, t, event="announcement", recipients=[ids["student_a"], ids["new_admin_a"]], title="Hi",
           body="Hello there", source_key="announcement:w1", link="/school-a/inbox")
    next(gen, None)

    gen, db = _db()
    fake, t0 = FakeSender(), datetime(2026, 11, 2, 8, 0, tzinfo=UTC)
    assert dispatch.send_pending(db, {"email": fake}, now=t0) == {"sent": 1, "failed": 0, "retry": 1, "skipped": 0}
    ok = next(m for m in fake.sent if not m.to.startswith("fail"))
    assert ok.subject == "Hi - School A" and "Hello there" in ok.text and "/school-a/inbox" in ok.text
    # backoff: not before 2 minutes, then 10; the third failure is final
    assert dispatch.send_pending(db, {"email": fake}, now=t0 + timedelta(minutes=1))["retry"] == 0
    assert dispatch.send_pending(db, {"email": fake}, now=t0 + timedelta(minutes=3))["retry"] == 1
    assert dispatch.send_pending(db, {"email": fake}, now=t0 + timedelta(minutes=14))["failed"] == 1
    rows = {d.status: d for d in db.query(NotificationDelivery)}
    assert rows["sent"].sent_at and rows["sent"].provider_ref.endswith("@test>") and rows["sent"].attempts == 1
    assert rows["failed"].attempts == 3 and rows["failed"].last_error == "Mailbox unavailable"
    next(gen, None)

    # SMTP not configured: queued emails are skipped, never failed
    gen, db = _db()
    notify(db, t, event="announcement", recipients=[ids["student_a"]], title="Two", body="B", source_key="announcement:w2")
    next(gen, None)
    gen, db = _db()
    unconfigured = SmtpEmailSender(server="", sender="", password="")
    assert dispatch.send_pending(db, {"email": unconfigured}, now=t0)["skipped"] == 1
    next(gen, None)

    # the delivery log: admins with manage_tenant_settings; retry puts a failed one back in the queue
    h = headers(ids, "admin_a")
    log = client.get(f"{C}/deliveries", headers=h).json()
    assert log["counts"] == {"queued": 0, "sent": 1, "failed": 1, "skipped": 1} and log["total"] == 3
    failed = client.get(f"{C}/deliveries", params={"status": "failed"}, headers=h).json()["items"]
    assert len(failed) == 1 and failed[0]["recipient_email"] == "fail@school-a.org" and failed[0]["title"] == "Hi"
    assert set(failed[0]) == {"id", "channel", "status", "attempts", "last_error", "created_at", "sent_at",
                              "recipient_name", "recipient_email", "event", "title"}
    r = client.post(f"{C}/deliveries/{failed[0]['id']}/retry", headers=h)
    assert r.status_code == 200 and (r.json()["status"], r.json()["attempts"]) == ("queued", 0)
    assert client.post(f"{C}/deliveries/{failed[0]['id']}/retry", headers=h).status_code == 409
    assert client.get(f"{C}/deliveries", headers=headers(ids, "student_a")).status_code == 403


# --- isolation ------------------------------------------------------------------------------------------------

def test_schools_never_see_each_others_communication(env):
    client, ids = env
    _grant(ids, "send_announcements")
    sent = _announce(client, ids, "admin_a", audience="all").json()
    hb = headers(ids, "admin_b")
    # school B's admin and student see nothing of school A's announcement
    assert client.get(f"{C}/announcements", headers=hb).json()["total"] == 0
    assert client.get(f"{C}/inbox", headers=headers(ids, "student_b")).json()["total"] == 0
    assert client.post(f"{C}/announcements/{sent['id']}/withdraw", headers=hb).status_code == 404
    assert client.get(f"{C}/deliveries", headers=hb).json()["total"] == 0
    a_note = client.get(f"{C}/inbox", headers=headers(ids, "student_a")).json()["items"][0]
    assert client.post(f"{C}/inbox/{a_note['id']}/read", headers=headers(ids, "student_b")).status_code == 404
    # school A can't target school B's student or class
    assert _announce(client, ids, "admin_a", audience="family", student_id=str(ids["student_b"])).status_code == 404
    # the header can't switch school
    assert client.get(f"{C}/inbox", headers=headers(ids, "admin_a", school="tenant_b")).status_code == 403
    # the "all" announcement reached school A only
    gen, db = _db()
    assert not _notes(db, ids["admin_b"]) and not _notes(db, ids["student_b"])
    next(gen, None)
