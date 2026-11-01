"""Report card verification QR (phase4-design.md §7): codes, snapshots, the public check."""
import pytest
from starlette.requests import Request

import main
import src.core.redis as redis_module
from src.core.config import settings
from src.core.security.client_ip import client_ip
from src.db.session import get_db, get_super_admin_db
from src.services.academics import report_card_verification_service as rcv

from test_security import env, headers  # noqa: F401  shared app + two-school fixture
from test_gradebook import GB, _fill_semester_one, _publish, _scores, _seed

VERIFY = "/api/v1/verify/report-cards"


@pytest.fixture(autouse=True)
def _no_redis(monkeypatch):
    """Use the in-process rate limit, fresh for every test."""
    monkeypatch.setattr(redis_module, "REDIS_AVAILABLE", False)
    rcv._memory_hits.clear()
    yield
    rcv._memory_hits.clear()


@pytest.fixture
def app(env):  # noqa: F811
    client, ids = env
    main.app.dependency_overrides[get_super_admin_db] = main.app.dependency_overrides[get_db]
    return client, ids


def _card(client, ids, s, who, pupil=0):
    r = client.get(f"{GB}/report-cards/students/{s['pupils'][pupil]}", headers=headers(ids, who))
    assert r.status_code == 200, r.text
    return r.json()


# --- codes ---------------------------------------------------------------------------------------------

def test_codes_are_crockford_and_lookups_normalise():
    codes = {rcv.new_code() for _ in range(200)}
    assert len(codes) == 200
    assert all(len(c) == 12 and set(c) <= set(rcv.ALPHABET) for c in codes)
    assert not set("ILOU") & set(rcv.ALPHABET)
    assert rcv.display("ABCD0123WXYZ") == "ABCD-0123-WXYZ"
    assert rcv.normalise("abcd-0123-wxyz") == "ABCD0123WXYZ"
    assert rcv.normalise(" ABCD 0123 WXYZ ") == "ABCD0123WXYZ"
    assert rcv.normalise("ABCDO123WXYZ") == "ABCD0123WXYZ"  # O read as 0
    assert rcv.normalise("ABCDIL23WXYZ") == "ABCD1123WXYZ"  # I and L read as 1
    for bad in ("", "ABCD", "ABCD0123WXYZ0", "ABCDU123WXYZ", "ABCD*123WXYZ", None, "x" * 100):
        assert rcv.normalise(bad) is None


# --- issuing -------------------------------------------------------------------------------------------

def test_verification_only_for_published_results(app):
    client, ids = app
    s = _seed(ids)
    _fill_semester_one(client, ids, s)

    # Nothing published: no code for anyone, staff included (drafts never get one)
    assert _card(client, ids, s, "pupil0")["verification"] is None
    assert _card(client, ids, s, "academic")["verification"] is None
    assert all(c["verification"] is None for c in client.get(
        f"{GB}/report-cards/classes/{s['class']}", headers=headers(ids, "sponsor")).json()["items"])

    _publish(client, ids, s, period=0)
    parent = _card(client, ids, s, "parent")["verification"]
    assert parent is not None and len(parent["code"]) == 12
    assert parent["display_code"] == rcv.display(parent["code"])
    assert parent["url"] == f"{settings.FRONTEND_URL}/verify/{parent['code']}"
    assert parent["qr_svg"].lstrip().startswith("<svg")
    # Staff see unpublished columns, but the snapshot is the published one: same code
    assert _card(client, ids, s, "academic")["verification"]["code"] == parent["code"]
    assert _card(client, ids, s, "pupil0")["verification"]["code"] == parent["code"]
    cards = client.get(f"{GB}/report-cards/classes/{s['class']}", headers=headers(ids, "sponsor")).json()["items"]
    assert len({c["verification"]["code"] for c in cards}) == 3

    # The public check shows the published period only
    body = client.get(f"{VERIFY}/{parent['code']}").json()
    math = next(x for x in body["subjects"] if x["name"] == "Math")
    assert body["status"] == "valid" and math["semester_averages"] == [None, None]


def test_same_snapshot_same_code_and_changes_supersede(app):
    client, ids = app
    s = _seed(ids)
    _fill_semester_one(client, ids, s)
    _publish(client, ids, s, period=0)
    first = _card(client, ids, s, "pupil0")["verification"]["code"]
    assert _card(client, ids, s, "pupil0")["verification"]["code"] == first  # reused

    # A correction: unpublish, change the mark, publish again
    url = f"{GB}/publications?class_id={s['class']}&period_id={s['periods'][0]}"
    assert client.delete(url, headers=headers(ids, "academic")).status_code == 200
    sheet = client.get(f"{GB}/assessments?class_subject_id={s['cs_math']}&period_id={s['periods'][0]}",
                       headers=headers(ids, "math_t")).json()
    assert _scores(client, ids, sheet[0]["id"], [{"student_id": str(s["pupils"][0]), "score": 95}]).status_code == 200
    _publish(client, ids, s, period=0)
    second = _card(client, ids, s, "pupil0")["verification"]["code"]
    assert second != first

    old = client.get(f"{VERIFY}/{first}").json()
    new = client.get(f"{VERIFY}/{rcv.display(second).lower()}").json()  # typed form works too
    assert old["status"] == "superseded" and old["superseded_at"] == new["issued_at"]
    assert new["status"] == "valid" and new["superseded_at"] is None
    assert next(x for x in old["subjects"] if x["name"] == "Math")["semester_averages"] == [None, None]

    # Another pupil's card didn't change: still one code
    other = _card(client, ids, s, "academic", pupil=1)["verification"]["code"]
    assert client.get(f"{VERIFY}/{other}").json()["status"] == "valid"


