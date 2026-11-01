"""Tests for excuse documents, parent-submitted excuses and the review queue."""
import base64
import io
from datetime import UTC, date, datetime, timedelta

import pytest
from PIL import Image

from attendance_fixtures import TODAY, db, school  # noqa: F401  (fixtures)
from src.core.config import settings
from src.core.exceptions.business import BusinessRuleViolationError, PermissionDeniedError
from src.db.models.academics.attendance import AttendanceStatus
from src.db.models.academics.daily_attendance import AttendanceSource, ExcuseStatus
from src.schemas.academics.daily_attendance import (
    DailyStatusSet, ExcuseDocumentIn, ExcuseReview, ExcuseWithDocument, ParentExcuseCreate
)
from src.services.academics import qr_card_service
from src.services.academics.attendance_excuse_service import AttendanceExcuseService
from src.services.academics.attendance_scan_service import AttendanceScanService

THURSDAY = TODAY + timedelta(days=2)


def service_at(school, db, cls=AttendanceExcuseService, hour=7, on=TODAY):
    svc = cls(tenant=school["tenant_id"], db=db)
    svc.now_utc = lambda: datetime(on.year, on.month, on.day, hour, 0, tzinfo=UTC)
    return svc


def png_doc(size=(2400, 1200)) -> ExcuseDocumentIn:
    buf = io.BytesIO()
    Image.new("RGB", size, "white").save(buf, format="PNG")
    return ExcuseDocumentIn(filename="note.png", content_type="image/png",
                            data_base64=base64.b64encode(buf.getvalue()).decode())


def pdf_doc(data=b"%PDF-1.4\n%fake but valid header\n") -> ExcuseDocumentIn:
    return ExcuseDocumentIn(filename="letter.pdf", content_type="application/pdf",
                            data_base64=base64.b64encode(data).decode())


def parent_excuse(school, day=THURSDAY, reason="Dentist appointment", document=None, student=None):
    return ParentExcuseCreate(student_id=(student or school["students"][0]).id, date=day,
                              reason=reason, document=document)


# --- Parent submissions ------------------------------------------------------------------

def test_parent_reports_planned_absence_and_admin_approves(school, db):
    svc = service_at(school, db)
    rec = svc.submit_parent_excuse(parent_excuse(school, document=pdf_doc()), school["parent"])
    assert (rec.status, rec.source, rec.excuse_status) == (AttendanceStatus.ABSENT, AttendanceSource.MANUAL, ExcuseStatus.PENDING)
    assert rec.excuse_document_url.endswith(f"/daily/{rec.id}/excuse/document")

    queue = svc.list_excuses(school["admin"])
    assert [(q.student_id, q.has_document, q.excuse_status) for q in queue] == [
        (school["students"][0].id, True, ExcuseStatus.PENDING)]
    assert queue[0].submitted_by_name == f"{school['parent'].first_name} L"

    reviewed = svc.review_excuse(rec.id, ExcuseReview(approve=True), school["admin"])
    assert (reviewed.status, reviewed.excuse_status) == (AttendanceStatus.EXCUSED, ExcuseStatus.APPROVED)
    assert svc.list_excuses(school["admin"]) == []
    with pytest.raises(BusinessRuleViolationError, match="already excused"):
        svc.submit_parent_excuse(parent_excuse(school), school["parent"])


def test_parent_submission_rules(school, db):
    svc = service_at(school, db)
    with pytest.raises(PermissionDeniedError):  # not their child
        svc.submit_parent_excuse(parent_excuse(school, student=school["students"][1]), school["parent"])
    with pytest.raises(PermissionDeniedError):  # not a parent
        svc.submit_parent_excuse(parent_excuse(school), school["sponsor"])
    with pytest.raises(BusinessRuleViolationError, match="14 days"):
        svc.submit_parent_excuse(parent_excuse(school, day=TODAY - timedelta(days=15)), school["parent"])
    with pytest.raises(BusinessRuleViolationError, match="30 days"):
        svc.submit_parent_excuse(parent_excuse(school, day=TODAY + timedelta(days=31)), school["parent"])
    with pytest.raises(BusinessRuleViolationError, match="not a school day"):
        svc.submit_parent_excuse(parent_excuse(school, day=date(2026, 10, 24)), school["parent"])

    svc.set_status(school["students"][0].id, TODAY, DailyStatusSet(status="present"), school["sponsor"])
    with pytest.raises(BusinessRuleViolationError, match="marked present"):
        svc.submit_parent_excuse(parent_excuse(school, day=TODAY), school["parent"])


