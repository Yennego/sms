"""
rename_county_column_to_lowercase

Revision ID: bad513ad5499
Revises: cfd7879ead10
Create Date: 2025-08-25 13:12:06.134954

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'bad513ad5499'
down_revision = 'cfd7879ead10'
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)

    tables = set(insp.get_table_names())
    if 'students' in tables:
        cols = [c['name'] for c in insp.get_columns('students')]
        has_lower = 'county' in cols
        has_upper = 'County' in cols

        # Prefer rename to preserve data
        if has_upper and not has_lower:
            op.alter_column('students', 'County', new_column_name='county')
        elif not has_lower:
            op.add_column('students', sa.Column('county', sa.String(length=100), nullable=True))

        # If both existed, drop the uppercase duplicate
        if has_upper and has_lower:
            op.drop_column('students', 'County')


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)

    tables = set(insp.get_table_names())
    if 'students' in tables:
        cols = [c['name'] for c in insp.get_columns('students')]
        has_lower = 'county' in cols
        has_upper = 'County' in cols

        # Prefer rename to preserve data
        if has_lower and not has_upper:
            op.alter_column('students', 'county', new_column_name='County')
        elif not has_upper:
            op.add_column('students', sa.Column('County', sa.String(length=100), nullable=True))

        # If both existed, drop the lowercase duplicate
        if has_upper and has_lower:
            op.drop_column('students', 'county')