def test_public_check_shows_only_the_listed_fields(app):
    client, ids = app
    s = _seed(ids)
    _fill_semester_one(client, ids, s)
    for period in range(3):
        _publish(client, ids, s, period=period)
    _publish(client, ids, s, semester=0)
    code = _card(client, ids, s, "parent")["verification"]["code"]

    r = client.get(f"{VERIFY}/{code}")  # no session, no school
    assert r.status_code == 200
    body = r.json()
    assert set(body) == {"status", "school", "student", "class_name", "year_name", "issued_at", "superseded_at",
                         "subjects", "overall"}
    assert body["status"] == "valid"
    assert body["school"] == {"name": "School A", "logo": None}
    assert set(body["student"]) == {"name", "admission_number"} and body["student"]["admission_number"] == "S0"
    assert body["class_name"] == "Grade 5 - A" and body["year_name"] == "2026/2027"
    assert all(set(x) == {"name", "semester_averages", "yearly_average", "passed"} for x in body["subjects"])
    math = next(x for x in body["subjects"] if x["name"] == "Math")
    assert math == {"name": "Math", "semester_averages": [65, None], "yearly_average": 65, "passed": False}
    assert set(body["overall"]) == {"semester_averages", "yearly_average", "rank", "class_size"}
    assert body["overall"]["rank"] == 2 and body["overall"]["class_size"] == 3
    text = r.text
    assert str(s["pupils"][0]) not in text and str(ids["tenant_a"]) not in text  # no ids leak
    assert "attendance" not in text


def test_unknown_and_malformed_codes_look_the_same(app):
    client, _ = app
    unknown = client.get(f"{VERIFY}/{rcv.new_code()}")
    malformed = client.get(f"{VERIFY}/not-a-code!")
    assert unknown.status_code == malformed.status_code == 200
    assert unknown.json() == malformed.json() == rcv.not_found()
    assert unknown.json()["status"] == "not_found"


# --- rate limit and the trusted client address ---------------------------------------------------------

def test_public_check_is_rate_limited_per_address(app, monkeypatch):
    client, _ = app
    monkeypatch.setattr(rcv, "VERIFY_PER_IP", 2)
    url = f"{VERIFY}/{rcv.new_code()}"
    assert client.get(url).status_code == 200
    assert client.get(url).status_code == 200
    assert client.get(url).status_code == 429
    # A made-up X-Client-IP is ignored without the proxy secret
    assert client.get(url, headers={"X-Client-IP": "203.0.113.9"}).status_code == 429
    monkeypatch.setattr(settings, "PROXY_SHARED_SECRET", "s3cret-value")
    assert client.get(url, headers={"X-Client-IP": "203.0.113.9", "X-Proxy-Secret": "wrong"}).status_code == 429
    # The BFF, with the secret, names the browser's address: counted separately
    ok = {"X-Client-IP": "203.0.113.9", "X-Proxy-Secret": "s3cret-value"}
    assert client.get(url, headers=ok).status_code == 200


def _request(headers, host="10.0.0.1"):
    return Request({"type": "http", "headers": [(k.lower().encode(), v.encode()) for k, v in headers.items()],
                    "client": (host, 1234)})


def test_client_ip_trusts_the_header_only_with_the_secret(monkeypatch):
    monkeypatch.setattr(settings, "PROXY_SHARED_SECRET", "")
    spoof = {"X-Client-IP": "1.2.3.4", "X-Proxy-Secret": ""}
    assert client_ip(_request(spoof)) == "10.0.0.1"  # setting empty: never trusted
    monkeypatch.setattr(settings, "PROXY_SHARED_SECRET", "abc")
    assert client_ip(_request({"X-Client-IP": "1.2.3.4"})) == "10.0.0.1"
    assert client_ip(_request({"X-Client-IP": "1.2.3.4", "X-Proxy-Secret": "abd"})) == "10.0.0.1"
    assert client_ip(_request({"X-Client-IP": "1.2.3.4", "X-Proxy-Secret": "abc"})) == "1.2.3.4"


def test_login_ignores_a_spoofed_client_ip(app, monkeypatch):
    """The login limit counts the real address when X-Client-IP comes without the secret."""
    from src.api.v1.endpoints.auth import auth as auth_module

    seen = []

    class Pipe:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *a):
            return False

        async def incr(self, key):
            seen.append(key)

        async def expire(self, *a):
            pass

        async def get(self, *a):
            pass

        async def execute(self):
            return [1, True, None]

    class Client:
        def pipeline(self):
            return Pipe()

    async def fake_cache():
        return Client()

    monkeypatch.setattr(auth_module, "_login_cache", fake_cache)
    monkeypatch.setattr(settings, "PROXY_SHARED_SECRET", "abc")
    client, _ = app
    client.post("/api/v1/auth/login", data={"username": "x@y.org", "password": "nope"},
                headers={"X-Client-IP": "198.51.100.7"})
    client.post("/api/v1/auth/login", data={"username": "x@y.org", "password": "nope"},
                headers={"X-Client-IP": "198.51.100.7", "X-Proxy-Secret": "abc"})
    attempts = [k for k in seen if k.startswith("login_attempts:")]
    assert attempts == ["login_attempts:testclient", "login_attempts:198.51.100.7"]
