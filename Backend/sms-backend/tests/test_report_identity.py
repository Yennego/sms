"""Report-card signatures, school seal and school profile (docs/remodel/phase4-design.md §6)."""
import base64
import io

import pytest
from PIL import Image, ImageDraw

from src.db.models.academics.gradebook import ResultPublication
from src.db.models.tenant.school_profile import UserSignature
from src.utils import report_images as ri

from test_gradebook import GB, _db, _publish, _seed
from test_security import env, headers  # noqa: F401  shared app + two-school fixture

SIG = "/api/v1/auth/me/signature"
PROFILE = "/api/v1/tenants/self/profile"


def _png(size=(1200, 500), color=(0, 0, 0, 255), bg=(255, 255, 255, 255), mode="RGBA", fmt="PNG", **save):
    img = Image.new(mode, size, bg if mode == "RGBA" else bg[:3])
    ImageDraw.Draw(img).line([(300, 250), (900, 300)], fill=color if mode == "RGBA" else color[:3], width=12)
    out = io.BytesIO()
    img.save(out, format=fmt, **save)
    return out.getvalue()


def _decode(url):
    assert url.startswith("data:image/png;base64,")
    return Image.open(io.BytesIO(base64.b64decode(url.split(",", 1)[1])))


def _upload(client, ids, who, data, url=SIG, name="sig.png", ctype="image/png"):
    return client.put(url, files={"file": (name, data, ctype)}, headers=headers(ids, who))


# --- image rules (no database) ---------------------------------------------------------------------

def test_signature_is_trimmed_scaled_and_stripped():
    exif = Image.Exif()
    exif[0x010F] = "Camera maker"
    raw = _png(fmt="JPEG", mode="RGB", exif=exif.tobytes(), quality=90)
    clean = ri.normalise_signature(raw)
    img = Image.open(io.BytesIO(clean.data))
    assert img.format == "PNG" and img.mode == "RGBA"
    assert img.width <= 600 and img.height <= 200 and (img.width, img.height) == (clean.width, clean.height)
    # the white margins are gone: the line spans almost the whole width
    assert img.width >= 590
    assert "exif" not in img.info and not img.getexif()
    # transparency survives
    transparent = ri.normalise_signature(_png(bg=(0, 0, 0, 0)))
    assert Image.open(io.BytesIO(transparent.data)).getpixel((0, 0))[3] == 0


def test_seal_fits_400_and_small_images_are_not_enlarged():
    seal = ri.normalise_seal(_png(size=(2000, 2000)))
    assert seal.width <= 400 and seal.height <= 400
    small = ri.normalise_seal(_png(size=(100, 80)))
    assert small.width <= 100 and small.height <= 80


@pytest.mark.parametrize("raw", [
    b"",
    b"GIF89a\x01\x00\x01\x00\x80\x00\x00\x00\x00\x00\xff\xff\xff!\xf9\x04\x00\x00\x00\x00\x00,\x00\x00\x00\x00"
    b"\x01\x00\x01\x00\x00\x02\x02D\x01\x00;",
    b"<svg xmlns='http://www.w3.org/2000/svg'></svg>",
    b"%PDF-1.4 not an image",
    b"\x89PNG\r\n\x1a\n" + b"\x00" * 64,  # a PNG header with nothing behind it
])
def test_non_images_and_other_types_are_rejected(raw):
    with pytest.raises(ri.ImageRejected) as err:
        ri.normalise_signature(raw)
    assert err.value.status_code == 422


def test_other_real_image_types_are_rejected():
    for fmt in ("GIF", "BMP", "WEBP", "TIFF"):
        out = io.BytesIO()
        Image.new("RGB", (50, 50), (0, 0, 0)).save(out, format=fmt)
        with pytest.raises(ri.ImageRejected):
            ri.normalise_signature(out.getvalue())


def test_oversized_blank_and_bomb_images_are_rejected(monkeypatch):
    with pytest.raises(ri.ImageRejected) as err:
        ri.normalise_signature(b"\x89PNG" + b"0" * ri.MAX_UPLOAD_BYTES)
    assert err.value.status_code == 413
    with pytest.raises(ri.ImageRejected, match="empty"):
        ri.normalise_signature(_png(color=(255, 255, 255, 255)))  # white on white
    monkeypatch.setattr(ri, "MAX_PIXELS", 1000)
    with pytest.raises(ri.ImageRejected, match="too many pixels"):
        ri.normalise_signature(_png())


# --- my signature ----------------------------------------------------------------------------------

