"""
add_academic_year_and_enhance_enrollment_with_semesters

Revision ID: b3d55459d588
Revises: f7sadvgfiu768
Create Date: 2025-07-10 15:12:24.322193

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'b3d55459d588'
down_revision = 'f7sadvgfiu768'
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if 'academic_years' not in inspector.get_table_names():
        op.create_table(
            'academic_years',
            sa.Column('name', sa.String(length=20), nullable=False),
            sa.Column('start_date', sa.Date(), nullable=False),
            sa.Column('end_date', sa.Date(), nullable=False),
            sa.Column('is_current', sa.Boolean(), nullable=True),
            sa.Column('is_active', sa.Boolean(), nullable=True),
            sa.Column('description', sa.Text(), nullable=True),
            sa.Column('current_semester', sa.Integer(), nullable=True),
            sa.Column('semester_1_start', sa.Date(), nullable=False),
            sa.Column('semester_1_end', sa.Date(), nullable=False),
            sa.Column('semester_2_start', sa.Date(), nullable=False),
            sa.Column('semester_2_end', sa.Date(), nullable=False),
            sa.Column('id', sa.UUID(), nullable=False),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
            sa.PrimaryKeyConstraint('id'),
        )

    enroll_cols = {c['name'] for c in inspector.get_columns('enrollments')}
    if 'academic_year_id' not in enroll_cols:
        op.add_column('enrollments', sa.Column('academic_year_id', sa.UUID(), nullable=True))
    if 'semester' not in enroll_cols:
        op.add_column('enrollments', sa.Column('semester', sa.Integer(), nullable=False))
    if 'semester_1_status' not in enroll_cols:
        op.add_column('enrollments', sa.Column('semester_1_status', sa.String(length=20), nullable=True))
    if 'semester_2_status' not in enroll_cols:
        op.add_column('enrollments', sa.Column('semester_2_status', sa.String(length=20), nullable=True))
    if 'semester_1_completion_date' not in enroll_cols:
        op.add_column('enrollments', sa.Column('semester_1_completion_date', sa.Date(), nullable=True))
    if 'semester_2_completion_date' not in enroll_cols:
        op.add_column('enrollments', sa.Column('semester_2_completion_date', sa.Date(), nullable=True))

    if 'enrollment_date' in enroll_cols:
        op.alter_column('enrollments', 'enrollment_date', existing_type=sa.DATE(), nullable=True)
    if 'status' in enroll_cols:
        op.alter_column(
            'enrollments',
            'status',
            existing_type=sa.VARCHAR(length=20),
            nullable=True,
            comment=None,
            existing_comment='One of: active, completed, withdrawn, transferred',
        )
    if 'is_active' in enroll_cols:
        op.alter_column('enrollments', 'is_active', existing_type=sa.BOOLEAN(), nullable=True)

    idx_names = {idx['name'] for idx in inspector.get_indexes('enrollments')}
    if 'ix_enrollments_academic_year' in idx_names:
        op.drop_index('ix_enrollments_academic_year', table_name='enrollments')
    if 'ix_enrollments_grade' in idx_names:
        op.drop_index('ix_enrollments_grade', table_name='enrollments')
    if 'ix_enrollments_section' in idx_names:
        op.drop_index('ix_enrollments_section', table_name='enrollments')

    has_fk = any(
        fk['referred_table'] == 'academic_years' and fk['constrained_columns'] == ['academic_year_id']
        for fk in inspector.get_foreign_keys('enrollments')
    )
    if not has_fk and 'academic_year_id' in enroll_cols:
        op.create_foreign_key(
            'fk_enrollments_academic_year_id',
            'enrollments',
            'academic_years',
            ['academic_year_id'],
            ['id'],
        )

    notif_cols = {c['name'] for c in inspector.get_columns('notifications')}
    if 'created_at' in notif_cols:
        op.alter_column('notifications', 'created_at', existing_type=postgresql.TIMESTAMP(timezone=True), nullable=True)
    if 'updated_at' in notif_cols:
        op.drop_column('notifications', 'updated_at')

    users_cols = {c['name'] for c in inspector.get_columns('users')}
    if 'tenant_id' in users_cols:
        op.alter_column('users', 'tenant_id', existing_type=sa.UUID(), nullable=True)
    if 'is_first_login' in users_cols:
        op.alter_column(
            'users',
            'is_first_login',
            existing_type=sa.BOOLEAN(),
            comment="Whether this is the user's first login",
            existing_nullable=False,
            existing_server_default=sa.text('true'),
        )
    if 'password_expiry_date' in users_cols:
        op.alter_column(
            'users',
            'password_expiry_date',
            existing_type=postgresql.TIMESTAMP(),
            comment='Date when the password expires',
            existing_nullable=True,
        )

def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    fks = inspector.get_foreign_keys('enrollments')
    for fk in fks:
        if fk['referred_table'] == 'academic_years' and fk['constrained_columns'] == ['academic_year_id'] and fk.get('name'):
            op.drop_constraint(fk['name'], 'enrollments', type_='foreignkey')

    idx_names = {idx['name'] for idx in inspector.get_indexes('enrollments')}
    enroll_cols = {c['name'] for c in inspector.get_columns('enrollments')}
    if 'ix_enrollments_section' not in idx_names and 'section' in enroll_cols:
        op.create_index('ix_enrollments_section', 'enrollments', ['section'], unique=False)
    if 'ix_enrollments_grade' not in idx_names and 'grade' in enroll_cols:
        op.create_index('ix_enrollments_grade', 'enrollments', ['grade'], unique=False)
    if 'ix_enrollments_academic_year' not in idx_names and 'academic_year' in enroll_cols:
        op.create_index('ix_enrollments_academic_year', 'enrollments', ['academic_year'], unique=False)

    if 'is_active' in enroll_cols:
        op.alter_column('enrollments', 'is_active', existing_type=sa.BOOLEAN(), nullable=False)
    if 'status' in enroll_cols:
        op.alter_column(
            'enrollments',
            'status',
            existing_type=sa.VARCHAR(length=20),
            nullable=False,
            comment='One of: active, completed, withdrawn, transferred',
        )
    if 'enrollment_date' in enroll_cols:
        op.alter_column('enrollments', 'enrollment_date', existing_type=sa.DATE(), nullable=False)

    for col in ['semester_2_completion_date', 'semester_1_completion_date', 'semester_2_status', 'semester_1_status', 'semester', 'academic_year_id']:
        if col in enroll_cols:
            op.drop_column('enrollments', col)

    notif_cols = {c['name'] for c in inspector.get_columns('notifications')}
    if 'updated_at' not in notif_cols:
        op.add_column('notifications', sa.Column('updated_at', postgresql.TIMESTAMP(timezone=True), nullable=False))
    if 'created_at' in notif_cols:
        op.alter_column('notifications', 'created_at', existing_type=postgresql.TIMESTAMP(timezone=True), nullable=False)

    users_cols = {c['name'] for c in inspector.get_columns('users')}
    if 'tenant_id' in users_cols:
        op.alter_column('users', 'tenant_id', existing_type=sa.UUID(), nullable=False)
    if 'is_first_login' in users_cols:
        op.alter_column(
            'users',
            'is_first_login',
            existing_type=sa.BOOLEAN(),
            comment=None,
            existing_comment="Whether this is the user's first login",
            existing_nullable=False,
            existing_server_default=sa.text('true'),
        )
    if 'password_expiry_date' in users_cols:
        op.alter_column(
            'users',
            'password_expiry_date',
            existing_type=postgresql.TIMESTAMP(),
            comment=None,
            existing_comment='Date when the password expires',
            existing_nullable=True,
        )

    if 'academic_years' in inspector.get_table_names():
        op.drop_table('academic_years')
