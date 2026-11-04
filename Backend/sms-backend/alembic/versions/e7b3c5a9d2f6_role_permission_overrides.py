"""
role_permission_overrides

A role adjusted for one school only (step 3 of the role and permission rework). Each row adds
("grant") or takes away ("revoke") one permission of one role for one school; every other school
keeps the role as it is. Only the platform operator writes them.

The table is a school's settings, not its records: it follows the school (ON DELETE CASCADE), so
an empty school can still be deleted. Row level security as on the other school tables.

Revision ID: e7b3c5a9d2f6
Revises: d4a8e2c6f1b3
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "e7b3c5a9d2f6"
down_revision = "d4a8e2c6f1b3"
branch_labels = None
depends_on = None

TABLE = "role_permission_overrides"
RLS_CHECK = (
    "(current_setting('app.bypass_rls', true) = 'on' "
    "OR tenant_id::text = current_setting('app.tenant_id', true))"
)


def upgrade() -> None:
    op.create_table(
        TABLE,
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id", UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("role_id", UUID(as_uuid=True), sa.ForeignKey("user_roles.id", ondelete="CASCADE"), nullable=False),
        sa.Column("permission_id", UUID(as_uuid=True), sa.ForeignKey("permissions.id", ondelete="CASCADE"),
                  nullable=False),
        sa.Column("effect", sa.String(6), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("tenant_id", "role_id", "permission_id", name="uq_role_permission_overrides"),
        sa.CheckConstraint("effect IN ('grant', 'revoke')", name="ck_role_permission_overrides_effect"),
    )
    op.create_index("ix_role_permission_overrides_tenant_id", TABLE, ["tenant_id"])
    if op.get_bind().dialect.name == "postgresql":
        op.execute(f"ALTER TABLE {TABLE} ENABLE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {TABLE} FORCE ROW LEVEL SECURITY")
        op.execute(f"CREATE POLICY tenant_isolation ON {TABLE} USING {RLS_CHECK} WITH CHECK {RLS_CHECK}")


def downgrade() -> None:
    op.drop_index("ix_role_permission_overrides_tenant_id", table_name=TABLE)
    op.drop_table(TABLE)  # drops its policy too