def test_only_staff_set_their_own_signature_and_versions_are_kept(env):
    client, ids = env
    _seed(ids)
    assert client.get(SIG, headers=headers(ids, "sponsor")).json() == {
        "has_signature": False, "image": None, "updated_at": None}
    first = _upload(client, ids, "sponsor", _png())
    assert first.status_code == 200, first.text
    assert first.json()["has_signature"] is True and _decode(first.json()["image"]).format == "PNG"

    # A disguised file (text named .png, declared image/png) and an oversized upload
    assert _upload(client, ids, "sponsor", b"hello, not a picture").status_code == 422
    assert _upload(client, ids, "sponsor", _png(), name="sig.gif", ctype="image/gif").status_code == 200
    assert _upload(client, ids, "sponsor", b"\x89PNG" + b"0" * (ri.MAX_UPLOAD_BYTES + 10)).status_code == 413

    # Students and parents have no signature
    for who in ("student_a", "pupil0", "parent"):
        assert client.get(SIG, headers=headers(ids, who)).status_code == 403
        assert _upload(client, ids, who, _png()).status_code == 403

    # A new picture keeps the old one; delete clears only the current
    assert _upload(client, ids, "sponsor", _png(size=(900, 400))).status_code == 200
    gen, db = _db()
    rows = db.query(UserSignature).filter(UserSignature.user_id == ids["sponsor"]).all()
    assert len(rows) == 2 and sum(r.is_current for r in rows) == 1
    next(gen, None)
    assert client.delete(SIG, headers=headers(ids, "sponsor")).json()["has_signature"] is False
    assert client.get(SIG, headers=headers(ids, "sponsor")).json()["has_signature"] is False
    gen, db = _db()
    assert db.query(UserSignature).filter(UserSignature.user_id == ids["sponsor"]).count() == 2
    next(gen, None)


def test_audit_logs_image_uploads_without_their_bodies():
    from starlette.requests import Request
    from src.core.middleware.audit_middleware import AuditLoggingMiddleware

    mw = AuditLoggingMiddleware(app=None)

    def req(method, path):
        return Request({"type": "http", "method": method, "path": path, "headers": [], "query_string": b""})

    for path, entity in ((SIG, "signature"), (f"{PROFILE}/seal", "school_profile")):
        for method in ("PUT", "DELETE"):
            r = req(method, path)
            assert mw.should_log_request(r) and mw.is_no_body_path(r)
            assert mw.determine_action_and_entity(r)[1] == entity
    assert not mw.should_log_request(req("GET", SIG))
    assert not mw.is_no_body_path(req("PUT", PROFILE))  # the JSON profile is logged as usual
    assert not mw.should_log_request(req("POST", "/api/v1/auth/me"))


# --- school profile ---------------------------------------------------------------------------------

def test_school_profile_needs_manage_tenant_settings_and_a_staff_principal(env):
    client, ids = env
    _seed(ids)
    assert client.get(PROFILE, headers=headers(ids, "sponsor")).status_code == 403
    assert client.put(PROFILE, json={"motto": "x"}, headers=headers(ids, "academic")).status_code == 403
    assert _upload(client, ids, "sponsor", _png(), url=f"{PROFILE}/seal").status_code == 403

    empty = client.get(PROFILE, headers=headers(ids, "admin_a")).json()
    assert empty["principal_title"] == "Principal" and empty["seal"] is None

    # The principal must be active staff of this school
    for bad in (ids["admin_b"], ids["pupil0"], ids["parent"]):
        r = client.put(PROFILE, json={"principal_user_id": str(bad)}, headers=headers(ids, "admin_a"))
        assert r.status_code == 422, bad
    ok = client.put(PROFILE, json={"principal_user_id": str(ids["academic"]), "principal_title": "Headmaster",
                                   "motto": " Knowledge is light ", "address": "Broad Street", "email": "",
                                   "phone": "0770"}, headers=headers(ids, "admin_a"))
    assert ok.status_code == 200, ok.text
    body = ok.json()
    assert body["principal_title"] == "Headmaster" and body["motto"] == "Knowledge is light"
    assert body["principal_name"] and body["principal_has_signature"] is False and body["email"] is None

    seal = _upload(client, ids, "admin_a", _png(size=(1000, 1000)), url=f"{PROFILE}/seal")
    assert seal.status_code == 200, seal.text
    img = _decode(seal.json()["seal"])
    assert img.width <= 400 and img.height <= 400
    assert _upload(client, ids, "admin_a", b"<svg/>", url=f"{PROFILE}/seal", name="seal.png").status_code == 422

    # School B sees its own (empty) profile, never A's
    other = client.get(PROFILE, headers=headers(ids, "admin_b")).json()
    assert other["motto"] is None and other["seal"] is None and other["principal_user_id"] is None
    assert client.delete(f"{PROFILE}/seal", headers=headers(ids, "admin_a")).json()["seal"] is None


# --- report cards ------------------------------------------------------------------------------------

