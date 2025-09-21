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
    # Step 1: Add the new academic_year_id column as nullable first
    op.add_column('timetables', sa.Column('academic_year_id', sa.UUID(), nullable=True))
    
    # Step 2: Data migration - populate academic_year_id based on academic_year string
    # This assumes you have academic years in the database that match the string values
    connection = op.get_bind()
    
    # Update academic_year_id by matching academic_year string to academic_years.name
    connection.execute(text("""
        UPDATE timetables 
        SET academic_year_id = academic_years.id 
        FROM academic_years 
        WHERE timetables.academic_year = academic_years.name
    """))
    
    # Step 3: Make academic_year_id non-nullable after population
    op.alter_column('timetables', 'academic_year_id', nullable=False)
    
    # Step 4: Create index and foreign key
    op.create_index(op.f('ix_timetables_academic_year_id'), 'timetables', ['academic_year_id'], unique=False)
    op.create_foreign_key('fk_timetables_academic_year_id', 'timetables', 'academic_years', ['academic_year_id'], ['id'])
    
    # Step 5: Drop the old academic_year column and its index
    op.drop_index(op.f('ix_timetables_academic_year'), table_name='timetables')
    op.drop_column('timetables', 'academic_year')


def downgrade() -> None:
    # Step 1: Add back the academic_year string column
    op.add_column('timetables', sa.Column('academic_year', sa.VARCHAR(length=20), autoincrement=False, nullable=True))
    
    # Step 2: Populate academic_year from academic_year_id relationship
    connection = op.get_bind()
    connection.execute(text("""
        UPDATE timetables 
        SET academic_year = academic_years.name 
        FROM academic_years 
        WHERE timetables.academic_year_id = academic_years.id
    """))
    
    # Step 3: Make academic_year non-nullable
    op.alter_column('timetables', 'academic_year', nullable=False)
    
    # Step 4: Create index for academic_year
    op.create_index(op.f('ix_timetables_academic_year'), 'timetables', ['academic_year'], unique=False)
    
    # Step 5: Drop foreign key, index, and academic_year_id column
    op.drop_constraint('fk_timetables_academic_year_id', 'timetables', type_='foreignkey')
    op.drop_index(op.f('ix_timetables_academic_year_id'), table_name='timetables')
    op.drop_column('timetables', 'academic_year_id')