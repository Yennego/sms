"""
payment_balance_after

payments gains balance_after: the student's balance in the payment's currency right after the
payment, printed on the receipt so a reprint shows the same figure. It is a record of that moment,
not a live balance. Payments moved from the old tables (before this column) keep it NULL.

Revision ID: d2b7e4a9c1f3
Revises: a5d1e8c3f7b2
Create Date: 2026-10-30 18:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'd2b7e4a9c1f3'
down_revision = 'a5d1e8c3f7b2'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('payments', sa.Column('balance_after', sa.Numeric(12, 2), nullable=True))


def downgrade():
    op.drop_column('payments', 'balance_after')
