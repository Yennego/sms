"""Report-card identity: the school profile and staff signatures (docs/remodel/phase4-design.md §6).

Images are stored in the database (no object storage until Phase 6) as normalised PNG bytes
(src/utils/report_images.py) and are never served as files. The composite tenant keys
(fk_tn_/uq_tn_) and row level security live in the migration (e7d2c4a9b1f6).
"""
from sqlalchemy import Boolean, Column, ForeignKey, Index, Integer, LargeBinary, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import text

from src.db.models.base import TenantModel


class UserSignature(TenantModel):
    """One upload of a staff member's signature. Only the owner sets it; uploading again keeps the
    old row (is_current false) because published report cards point at it."""

    __tablename__ = "user_signatures"

    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    image = Column(LargeBinary, nullable=False)  # PNG
    width = Column(Integer, nullable=False)
    height = Column(Integer, nullable=False)
    sha256 = Column(String(64), nullable=False)
    is_current = Column(Boolean, nullable=False, default=True)

    __table_args__ = (
        Index("uq_user_signatures_current", "tenant_id", "user_id", unique=True,
              postgresql_where=text("is_current"), sqlite_where=text("is_current")),
    )


class SchoolProfile(TenantModel):
    """One row per school: what report cards print besides the school's name and logo."""

    __tablename__ = "school_profiles"

    address = Column(String(500), nullable=True)
    motto = Column(String(255), nullable=True)
    phone = Column(String(50), nullable=True)
    email = Column(String(255), nullable=True)
    principal_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    principal_title = Column(String(100), nullable=False, default="Principal")
    seal_image = Column(LargeBinary, nullable=True)  # PNG

    __table_args__ = (
        UniqueConstraint("tenant_id", name="uq_school_profiles_tenant"),
    )
