"""
report_card_verifications

Report card verification QR (docs/remodel/phase4-design.md §7): one row per issued report card
snapshot (published results only) with a random code (12 Crockford base32 characters, unique).
One current (superseded_at IS NULL) row per student and school year. Composite tenant keys
(fk_tn_/uq_tn_) and row level security as in the baseline. Downgrade drops the table.

Revision ID: c8a4f1e6d2b9
Revises: b3e9d2f7a1c4
Create Date: 2026-10-30 13:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, UUID

# revision identifiers, used by Alembic.
revision = 'c8a4f1e6d2b9'
down_revision = 'b3e9d2f7a1c4'
branch_labels = None
depends_on = None

RLS_CHECK = (
    "(current_setting('app.bypass_rls', true) = 'on' "
    "OR tenant_id::text = current_setting('app.tenant_id', true))"
)


def upgrade() -> None:
    op.create_table(
        'report_card_verifications',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('tenant_id', UUID(as_uuid=True), sa.ForeignKey('tenants.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('code', sa.String(12), nullable=False),
        sa.Column('student_id', UUID(as_uuid=True), nullable=False),
        sa.Column('academic_year_id', UUID(as_uuid=True), nullable=False),
        sa.Column('snapshot', JSONB(), nullable=False),
        sa.Column('snapshot_hash', sa.String(64), nullable=False),
        sa.Column('issued_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('superseded_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint('code', name='uq_report_card_verifications_code'),
        sa.UniqueConstraint('tenant_id', 'id', name='uq_tn_report_card_verifications'),
        sa.ForeignKeyConstraint(['tenant_id', 'student_id'], ['students.tenant_id', 'students.id'],
                                name='fk_tn_report_card_verifications_student_id', ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['tenant_id', 'academic_year_id'], ['academic_years.tenant_id', 'academic_years.id'],
                                name='fk_tn_report_card_verifications_academic_year_id', ondelete='CASCADE'),
        sa.CheckConstraint("code ~ '^[0-9A-HJKMNP-TV-Z]{12}$'", name='ck_report_card_verifications_code'),
    )
    op.create_index('ix_report_card_verifications_tenant_id', 'report_card_verifications', ['tenant_id'])
    op.create_index('ix_report_card_verifications_student_year', 'report_card_verifications',
                    ['tenant_id', 'student_id', 'academic_year_id'])
    op.create_index('uq_report_card_verifications_current', 'report_card_verifications',
                    ['tenant_id', 'student_id', 'academic_year_id'], unique=True,
                    postgresql_where=sa.text('superseded_at IS NULL'))
    op.execute("ALTER TABLE report_card_verifications ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE report_card_verifications FORCE ROW LEVEL SECURITY")
    op.execute(f"CREATE POLICY tenant_isolation ON report_card_verifications USING {RLS_CHECK} WITH CHECK {RLS_CHECK}")


def downgrade() -> None:
    op.drop_table('report_card_verifications')
