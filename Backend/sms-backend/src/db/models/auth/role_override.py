from sqlalchemy import CheckConstraint, Column, ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID

from src.db.models.base import Base, TimestampMixin, UUIDMixin


class RolePermissionOverride(Base, TimestampMixin, UUIDMixin):
    """One school's adjustment to a role: a permission added ("grant") or taken away ("revoke")
    for that school only. Every other school keeps the role as it is. Only the platform operator
    sets these (schools ask for what they need)."""

    __tablename__ = "role_permission_overrides"
    __table_args__ = (
        UniqueConstraint("tenant_id", "role_id", "permission_id", name="uq_role_permission_overrides"),
        CheckConstraint("effect IN ('grant', 'revoke')", name="ck_role_permission_overrides_effect"),
    )

    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    role_id = Column(UUID(as_uuid=True), ForeignKey("user_roles.id", ondelete="CASCADE"), nullable=False)
    permission_id = Column(UUID(as_uuid=True), ForeignKey("permissions.id", ondelete="CASCADE"), nullable=False)
    effect = Column(String(6), nullable=False)
