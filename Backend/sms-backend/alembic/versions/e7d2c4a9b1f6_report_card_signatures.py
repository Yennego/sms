"""
report_card_signatures

Signatures, school seal and school profile on report cards (docs/remodel/phase4-design.md §6).

1. user_signatures: one row per uploaded signature (normalised PNG bytes); one current per user
   (partial unique index), older versions kept for cards already published.
2. school_profiles: one row per school (address, motto, phone, email, principal, principal
   title, seal PNG).
3. result_publications gains sponsor_user_id, sponsor_signature_id, principal_user_id,
   principal_signature_id (nullable), filled when a class's results are published.

Composite tenant keys (fk_tn_/uq_tn_) and row level security as in the baseline. Deleting a user
removes their signatures and clears (only) the matching column on publications and profiles
(ON DELETE SET NULL (column), PostgreSQL 15+).

Revision ID: e7d2c4a9b1f6
Revises: f6c2a9d4b8e3
Create Date: 2026-10-30 09:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

# revision identifiers, used by Alembic.
revision = 'e7d2c4a9b1f6'
down_revision = 'f6c2a9d4b8e3'
branch_labels = None
depends_on = None

RLS_CHECK = (
    "(current_setting('app.bypass_rls', true) = 'on' "
    "OR tenant_id::text = current_setting('app.tenant_id', true))"
)
PUBLICATION_KEYS = (
    # column, target table
    ("sponsor_user_id", "users"),
    ("sponsor_signature_id", "user_signatures"),
    ("principal_user_id", "users"),
    ("principal_signature_id", "user_signatures"),
)


def _enable_rls(table):
    op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
    op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")
    op.execute(f"CREATE POLICY tenant_isolation ON {table} USING {RLS_CHECK} WITH CHECK {RLS_CHECK}")


def _fk_set_null(table, column, target):
    """Composite tenant key that clears only `column` when the target row goes."""
    op.execute(
        f"ALTER TABLE {table} ADD CONSTRAINT fk_tn_{table}_{column} FOREIGN KEY (tenant_id, {column}) "
        f"REFERENCES {target}(tenant_id, id) ON DELETE SET NULL ({column})"
    )


def upgrade() -> None:
    op.create_table(
        'user_signatures',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('tenant_id', UUID(as_uuid=True), sa.ForeignKey('tenants.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('user_id', UUID(as_uuid=True), nullable=False),
        sa.Column('image', sa.LargeBinary(), nullable=False),
        sa.Column('width', sa.Integer(), nullable=False),
        sa.Column('height', sa.Integer(), nullable=False),
        sa.Column('sha256', sa.String(64), nullable=False),
        sa.Column('is_current', sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint('tenant_id', 'id', name='uq_tn_user_signatures'),
        sa.ForeignKeyConstraint(['tenant_id', 'user_id'], ['users.tenant_id', 'users.id'],
                                name='fk_tn_user_signatures_user_id', ondelete='CASCADE'),
        sa.CheckConstraint('width > 0 AND height > 0', name='ck_user_signatures_size'),
    )
    op.create_index('ix_user_signatures_tenant_id', 'user_signatures', ['tenant_id'])
    op.create_index('ix_user_signatures_tenant_user', 'user_signatures', ['tenant_id', 'user_id'])
    op.create_index('uq_user_signatures_current', 'user_signatures', ['tenant_id', 'user_id'], unique=True,
                    postgresql_where=sa.text('is_current'))
    _enable_rls('user_signatures')

    op.create_table(
        'school_profiles',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('tenant_id', UUID(as_uuid=True), sa.ForeignKey('tenants.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('address', sa.String(500), nullable=True),
        sa.Column('motto', sa.String(255), nullable=True),
        sa.Column('phone', sa.String(50), nullable=True),
        sa.Column('email', sa.String(255), nullable=True),
        sa.Column('principal_user_id', UUID(as_uuid=True), nullable=True),
        sa.Column('principal_title', sa.String(100), nullable=False, server_default='Principal'),
        sa.Column('seal_image', sa.LargeBinary(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint('tenant_id', name='uq_school_profiles_tenant'),
        sa.UniqueConstraint('tenant_id', 'id', name='uq_tn_school_profiles'),
    )
    _fk_set_null('school_profiles', 'principal_user_id', 'users')
    _enable_rls('school_profiles')

    for column, target in PUBLICATION_KEYS:
        op.add_column('result_publications', sa.Column(column, UUID(as_uuid=True), nullable=True))
        _fk_set_null('result_publications', column, target)


def downgrade() -> None:
    for column, _ in reversed(PUBLICATION_KEYS):
        op.drop_constraint(f'fk_tn_result_publications_{column}', 'result_publications', type_='foreignkey')
        op.drop_column('result_publications', column)
    op.drop_table('school_profiles')
    op.drop_table('user_signatures')
