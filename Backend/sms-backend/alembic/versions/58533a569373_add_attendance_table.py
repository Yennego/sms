"""
add_attendance_table

Revision ID: 58533a569373
Revises: 6a30231de6a9
Create Date: 2025-08-28 15:49:25.298447

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '58533a569373'
down_revision = '6a30231de6a9'
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)

    # Ensure the PostgreSQL enum type exists only once
    enum_exists = bind.execute(
        sa.text("SELECT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'attendancestatus')")
    ).scalar()

    if not enum_exists:
        sa.Enum(
            'PRESENT', 'ABSENT', 'LATE', 'EXCUSED', 'SICK', 'TARDY',
            name='attendancestatus'
        ).create(bind, checkfirst=True)

    # Reference the existing enum type without re-creating it
    attendance_status_enum = sa.Enum(
        'PRESENT', 'ABSENT', 'LATE', 'EXCUSED', 'SICK', 'TARDY',
        name='attendancestatus',
        create_type=False
    )

    # Create table only if missing
    existing_tables = set(insp.get_table_names())
    if 'attendances' not in existing_tables:
        op.create_table(
            'attendances',
            sa.Column('student_id', sa.UUID(), nullable=False),
            sa.Column('class_id', sa.UUID(), nullable=True),
            sa.Column('schedule_id', sa.UUID(), nullable=True),
            sa.Column('academic_year_id', sa.UUID(), nullable=False),
            sa.Column('date', sa.Date(), nullable=False),
            sa.Column('status', attendance_status_enum, nullable=False),
            sa.Column('period', sa.String(length=10), nullable=True),
            sa.Column('check_in_time', sa.DateTime(), nullable=True),
            sa.Column('check_out_time', sa.DateTime(), nullable=True),
            sa.Column('marked_by', sa.UUID(), nullable=False),
            sa.Column('marked_at', sa.DateTime(), nullable=False),
            sa.Column('notes', sa.Text(), nullable=True),
            sa.Column('id', sa.UUID(), nullable=False),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('tenant_id', sa.UUID(), nullable=False),
            sa.ForeignKeyConstraint(['academic_year_id'], ['academic_years.id']),
            sa.ForeignKeyConstraint(['class_id'], ['classes.id']),
            sa.ForeignKeyConstraint(['marked_by'], ['users.id']),
            sa.ForeignKeyConstraint(['schedule_id'], ['schedules.id']),
            sa.ForeignKeyConstraint(['student_id'], ['students.id']),
            sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id'),
        )

    # Create indexes only if they don't exist
    existing_indexes = set()
    if 'attendances' in existing_tables:
        existing_indexes = {idx['name'] for idx in insp.get_indexes('attendances')}

    if 'attendances' in existing_tables and 'ix_attendances_date' not in existing_indexes:
        op.create_index(op.f('ix_attendances_date'), 'attendances', ['date'], unique=False)

    if 'attendances' in existing_tables and 'ix_attendances_tenant_id' not in existing_indexes:
        op.create_index(op.f('ix_attendances_tenant_id'), 'attendances', ['tenant_id'], unique=False)


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)

    if 'attendances' in insp.get_table_names():
        existing_indexes = {idx['name'] for idx in insp.get_indexes('attendances')}
        if 'ix_attendances_tenant_id' in existing_indexes:
            op.drop_index(op.f('ix_attendances_tenant_id'), table_name='attendances')
        if 'ix_attendances_date' in existing_indexes:
            op.drop_index(op.f('ix_attendances_date'), table_name='attendances')
        op.drop_table('attendances')