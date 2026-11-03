"""
expenditure_currency

Expenses gain a currency (USD or LRD), so their totals can be kept per currency like fees.
Existing expenses were entered without one and are taken as USD. The amount becomes
NUMERIC(12,2), like the rest of the money columns.

Revision ID: b8d4f0a2c3e5
Revises: a7c3e9f1b2d4
Create Date: 2026-11-02 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'b8d4f0a2c3e5'
down_revision = 'a7c3e9f1b2d4'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('expenditures', sa.Column('currency', sa.String(3), nullable=True))
    op.execute("UPDATE expenditures SET currency = 'USD' WHERE currency IS NULL")
    op.alter_column('expenditures', 'currency', nullable=False)
    op.create_check_constraint('ck_expenditures_currency', 'expenditures', "currency IN ('USD', 'LRD')")
    op.alter_column('expenditures', 'amount', type_=sa.Numeric(12, 2), existing_type=sa.Numeric(10, 2),
                    existing_nullable=False)


def downgrade():
    op.alter_column('expenditures', 'amount', type_=sa.Numeric(10, 2), existing_type=sa.Numeric(12, 2),
                    existing_nullable=False)
    op.drop_constraint('ck_expenditures_currency', 'expenditures', type_='check')
    op.drop_column('expenditures', 'currency')
