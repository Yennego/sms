"""
refactor_timetable_academic_year_to_foreign_key

Revision ID: 6a30231de6a9
Revises: cc964b0e1503
Create Date: 2025-08-28 15:03:33.809154

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text


# revision identifiers, used by Alembic.
revision = '6a30231de6a9'
down_revision = 'cc964b0e1503'
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)

    if 'timetables' in insp.get_table_names():
        cols = [c['name'] for c in insp.get_columns('timetables')]

        # Step 1: Add academic_year_id if missing
        if 'academic_year_id' not in cols:
            op.add_column('timetables', sa.Column('academic_year_id', sa.UUID(), nullable=True))
            cols.append('academic_year_id')

        # Step 2: Populate academic_year_id using academic_year string if both exist
        if 'academic_year_id' in cols and 'academic_year' in cols:
            bind.execute(text("""
                UPDATE timetables 
                SET academic_year_id = ay.id
                FROM academic_years ay
                WHERE timetables.academic_year = ay.name
                  AND timetables.academic_year_id IS NULL
            """))

        # Step 3: Make academic_year_id non-nullable only if no NULLs
        null_count = bind.execute(text("SELECT COUNT(*) FROM timetables WHERE academic_year_id IS NULL")).scalar()
        if null_count == 0:
            op.alter_column('timetables', 'academic_year_id', nullable=False)

        # Step 4: Index and foreign key guards
        existing_indexes = {idx['name'] for idx in insp.get_indexes('timetables')}
        if 'ix_timetables_academic_year_id' not in existing_indexes:
            bind.execute(text('CREATE INDEX IF NOT EXISTS ix_timetables_academic_year_id ON timetables (academic_year_id)'))

        existing_fks = insp.get_foreign_keys('timetables')
        fk_exists = any(
            'academic_year_id' in fk.get('constrained_columns', [])
            and fk.get('referred_table') == 'academic_years'
            for fk in existing_fks
        )
        if not fk_exists:
            op.create_foreign_key(
                'fk_timetables_academic_year_id',
                'timetables', 'academic_years',
                ['academic_year_id'], ['id']
            )

        # Step 5: Drop legacy academic_year column/index if present
        if 'ix_timetables_academic_year' in existing_indexes:
            bind.execute(text('DROP INDEX IF EXISTS ix_timetables_academic_year'))
        if 'academic_year' in cols:
            op.drop_column('timetables', 'academic_year')


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)

    if 'timetables' in insp.get_table_names():
        cols = [c['name'] for c in insp.get_columns('timetables')]

        # Step 1: Add back academic_year if missing
        if 'academic_year' not in cols:
            op.add_column('timetables', sa.Column('academic_year', sa.VARCHAR(length=20), nullable=True))
            cols.append('academic_year')

        # Step 2: Populate academic_year from academic_year_id if both exist
        if 'academic_year_id' in cols and 'academic_year' in cols:
            bind.execute(text("""
                UPDATE timetables 
                SET academic_year = ay.name
                FROM academic_years ay
                WHERE timetables.academic_year_id = ay.id
                  AND timetables.academic_year IS NULL
            """))

        # Step 3: Make academic_year non-nullable only if no NULLs
        null_count = bind.execute(text("SELECT COUNT(*) FROM timetables WHERE academic_year IS NULL")).scalar()
        if null_count == 0:
            op.alter_column('timetables', 'academic_year', nullable=False)

        # Step 4: Ensure index for academic_year
        existing_indexes = {idx['name'] for idx in insp.get_indexes('timetables')}
        if 'ix_timetables_academic_year' not in existing_indexes:
            bind.execute(text('CREATE INDEX IF NOT EXISTS ix_timetables_academic_year ON timetables (academic_year)'))

        # Step 5: Drop FK/index/column for academic_year_id only if present
        existing_fks = insp.get_foreign_keys('timetables')
        fk_exists = any(
            'academic_year_id' in fk.get('constrained_columns', [])
            and fk.get('referred_table') == 'academic_years'
            for fk in existing_fks
        )
        if fk_exists:
            op.drop_constraint('fk_timetables_academic_year_id', 'timetables', type_='foreignkey')

        if 'ix_timetables_academic_year_id' in existing_indexes:
            bind.execute(text('DROP INDEX IF EXISTS ix_timetables_academic_year_id'))

        if 'academic_year_id' in cols:
            op.drop_column('timetables', 'academic_year_id')