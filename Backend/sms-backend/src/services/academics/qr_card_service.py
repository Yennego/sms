"""Signed QR tokens for student ID cards (implementation guide, section 6.4.1).

Token format (ASCII, ~80 chars):

    SMS1.<tenant_id b64>.<student_id b64>.<card_version>.<signature>

where the UUIDs are 16-byte base64url (no padding) and
signature = base64url(HMAC_SHA256(ATTENDANCE_QR_SECRET, "SMS1.<tenant>.<student>.<version>"))[:22].

The card holds no personal data; a photocopied admission number can't be used to
check in, and reissuing a card (version + 1) revokes the old one.
"""
import base64
import hashlib
import hmac
from dataclasses import dataclass
from typing import Optional
from uuid import UUID

from src.core.config import settings
from src.core.exceptions.business import BusinessRuleViolationError

PREFIX = "SMS1"
SIGNATURE_LENGTH = 22  # 132 bits of the HMAC


class QRNotConfiguredError(BusinessRuleViolationError):
    def __init__(self):
        super().__init__("QR ID cards are not configured: set ATTENDANCE_QR_SECRET on the server")


@dataclass(frozen=True)
class DecodedToken:
    tenant_id: UUID
    student_id: UUID
    card_version: int


class InvalidToken(Exception):
    """The token is malformed or its signature doesn't match."""


def _secret(secret: Optional[str] = None) -> bytes:
    value = secret if secret is not None else settings.ATTENDANCE_QR_SECRET
    if not value:
        raise QRNotConfiguredError()
    return value.encode()


def _b64(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode()


def _unb64(text: str) -> bytes:
    return base64.urlsafe_b64decode(text + "=" * (-len(text) % 4))


def _sign(payload: str, secret: bytes) -> str:
    return _b64(hmac.new(secret, payload.encode(), hashlib.sha256).digest())[:SIGNATURE_LENGTH]


def build_token(tenant_id: UUID, student_id: UUID, card_version: int, secret: Optional[str] = None) -> str:
    payload = f"{PREFIX}.{_b64(tenant_id.bytes)}.{_b64(student_id.bytes)}.{int(card_version)}"
    return f"{payload}.{_sign(payload, _secret(secret))}"


def verify_token(token: str, secret: Optional[str] = None) -> DecodedToken:
    """Check the signature and decode. Raises InvalidToken; tenant, revocation and
    student status are checked by the caller against the database."""
    key = _secret(secret)
    parts = (token or "").strip().split(".")
    if len(parts) != 5 or parts[0] != PREFIX:
        raise InvalidToken("Not a school ID card")
    payload, signature = ".".join(parts[:4]), parts[4]
    if not hmac.compare_digest(_sign(payload, key), signature):
        raise InvalidToken("Signature mismatch")
    try:
        return DecodedToken(
            tenant_id=UUID(bytes=_unb64(parts[1])),
            student_id=UUID(bytes=_unb64(parts[2])),
            card_version=int(parts[3]),
        )
    except (ValueError, TypeError) as exc:
        raise InvalidToken("Malformed card data") from exc


def qr_svg(token: str, scale: int = 4) -> str:
    """The token as an inline SVG QR code (error correction M, quiet zone included)."""
    import segno

    return segno.make_qr(token, error="m").svg_inline(scale=scale, border=2, dark="#000", light="#fff")