def test_publish_fixes_signatures_on_the_report_card(env):
    client, ids = env
    s = _seed(ids)
    card_url = f"{GB}/report-cards/students/{s['pupils'][0]}"
    client.put(PROFILE, json={"principal_user_id": str(ids["academic"]), "motto": "Light"},
               headers=headers(ids, "admin_a"))
    _upload(client, ids, "admin_a", _png(size=(500, 500)), url=f"{PROFILE}/seal")
    sponsor_v1 = _decode(_upload(client, ids, "sponsor", _png()).json()["image"]).tobytes()
    _upload(client, ids, "academic", _png(size=(800, 300)))

    # Nothing published: school block, no signatures (staff preview and student alike)
    staff = client.get(card_url, headers=headers(ids, "admin_a")).json()
    assert staff["school"]["name"] == "School A" and staff["school"]["motto"] == "Light"
    assert staff["school"]["seal"].startswith("data:image/png;base64,")
    assert staff["signatures"] == {"sponsor": None, "principal": None}
    assert client.get(card_url, headers=headers(ids, "pupil0")).json()["signatures"] == \
        {"sponsor": None, "principal": None}

    assert _publish(client, ids, s, period=0).status_code == 201
    gen, db = _db()
    pub = db.query(ResultPublication).one()
    assert pub.sponsor_user_id == ids["sponsor"] and pub.principal_user_id == ids["academic"]
    assert pub.sponsor_signature_id and pub.principal_signature_id
    next(gen, None)

    for who in ("pupil0", "parent", "admin_a", "sponsor"):
        card = client.get(card_url, headers=headers(ids, who)).json()
        sig = card["signatures"]
        assert sig["sponsor"]["title"] == "Class sponsor" and sig["sponsor"]["name"]
        assert sig["principal"]["title"] == "Principal" and sig["principal"]["image"]
    cards = client.get(f"{GB}/report-cards/classes/{s['class']}", headers=headers(ids, "sponsor")).json()["items"]
    assert all(c["signatures"]["sponsor"] for c in cards)

    # Later changes don't alter the published card
    _upload(client, ids, "sponsor", _png(size=(700, 700), color=(200, 0, 0, 255)))
    client.delete(SIG, headers=headers(ids, "academic"))
    client.put(PROFILE, json={"principal_user_id": str(ids["math_t"])}, headers=headers(ids, "admin_a"))
    card = client.get(card_url, headers=headers(ids, "parent")).json()
    assert _decode(card["signatures"]["sponsor"]["image"]).tobytes() == sponsor_v1
    assert card["signatures"]["principal"]["image"]
    assert card["signatures"]["principal"]["name"] != card["signatures"]["sponsor"]["name"]

    # Signature images never appear in list endpoints
    listed = client.get(f"{GB}/publications", headers=headers(ids, "admin_a")).text
    assert "base64" not in listed
    assert "base64" not in client.get("/api/v1/auth/me", headers=headers(ids, "sponsor")).text

    # Unpublishing removes the signatures again; another school gets 404
    client.delete(f"{GB}/publications?class_id={s['class']}&period_id={s['periods'][0]}",
                  headers=headers(ids, "academic"))
    assert client.get(card_url, headers=headers(ids, "pupil0")).json()["signatures"]["sponsor"] is None
    assert client.get(card_url, headers=headers(ids, "admin_b")).status_code == 404


def test_publication_without_signatures_prints_blank_lines(env):
    client, ids = env
    s = _seed(ids)
    assert _publish(client, ids, s, period=0).status_code == 201
    card = client.get(f"{GB}/report-cards/students/{s['pupils'][0]}", headers=headers(ids, "pupil0")).json()
    assert card["signatures"] == {"sponsor": None, "principal": None}
    assert card["school"]["seal"] is None and card["school"]["address"] is None


def test_school_logo_upload_is_served_publicly(env):
    """The logo is uploaded like the seal; tenants.logo then points at the public image, so the
    sign-in page, header, receipts and report cards show it without changes."""
    client, ids = env
    a = ids["tenant_a"]
    assert _upload(client, ids, "student_a", _png(), url=f"{PROFILE}/logo").status_code == 403
    assert _upload(client, ids, "admin_a", b"<svg/>", url=f"{PROFILE}/logo", name="logo.png").status_code == 422

    r = _upload(client, ids, "admin_a", _png(size=(1000, 1000)), url=f"{PROFILE}/logo", name="logo.png")
    assert r.status_code == 200, r.text
    logo = r.json()["logo"]
    assert logo.startswith(f"/api/v1/tenants/{a}/logo?v=") and r.json()["logo_uploaded"] is True

    served = client.get(f"/api/v1/tenants/{a}/logo")  # no sign-in
    assert served.status_code == 200 and served.headers["content-type"] == "image/png"
    img = Image.open(io.BytesIO(served.content))
    assert img.width <= 400 and img.height <= 400
    assert client.get(f"/api/v1/tenants/{ids['tenant_b']}/logo").status_code == 404
    assert client.get("/api/v1/tenants/by-domain/", params={"domain": "school-a"}).json()["logo"] == logo

    cleared = client.delete(f"{PROFILE}/logo", headers=headers(ids, "admin_a")).json()
    assert cleared["logo"] is None and cleared["logo_uploaded"] is False
    assert client.get(f"/api/v1/tenants/{a}/logo").status_code == 404
