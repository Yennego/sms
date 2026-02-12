"""
model updates for parent

Revision ID: bafc311a4bfc
Revises: ff43b3f14110
Create Date: 2025-08-25 14:32:51.063438

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'bafc311a4bfc'
down_revision = 'ff43b3f14110'
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)

    if 'parents' in insp.get_table_names():
        p_cols = [c['name'] for c in insp.get_columns('parents')]
        if 'parent_address' not in p_cols:
            if 'address' in p_cols:
                op.execute("ALTER TABLE parents RENAME COLUMN address TO parent_address")
            else:
                op.add_column('parents', sa.Column('parent_address', sa.String(length=255), nullable=True))
        else:
            # parent_address already exists; if legacy address remains, drop it
            if 'address' in p_cols:
                op.drop_column('parents', 'address')


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)

    if 'parents' in insp.get_table_names():
        p_cols = [c['name'] for c in insp.get_columns('parents')]
        if 'parent_address' in p_cols and 'address' not in p_cols:
            op.execute("ALTER TABLE parents RENAME COLUMN parent_address TO address")
        elif 'address' not in p_cols:
            op.add_column('parents', sa.Column('address', sa.String(length=255), nullable=True))
        if 'parent_address' in p_cols and 'address' in p_cols:
            op.drop_column('parents', 'parent_address')