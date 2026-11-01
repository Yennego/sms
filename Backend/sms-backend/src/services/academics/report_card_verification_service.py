"""Report card verification QR (docs/remodel/phase4-design.md §7).

When a report card is produced for a class with published results, the published results it
shows are stored as a snapshot under a random code; the printed QR links to
{FRONTEND_URL}/verify/{code}. The same snapshot keeps its code; when the published results change
(a correction after unpublishing), a new record is made and the previous one is marked
superseded. Drafts never get a code: the snapshot is always built from published results only,
whoever is looking at the card.

Codes: 12 characters of Crockford base32 (no I, L, O, U), from `secrets`, stored uppercase without
dashes, shown as XXXX-XXXX-XXXX. Lookups accept any case, dashes and spaces, and read O as 0 and
I/L as 1.
"""
import hashlib
import json
import logging
import secrets
import time
from datetime import UTC, datetime
from typing import Any, Dict, Optional
from uuid import UUID

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from src.core.config import settings
from src.db.models.academics.gradebook import ReportCardVerification
from src.services.academics import results_service as rs

logger = logging.getLogger(__name__)

ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"
CODE_LENGTH = 12
_LOOKALIKES = str.maketrans({"O": "0", "I": "1", "L": "1"})


def new_code() -> str:
    return "".join(secrets.choice(ALPHABET) for _ in range(CODE_LENGTH))


def normalise(raw: Any) -> Optional[str]:
    """The stored form of a typed or scanned code, or None when it can't be one."""
    if not isinstance(raw, str) or len(raw) > 40:
        return None
    code = raw.upper().replace("-", "").replace(" ", "").translate(_LOOKALIKES)
    if len(code) != CODE_LENGTH or any(c not in ALPHABET for c in code):
        return None
    return code


def display(code: str) -> str:
    return "-".join(code[i:i + 4] for i in range(0, len(code), 4))


def verify_url(code: str) -> str:
    return f"{settings.FRONTEND_URL}/verify/{code}"


# --- snapshot ---------------------------------------------------------------------------------------

def has_publications(results: "rs.ClassResults") -> bool:
    return bool(results.published_periods or results.published_semesters)


def build_snapshot(results: "rs.ClassResults", enrollment: Any, *, student: Any, year: Any,
                   pass_mark: int) -> Dict[str, Any]:
    """What the card shows from published results (results must be published_only)."""
    assert results.published_only
    data = results.student(enrollment.student_id)
    subjects = []
    for cs in results.class_subjects:
        r = data["subjects"][cs.id]
        yearly = r["yearly_average"]
        subjects.append({
            "name": cs.subject.name if cs.subject else None,
            "semesters": [{"number": s["number"], "periods": [rs.transport(v) for v in s["periods"]],
                           "exam": rs.transport(s["exam"]), "average": rs.transport(s["average"])}
                          for s in r["semesters"]],
            "yearly_average": rs.transport(yearly),
            "passed": None if yearly is None else yearly >= pass_mark,
        })
    roster_ids = {e.student_id for e in results.roster}
    return {
        "student": {"name": rs.person_name(student), "admission_number": getattr(student, "admission_number", None)},
        "class_name": results.cls.name,
        "year_name": year.name,
        "pass_mark": pass_mark,
        "subjects": subjects,
        "overall": {
            "semester_averages": [rs.transport(v) for v in data["semester_averages"]],
            "yearly_average": rs.transport(data["yearly_average"]),
            "rank": results.ranks().get(enrollment.student_id) if enrollment.student_id in roster_ids else None,
            "class_size": len(results.roster),
        },
    }


