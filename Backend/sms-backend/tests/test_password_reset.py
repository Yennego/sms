"""Forgot / reset password: no account enumeration, single-use links, per-school tokens."""
import time

import pytest

from src.db.models.auth import User
from src.services.auth import password_reset
from src.services.auth.token_blacklist import TokenBlacklistService
from test_security import env, headers  # noqa: F401  (shared two-school fixture)

FORGOT = "/api/v1/auth/forgot-password"
RESET = "/api/v1/auth/reset-password"
GOOD_PASSWORD = "N3w!Passw0rd"


class FakeRedis:
    """Tiny in-memory stand-in for the redis.asyncio calls the reset flow uses."""

    def __init__(self):
        self.data, self.expiry = {}, {}

    def _alive(self, key):
        if key in self.expiry and self.expiry[key] <= time.time():
            self.data.pop(key, None)
            self.expiry.pop(key, None)
        return key in self.data

    async def ping(self):
        return True

    async def get(self, key):
        return self.data.get(key) if self._alive(key) else None

    async def set(self, key, value, ex=None):
        self.data[key] = value
        if ex:
            self.expiry[key] = time.time() + ex

    async def delete(self, *keys):
        for key in keys:
            self.data.pop(key, None)
            self.expiry.pop(key, None)

    async def incr(self, key):
        value = int(await self.get(key) or 0) + 1
        self.data[key] = str(value)
        return value

    async def expire(self, key, seconds):
        self.expiry[key] = time.time() + seconds

    def pipeline(self):
        return FakePipeline(self)


class FakePipeline:
    def __init__(self, redis):
        self.redis, self.calls = redis, []

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False

    def __getattr__(self, name):
        async def queue(*args, **kwargs):
            self.calls.append((name, args, kwargs))
        return queue

    async def execute(self):
        results = [await getattr(self.redis, n)(*a, **k) for n, a, k in self.calls]
        self.calls = []
        return results


@pytest.fixture
def reset_env(env, monkeypatch):  # noqa: F811
    client, ids = env
    store = FakeRedis()
    sent = []

    async def fake_store():
        return store

    monkeypatch.setattr(password_reset, "get_store", fake_store)
    monkeypatch.setattr(password_reset, "send_reset_email",
                        lambda email, link, school, user_id: sent.append((email, link)))
    # Session revocation in memory, not in a developer's Redis
    blacklist = TokenBlacklistService()
    monkeypatch.setattr(blacklist, "redis_available", False)
    monkeypatch.setattr(blacklist, "_revoked_before", {})

    from main import app
    from src.db.session import get_db
    db = next(app.dependency_overrides[get_db]())
    emails = {k: db.get(User, ids[k]).email for k in ("admin_a", "admin_b", "student_a", "super")}
    db.close()
    yield client, ids, store, sent, emails


def school(ids, key):
    return {"X-Tenant-ID": str(ids[key])}


def request_link(client, ids, sent, email, tenant="tenant_a"):
    resp = client.post(FORGOT, json={"email": email}, headers=school(ids, tenant))
    assert resp.status_code == 200
    return sent[-1][1].split("token=")[1]


def test_same_answer_for_known_and_unknown_email(reset_env):
    client, ids, store, sent, emails = reset_env
    known = client.post(FORGOT, json={"email": emails["admin_a"].upper()}, headers=school(ids, "tenant_a"))
    unknown = client.post(FORGOT, json={"email": "nobody@school-a.org"}, headers=school(ids, "tenant_a"))
    # An account in another school is unknown here
    other = client.post(FORGOT, json={"email": emails["admin_b"]}, headers=school(ids, "tenant_a"))
    assert known.status_code == unknown.status_code == other.status_code == 200
    assert known.json() == unknown.json() == other.json()
    assert len(sent) == 1 and sent[0][0] == emails["admin_a"]
    assert f"/school-a/reset-password?token=" in sent[0][1]

    # Only the token's hash is stored, with a 30-minute expiry
    token = sent[0][1].split("token=")[1]
    assert not any(token in key or token in str(v) for key, v in store.data.items())
    token_keys = [k for k in store.data if k.startswith("pwreset:token:")]
    assert len(token_keys) == 1
    assert 0 < store.expiry[token_keys[0]] - time.time() <= 30 * 60


def test_super_admin_gets_no_email_link(reset_env):
    client, ids, store, sent, emails = reset_env
    resp = client.post(FORGOT, json={"email": emails["super"]}, headers=school(ids, "tenant_a"))
    assert resp.status_code == 200 and sent == []


