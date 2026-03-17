"""
add_subscription_columns

Revision ID: 6b6354c1483f
Revises: 12345678abcd
Create Date: 2026-03-10 10:25:27.148873

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '6b6354c1483f'
down_revision = '12345678abcd'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('tenants', sa.Column('plan_type', sa.String(length=20), server_default='flat_rate', nullable=False, comment="'flat_rate' or 'per_user'"))
    op.add_column('tenants', sa.Column('plan_amount', sa.Numeric(precision=10, scale=2), server_default='0.0', nullable=False, comment='Monthly amount based on plan_type'))
    op.add_column('tenants', sa.Column('subscription_status', sa.String(length=20), server_default='active', nullable=False, comment="'active', 'past_due', 'canceled'"))


def downgrade() -> None:
    op.drop_column('tenants', 'subscription_status')
    op.drop_column('tenants', 'plan_amount')
    op.drop_column('tenants', 'plan_type')