def test_auto_absent_day_can_be_excused_by_parent(school, db):
    s0 = school["students"][0]
    svc = service_at(school, db, hour=13)
    svc.get_roster(school["cls"].id, TODAY, school["sponsor"])  # auto absent
    rec = svc.submit_parent_excuse(parent_excuse(school, day=TODAY, reason="Fever"), school["parent"])
    assert (rec.source, rec.excuse_status, rec.student_id) == (AttendanceSource.AUTO, ExcuseStatus.PENDING, s0.id)
    assert svc.list_excuses(school["admin"])[0].submitted_by_name.startswith(school["parent"].first_name)


def test_pending_excuse_survives_sponsor_marks_until_excused(school, db):
    s0 = school["students"][0]
    svc = service_at(school, db)
    svc.submit_parent_excuse(parent_excuse(school, day=TODAY), school["parent"])

    rec = svc.set_status(s0.id, TODAY, DailyStatusSet(status="absent"), school["sponsor"])
    assert (rec.excuse_status, rec.excuse_reason) == (ExcuseStatus.PENDING, "Dentist appointment")

    rec = svc.set_status(s0.id, TODAY, DailyStatusSet(status="excused", excuse_reason="Confirmed by phone"), school["sponsor"])
    assert (rec.excuse_status, rec.excuse_reason) == (ExcuseStatus.APPROVED, "Confirmed by phone")


def test_child_who_turns_up_is_scanned_present_and_approval_keeps_it(school, db, monkeypatch):
    monkeypatch.setattr(settings, "ATTENDANCE_QR_SECRET", "s")
    s0 = school["students"][0]
    rec = service_at(school, db).submit_parent_excuse(parent_excuse(school, day=TODAY), school["parent"])

    scanner = service_at(school, db, cls=AttendanceScanService)
    result = scanner.scan(qr_card_service.build_token(school["tenant_id"], s0.id, 1), "check_in", None, school["admin"])
    assert (result.result, result.status) == ("accepted", AttendanceStatus.PRESENT)

    reviewed = service_at(school, db).review_excuse(rec.id, ExcuseReview(approve=True), school["admin"])
    assert (reviewed.status, reviewed.excuse_status) == (AttendanceStatus.PRESENT, ExcuseStatus.APPROVED)


def test_my_children(school, db):
    svc = service_at(school, db)
    children = svc.my_children(school["parent"])
    assert [(c.student_id, c.class_name) for c in children] == [(school["students"][0].id, "Grade 5 - A")]
    with pytest.raises(PermissionDeniedError):
        svc.my_children(school["sponsor"])


# --- Documents ---------------------------------------------------------------------------

def test_images_are_reencoded_and_shrunk(school, db):
    svc = service_at(school, db)
    rec = svc.submit_parent_excuse(parent_excuse(school, document=png_doc()), school["parent"])
    doc = svc.get_document(rec.id, school["parent"])
    assert (doc.filename, doc.content_type) == ("note.jpg", "image/jpeg")
    img = Image.open(io.BytesIO(base64.b64decode(doc.data_base64)))
    assert max(img.size) == 1600


@pytest.mark.parametrize("doc,message", [
    (lambda: pdf_doc(b"not really a pdf"), "not a valid PDF"),
    (lambda: ExcuseDocumentIn(filename="x.png", content_type="image/png", data_base64=base64.b64encode(b"garbage").decode()), "not a valid image"),
    (lambda: ExcuseDocumentIn(filename="x.pdf", content_type="application/pdf", data_base64="@@@"), "invalid base64"),
    (lambda: pdf_doc(b"%PDF-" + b"0" * (5 * 1024 * 1024)), "larger than 5 MB"),
])
def test_bad_documents_are_rejected(school, db, doc, message):
    with pytest.raises(BusinessRuleViolationError, match=message):
        service_at(school, db).submit_parent_excuse(parent_excuse(school, document=doc()), school["parent"])


def test_document_type_whitelist():
    with pytest.raises(ValueError, match="Only JPEG, PNG, WebP images or PDF"):
        ExcuseDocumentIn(filename="x.exe", content_type="application/x-msdownload", data_base64="AA==")


def test_who_can_read_a_document(school, db):
    s0 = school["students"][0]
    svc = service_at(school, db)
    rec = svc.set_status(s0.id, TODAY, DailyStatusSet(status="absent"), school["sponsor"])
    rec = svc.set_excuse_with_document(rec.id, ExcuseWithDocument(reason="Clinic", document=pdf_doc()), school["sponsor"])
    assert rec.excuse_status == ExcuseStatus.APPROVED and rec.excuse_document_url

    for reader in (school["sponsor"], school["admin"], school["parent"], s0):
        assert svc.get_document(rec.id, reader).content_type == "application/pdf"
    for outsider in (school["other_teacher"], school["students"][1]):
        with pytest.raises(PermissionDeniedError):
            svc.get_document(rec.id, outsider)


def test_review_queue_is_admin_only(school, db):
    with pytest.raises(PermissionDeniedError):
        service_at(school, db).list_excuses(school["sponsor"])