def snapshot_hash(snapshot: Dict[str, Any]) -> str:
    canonical = json.dumps(snapshot, sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(canonical.encode()).hexdigest()


def issue(db: Session, tenant_id: UUID, student_id: UUID, academic_year_id: UUID,
          snapshot: Dict[str, Any]) -> ReportCardVerification:
    """The current record for this snapshot: reused when unchanged, otherwise a new one (and the
    previous one superseded). Flushes only."""
    digest = snapshot_hash(snapshot)
    for _ in range(3):
        current = db.query(ReportCardVerification).filter(
            ReportCardVerification.tenant_id == tenant_id,
            ReportCardVerification.student_id == student_id,
            ReportCardVerification.academic_year_id == academic_year_id,
            ReportCardVerification.superseded_at.is_(None),
        ).first()
        if current is not None and current.snapshot_hash == digest:
            return current
        now = datetime.now(UTC)
        try:
            with db.begin_nested():
                if current is not None:
                    current.superseded_at = now
                    db.flush()
                record = ReportCardVerification(
                    tenant_id=tenant_id, student_id=student_id, academic_year_id=academic_year_id,
                    code=new_code(), snapshot=snapshot, snapshot_hash=digest, issued_at=now,
                )
                db.add(record)
                db.flush()
            return record
        except IntegrityError:
            # Another request issued one at the same moment (or, vanishingly rarely, the code
            # was taken): look again
            db.expire_all()
    raise RuntimeError("Could not issue a report card verification code")


def verification_block(record: ReportCardVerification) -> Dict[str, Any]:
    from src.services.academics.qr_card_service import qr_svg

    url = verify_url(record.code)
    return {"code": record.code, "display_code": display(record.code), "url": url, "qr_svg": qr_svg(url)}


# --- public check -------------------------------------------------------------------------------------

def not_found() -> Dict[str, Any]:
    return {"status": "not_found", "school": None, "student": None, "class_name": None, "year_name": None,
            "issued_at": None, "superseded_at": None, "subjects": [], "overall": None}


def public_result(db: Session, raw_code: Any) -> Dict[str, Any]:
    """The public answer for a code. `db` must see every school (platform session); only the
    matching card's data is read and only the fields listed in §7 are returned."""
    from src.db.models.tenant.tenant import Tenant

    code = normalise(raw_code)
    if code is None:
        return not_found()
    record = db.query(ReportCardVerification).filter(ReportCardVerification.code == code).first()
    if record is None:
        return not_found()
    tenant = db.query(Tenant).filter(Tenant.id == record.tenant_id).first()
    if tenant is None or not getattr(tenant, "is_active", True):
        return not_found()
    snap = record.snapshot or {}
    student = snap.get("student") or {}
    overall = snap.get("overall") or {}
    return {
        "status": "superseded" if record.superseded_at else "valid",
        "school": {"name": tenant.name, "logo": getattr(tenant, "logo", None)},
        "student": {"name": student.get("name"), "admission_number": student.get("admission_number")},
        "class_name": snap.get("class_name"),
        "year_name": snap.get("year_name"),
        "issued_at": record.issued_at,
        "superseded_at": record.superseded_at,
        "subjects": [
            {"name": s.get("name"),
             "semester_averages": [x.get("average") for x in s.get("semesters", [])],
             "yearly_average": s.get("yearly_average"),
             "passed": s.get("passed")}
            for s in snap.get("subjects", [])
        ],
        "overall": {
            "semester_averages": overall.get("semester_averages"),
            "yearly_average": overall.get("yearly_average"),
            "rank": overall.get("rank"),
            "class_size": overall.get("class_size"),
        },
    }


# --- per-IP rate limit for the public check -------------------------------------------------------------

VERIFY_WINDOW_SECONDS = 600
VERIFY_PER_IP = 60
_memory_hits: Dict[str, list] = {}


def _memory_count(key: str) -> int:
    """Fallback when Redis is unavailable: a per-process sliding window."""
    now = time.monotonic()
    hits = [t for t in _memory_hits.get(key, []) if now - t < VERIFY_WINDOW_SECONDS]
    hits.append(now)
    _memory_hits[key] = hits
    if len(_memory_hits) > 10000:  # keep memory bounded
        for k in list(_memory_hits)[:5000]:
            _memory_hits.pop(k, None)
    return len(hits)


async def hit(ip: str) -> int:
    """Count this check for the address; returns the count in the current window."""
    from src.core.redis import REDIS_AVAILABLE, cache

    key = f"verify_attempts:{ip}"
    if REDIS_AVAILABLE:
        try:
            if not cache.client:
                await cache.connect()
            if cache.client:
                async with cache.client.pipeline() as pipe:
                    await pipe.incr(key)
                    await pipe.expire(key, VERIFY_WINDOW_SECONDS)
                    count, _ = await pipe.execute()
                return int(count)
        except Exception as e:  # Redis trouble must not open the endpoint up
            logger.warning("verify rate limit: Redis unavailable (%s); using in-process limit", e)
    return _memory_count(key)