def test_token_works_once_and_ends_sessions(reset_env):
    client, ids, store, sent, emails = reset_env
    old_session = headers(ids, "student_a")
    assert client.get("/api/v1/auth/me", headers=old_session).status_code == 200

    token = request_link(client, ids, sent, emails["student_a"])
    time.sleep(1.05)  # token timestamps are in whole seconds
    resp = client.post(RESET, json={"token": token, "new_password": GOOD_PASSWORD}, headers=school(ids, "tenant_a"))
    assert resp.status_code == 200, resp.text

    again = client.post(RESET, json={"token": token, "new_password": GOOD_PASSWORD}, headers=school(ids, "tenant_a"))
    assert again.status_code == 400 and "invalid" in again.json()["detail"]

    # Old sessions are over; the new password signs in
    assert client.get("/api/v1/auth/me", headers=old_session).status_code == 401
    login = client.post("/api/v1/auth/login", data={"username": emails["student_a"], "password": GOOD_PASSWORD},
                        headers=school(ids, "tenant_a"))
    assert login.status_code == 200
    me = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {login.json()['access_token']}"})
    assert me.status_code == 200 and me.json()["is_first_login"] is False


def test_new_link_replaces_the_previous_one(reset_env):
    client, ids, store, sent, emails = reset_env
    first = request_link(client, ids, sent, emails["admin_a"])
    second = request_link(client, ids, sent, emails["admin_a"])
    assert client.post(RESET, json={"token": first, "new_password": GOOD_PASSWORD},
                       headers=school(ids, "tenant_a")).status_code == 400
    assert client.post(RESET, json={"token": second, "new_password": GOOD_PASSWORD},
                       headers=school(ids, "tenant_a")).status_code == 200


def test_invalid_and_expired_tokens(reset_env):
    client, ids, store, sent, emails = reset_env
    bogus = client.post(RESET, json={"token": "x" * 43, "new_password": GOOD_PASSWORD}, headers=school(ids, "tenant_a"))
    assert bogus.status_code == 400

    token = request_link(client, ids, sent, emails["admin_a"])
    for key in store.expiry:
        store.expiry[key] = time.time() - 1  # 30 minutes later
    expired = client.post(RESET, json={"token": token, "new_password": GOOD_PASSWORD}, headers=school(ids, "tenant_a"))
    assert expired.status_code == 400


def test_password_policy_enforced_without_using_up_the_link(reset_env):
    client, ids, store, sent, emails = reset_env
    token = request_link(client, ids, sent, emails["admin_a"])
    weak = client.post(RESET, json={"token": token, "new_password": "password"}, headers=school(ids, "tenant_a"))
    assert weak.status_code == 400 and "uppercase" in weak.json()["detail"]
    ok = client.post(RESET, json={"token": token, "new_password": GOOD_PASSWORD}, headers=school(ids, "tenant_a"))
    assert ok.status_code == 200


def test_token_from_school_a_cannot_reset_in_school_b(reset_env):
    client, ids, store, sent, emails = reset_env
    token = request_link(client, ids, sent, emails["admin_a"])
    resp = client.post(RESET, json={"token": token, "new_password": GOOD_PASSWORD}, headers=school(ids, "tenant_b"))
    assert resp.status_code == 400
    # And the link is spent: it can't be replayed on the right school either
    assert client.post(RESET, json={"token": token, "new_password": GOOD_PASSWORD},
                       headers=school(ids, "tenant_a")).status_code == 400


def test_forgot_password_is_rate_limited_per_account(reset_env):
    client, ids, store, sent, emails = reset_env
    codes = [client.post(FORGOT, json={"email": "nobody@school-a.org"}, headers=school(ids, "tenant_a")).status_code
             for _ in range(4)]
    assert codes == [200, 200, 200, 429]


def test_unavailable_without_redis(env, monkeypatch):  # noqa: F811
    client, ids = env

    async def no_store():
        return None

    monkeypatch.setattr(password_reset, "get_store", no_store)
    resp = client.post(FORGOT, json={"email": "a@b.org"}, headers=school(ids, "tenant_a"))
    assert resp.status_code == 503 and "temporarily unavailable" in resp.json()["detail"]
    assert client.post(RESET, json={"token": "x" * 43, "new_password": GOOD_PASSWORD},
                       headers=school(ids, "tenant_a")).status_code == 503


def test_unknown_school_is_rejected(reset_env):
    client, ids, store, sent, emails = reset_env
    resp = client.post(FORGOT, json={"email": emails["admin_a"]}, headers={"X-Tenant-ID": "no-such-school"})
    assert resp.status_code == 400 and sent == []


def test_debug_logs_link_only_in_debug(monkeypatch, caplog):
    from src.core.config import settings

    class NoEmail:
        def is_configured(self):
            return False

    monkeypatch.setattr(password_reset, "EmailService", NoEmail)
    for debug, shown in ((False, False), (True, True)):
        caplog.clear()
        monkeypatch.setattr(settings, "DEBUG", debug)
        password_reset.send_reset_email("a@b.org", "http://x/s/reset-password?token=SECRET", "S", "u1")
        assert "could not be sent" in caplog.text
        assert ("SECRET" in caplog.text) is shown
