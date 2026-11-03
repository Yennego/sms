"""Signatures, school seal and school profile on report cards (docs/remodel/phase4-design.md §6).

- A signature belongs to its owner: only the signed-in staff member sets or clears their own.
  Every upload is a new user_signatures row; the previous one stays (is_current false) because
  published report cards point at it.
- Publishing records the class sponsor's and the principal's current signatures on the
  publication; report cards show the signatures of the class's latest publication.
- The school profile (address, motto, phone, email, principal, seal) needs
  manage_tenant_settings; the principal must be an active staff member of the same school.

Images never leave the server except as data URLs inside these responses and report cards; they
are not logged. Every query filters by school; changes are flushed only.
"""
from datetime import datetime, UTC
from typing import Any, Dict, Optional
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session, defer

from src.db.models.auth.user import User
from src.db.models.tenant.school_profile import SchoolProfile, UserSignature
from src.db.models.tenant.tenant import Tenant
from src.utils import report_images

NON_STAFF_TYPES = ("student", "parent")
SPONSOR_TITLE = "Class sponsor"
DEFAULT_PRINCIPAL_TITLE = "Principal"
PROFILE_FIELDS = ("address", "motto", "phone", "email", "principal_user_id", "principal_title")


def _uuid(value) -> UUID:
    return value if isinstance(value, UUID) else UUID(str(value))


def is_staff(user: Any) -> bool:
    return user is not None and getattr(user, "type", None) not in NON_STAFF_TYPES


def person_name(user: Any) -> Optional[str]:
    if user is None:
        return None
    return f"{user.first_name or ''} {user.last_name or ''}".strip() or None


def image_error(err: report_images.ImageRejected) -> HTTPException:
    return HTTPException(status_code=err.status_code, detail=err.message)


def current_signature(db: Session, tenant_id, user_id, *, with_image: bool = False) -> Optional[UserSignature]:
    if user_id is None:
        return None
    q = db.query(UserSignature).filter(UserSignature.tenant_id == _uuid(tenant_id),
                                       UserSignature.user_id == user_id,
                                       UserSignature.is_current == True)  # noqa: E712
    if not with_image:
        q = q.options(defer(UserSignature.image))
    return q.first()


# --- my signature -------------------------------------------------------------------------------

class SignatureService:
    """The signed-in user's own signature. Students and parents have none (403)."""

    def __init__(self, db: Session, tenant_id, user: Any):
        self.db, self.tenant_id, self.user = db, _uuid(tenant_id), user
        if not is_staff(user):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                                detail="Only staff members can keep a signature")
        if str(getattr(user, "tenant_id", None)) != str(self.tenant_id):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                                detail="A signature can only be kept at your own school")

    def _out(self, sig: Optional[UserSignature]) -> Dict[str, Any]:
        if sig is None:
            return {"has_signature": False, "image": None, "updated_at": None}
        return {"has_signature": True, "image": report_images.data_url(sig.image), "updated_at": sig.created_at}

    def get(self) -> Dict[str, Any]:
        return self._out(current_signature(self.db, self.tenant_id, self.user.id, with_image=True))

    def set(self, raw: bytes) -> Dict[str, Any]:
        try:
            clean = report_images.normalise_signature(raw)
        except report_images.ImageRejected as err:
            raise image_error(err)
        current = current_signature(self.db, self.tenant_id, self.user.id, with_image=True)
        if current is not None and current.sha256 == clean.sha256:
            return self._out(current)  # same picture again: nothing new to keep
        if current is not None:
            current.is_current = False
            self.db.flush()  # one current signature per user (partial unique index)
        sig = UserSignature(tenant_id=self.tenant_id, user_id=self.user.id, image=clean.data, width=clean.width,
                            height=clean.height, sha256=clean.sha256, is_current=True)
        self.db.add(sig)
        self.db.flush()
        return self._out(sig)

    def clear(self) -> Dict[str, Any]:
        current = current_signature(self.db, self.tenant_id, self.user.id)
        if current is not None:
            current.is_current = False  # kept: published report cards still show it
            self.db.flush()
        return self._out(None)


# --- school profile ------------------------------------------------------------------------------

