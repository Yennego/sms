"""
update to user __init__ model

Revision ID: 886bcee22b82
Revises: d4f800d3dad6
Create Date: 2025-08-25 14:15:14.739128

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '886bcee22b82'
down_revision = 'd4f800d3dad6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)

    if 'users' in insp.get_table_names():
        cols = [c['name'] for c in insp.get_columns('users')]
        if 'address' not in cols:
            op.add_column(
                'users',
                sa.Column('address', sa.String(length=255), nullable=True, comment="User's address"),
            )


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)

    if 'users' in insp.get_table_names():
        cols = [c['name'] for c in insp.get_columns('users')]
        if 'address' in cols:
            op.drop_column('users', 'address')