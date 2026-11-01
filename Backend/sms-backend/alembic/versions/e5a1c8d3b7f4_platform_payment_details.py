"""
platform_payment_details

How schools pay the platform: one row of free text (bank, mobile money numbers) the operator writes
and school admins read on their Billing page. A platform table: no row level security, like the
other billing tables (school endpoints return only this text).

Revision ID: e5a1c8d3b7f4
Revises: c9e4a7b2f5d1
Create Date: 2026-11-01 18:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

# revision identifiers, used by Alembic.
revision = 'e5a1c8d3b7f4'
down_revision = 'c9e4a7b2f5d1'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'platform_payment_details',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('instructions', sa.Text(), nullable=True),
        sa.Column('updated_by', UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.CheckConstraint('id = 1', name='ck_platform_payment_details_single_row'),
    )


def downgrade():
    op.drop_table('platform_payment_details')