class SchoolProfileService:
    """GET/PUT /tenants/self/profile and its seal; the caller holds manage_tenant_settings."""

    def __init__(self, db: Session, tenant_id):
        self.db, self.tenant_id = db, _uuid(tenant_id)

    def row(self, create: bool = False) -> Optional[SchoolProfile]:
        row = self.db.query(SchoolProfile).filter(SchoolProfile.tenant_id == self.tenant_id).first()
        if row is None and create:
            row = SchoolProfile(tenant_id=self.tenant_id, principal_title=DEFAULT_PRINCIPAL_TITLE)
            self.db.add(row)
            self.db.flush()
        return row

    def out(self) -> Dict[str, Any]:
        row = self.row()
        principal = self._user(row.principal_user_id) if row and row.principal_user_id else None
        logo = self._tenant().logo
        return {
            "address": row.address if row else None,
            "motto": row.motto if row else None,
            "phone": row.phone if row else None,
            "email": row.email if row else None,
            "principal_user_id": row.principal_user_id if row else None,
            "principal_name": person_name(principal),
            "principal_title": (row.principal_title if row else None) or DEFAULT_PRINCIPAL_TITLE,
            "principal_has_signature": principal is not None and current_signature(
                self.db, self.tenant_id, principal.id) is not None,
            "seal": report_images.data_url(row.seal_image) if row else None,
            "logo": logo,
            "logo_uploaded": logo.startswith(self._logo_url()) if logo else False,
            "updated_at": row.updated_at if row else None,
        }

    def _user(self, user_id) -> Optional[User]:
        return self.db.query(User).filter(User.tenant_id == self.tenant_id, User.id == user_id).first()

    def update(self, data: Dict[str, Any]) -> Dict[str, Any]:
        if "principal_user_id" in data and data["principal_user_id"] is not None:
            user = self._user(data["principal_user_id"])
            if user is None or not user.is_active or not is_staff(user):
                raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                                    detail="The principal must be an active staff member of this school")
        row = self.row(create=True)
        for key in PROFILE_FIELDS:
            if key in data:
                value = data[key]
                if isinstance(value, str):
                    value = value.strip() or None
                if key == "principal_title":
                    value = value or DEFAULT_PRINCIPAL_TITLE
                setattr(row, key, value)
        row.updated_at = datetime.now(UTC)
        self.db.flush()
        return self.out()

    def set_seal(self, raw: bytes) -> Dict[str, Any]:
        try:
            clean = report_images.normalise_seal(raw)
        except report_images.ImageRejected as err:
            raise image_error(err)
        row = self.row(create=True)
        row.seal_image = clean.data
        row.updated_at = datetime.now(UTC)
        self.db.flush()
        return self.out()

    # The logo lives on the tenant (shown on the sign-in page, the app header, receipts and report
    # cards through tenants.logo); an upload makes tenants.logo point at GET /tenants/{id}/logo.

    def _tenant(self) -> Tenant:
        return self.db.query(Tenant).filter(Tenant.id == self.tenant_id).one()

    def _logo_url(self, version: Optional[datetime] = None) -> str:
        url = f"/api/v1/tenants/{self.tenant_id}/logo"
        return f"{url}?v={int(version.timestamp())}" if version else url

    def set_logo(self, raw: bytes) -> Dict[str, Any]:
        try:
            clean = report_images.normalise_logo(raw)
        except report_images.ImageRejected as err:
            raise image_error(err)
        tenant = self._tenant()
        tenant.logo_image = clean.data
        tenant.logo = self._logo_url(datetime.now(UTC))  # a new address, so browsers don't show the old one
        self.db.flush()
        return self.out()

    def clear_logo(self) -> Dict[str, Any]:
        """Removes an uploaded logo; a logo given as a web address (School settings) stays."""
        tenant = self._tenant()
        if tenant.logo_image is not None or (tenant.logo or "").startswith(self._logo_url()):
            tenant.logo_image = None
            if (tenant.logo or "").startswith(self._logo_url()):
                tenant.logo = None
            self.db.flush()
        return self.out()

    def clear_seal(self) -> Dict[str, Any]:
        row = self.row()
        if row is not None and row.seal_image is not None:
            row.seal_image = None
            row.updated_at = datetime.now(UTC)
            self.db.flush()
        return self.out()


# --- publication and report cards ---------------------------------------------------------------

def signers_snapshot(db: Session, tenant_id, sponsor_id) -> Dict[str, Any]:
    """Who signs a publication made now, and with which signature (ids; null when missing)."""
    tenant_id = _uuid(tenant_id)
    profile = db.query(SchoolProfile).options(defer(SchoolProfile.seal_image)).filter(
        SchoolProfile.tenant_id == tenant_id).first()
    principal_id = profile.principal_user_id if profile else None
    sponsor_sig = current_signature(db, tenant_id, sponsor_id)
    principal_sig = current_signature(db, tenant_id, principal_id)
    return {
        "sponsor_user_id": sponsor_id,
        "sponsor_signature_id": sponsor_sig.id if sponsor_sig else None,
        "principal_user_id": principal_id,
        "principal_signature_id": principal_sig.id if principal_sig else None,
    }


def school_block(db: Session, tenant_id) -> Dict[str, Any]:
    tenant_id = _uuid(tenant_id)
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    profile = db.query(SchoolProfile).filter(SchoolProfile.tenant_id == tenant_id).first()
    return {
        "name": tenant.name if tenant else None,
        "logo": tenant.logo if tenant else None,
        "address": profile.address if profile else None,
        "motto": profile.motto if profile else None,
        "phone": profile.phone if profile else None,
        "email": profile.email if profile else None,
        "seal": report_images.data_url(profile.seal_image) if profile else None,
    }


def card_signatures(db: Session, tenant_id, class_id) -> Dict[str, Any]:
    """Signatures of the class's latest publication; null where nothing is published or signed."""
    from src.db.models.academics.gradebook import ResultPublication

    tenant_id = _uuid(tenant_id)
    latest = db.query(ResultPublication).filter(
        ResultPublication.tenant_id == tenant_id, ResultPublication.class_id == class_id,
    ).order_by(ResultPublication.published_at.desc(), ResultPublication.created_at.desc()).first()
    out: Dict[str, Any] = {"sponsor": None, "principal": None}
    if latest is None:
        return out

    def signed(user_id, signature_id, title):
        if user_id is None or signature_id is None:
            return None
        sig = db.query(UserSignature).filter(UserSignature.tenant_id == tenant_id, UserSignature.id == signature_id,
                                             UserSignature.user_id == user_id).first()
        if sig is None:
            return None
        user = db.query(User).filter(User.tenant_id == tenant_id, User.id == user_id).first()
        return {"name": person_name(user), "title": title, "image": report_images.data_url(sig.image)}

    profile = db.query(SchoolProfile).options(defer(SchoolProfile.seal_image)).filter(
        SchoolProfile.tenant_id == tenant_id).first()
    principal_title = (profile.principal_title if profile else None) or DEFAULT_PRINCIPAL_TITLE
    out["sponsor"] = signed(latest.sponsor_user_id, latest.sponsor_signature_id, SPONSOR_TITLE)
    out["principal"] = signed(latest.principal_user_id, latest.principal_signature_id, principal_title)
    return out
