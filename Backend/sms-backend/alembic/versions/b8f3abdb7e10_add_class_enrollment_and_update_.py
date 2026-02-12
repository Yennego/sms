"""
add_class_enrollment_and_update_relationships

Revision ID: b8f3abdb7e10
Revises: 9fba10beddbd
Create Date: 2025-09-17 18:59:02.703371

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'b8f3abdb7e10'
down_revision = '9fba10beddbd'
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)

    existing_tables = set(insp.get_table_names())

    # Create class_enrollments table only if missing
    if 'class_enrollments' not in existing_tables:
        op.create_table(
            'class_enrollments',
            sa.Column('student_id', sa.UUID(), nullable=False),
            sa.Column('class_id', sa.UUID(), nullable=False),
            sa.Column('academic_year_id', sa.UUID(), nullable=False),
            sa.Column('enrollment_date', sa.Date(), nullable=False),
            sa.Column('status', sa.String(length=20), nullable=False),
            sa.Column('is_active', sa.Boolean(), nullable=False),
            sa.Column('drop_date', sa.Date(), nullable=True),
            sa.Column('completion_date', sa.Date(), nullable=True),
            sa.Column('id', sa.UUID(), nullable=False),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('tenant_id', sa.UUID(), nullable=False),
            sa.ForeignKeyConstraint(['academic_year_id'], ['academic_years.id']),
            sa.ForeignKeyConstraint(['class_id'], ['classes.id']),
            sa.ForeignKeyConstraint(['student_id'], ['students.id']),
            sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('student_id', 'class_id', 'academic_year_id', name='unique_student_class_year'),
        )

    # Ensure index exists
    if 'class_enrollments' in existing_tables:
        existing_indexes = {idx['name'] for idx in insp.get_indexes('class_enrollments')}
        if 'ix_class_enrollments_tenant_id' not in existing_indexes:
            op.create_index(op.f('ix_class_enrollments_tenant_id'), 'class_enrollments', ['tenant_id'], unique=False)

        # Ensure unique constraint exists
        existing_uniques = {uc['name'] for uc in insp.get_unique_constraints('class_enrollments')}
        if 'unique_student_class_year' not in existing_uniques:
            op.create_unique_constraint(
                'unique_student_class_year',
                'class_enrollments',
                ['student_id', 'class_id', 'academic_year_id'],
            )

    # Attendances: make class_id NOT NULL safely and add unique if missing
    if 'attendances' in existing_tables:
        a_cols = {c['name']: c for c in insp.get_columns('attendances')}
        if 'class_id' in a_cols and a_cols['class_id'].get('nullable', True):
            null_cnt = bind.execute(sa.text("SELECT COUNT(*) FROM attendances WHERE class_id IS NULL")).scalar()
            if null_cnt == 0:
                op.alter_column('attendances', 'class_id', existing_type=sa.UUID(), nullable=False)

        a_uniques = {uc['name'] for uc in insp.get_unique_constraints('attendances')}
        if 'unique_student_class_date_attendance' not in a_uniques:
            op.create_unique_constraint(
                'unique_student_class_date_attendance',
                'attendances',
                ['student_id', 'class_id', 'date'],
            )

    # Classes: add description if missing
    if 'classes' in existing_tables:
        c_cols = [c['name'] for c in insp.get_columns('classes')]
        if 'description' not in c_cols:
            op.add_column('classes', sa.Column('description', sa.Text(), nullable=True))

    # Enrollments: add grade_id/section_id, adjust nullability, and add FKs idempotently
    if 'enrollments' in existing_tables:
        e_cols = {c['name']: c for c in insp.get_columns('enrollments')}

        if 'grade_id' not in e_cols:
            op.add_column('enrollments', sa.Column('grade_id', sa.UUID(), nullable=False))
        if 'section_id' not in e_cols:
            op.add_column('enrollments', sa.Column('section_id', sa.UUID(), nullable=False))

        # academic_year_id -> NOT NULL only when safe
        if 'academic_year_id' in e_cols and e_cols['academic_year_id'].get('nullable', True):
            null_cnt = bind.execute(sa.text("SELECT COUNT(*) FROM enrollments WHERE academic_year_id IS NULL")).scalar()
            if null_cnt == 0:
                op.alter_column('enrollments', 'academic_year_id', existing_type=sa.UUID(), nullable=False)

        # academic_year string -> make nullable if currently NOT NULL
        if 'academic_year' in e_cols and not e_cols['academic_year'].get('nullable', True):
            op.alter_column('enrollments', 'academic_year', existing_type=sa.VARCHAR(length=20), nullable=True)

        # grade/section strings -> make nullable if currently NOT NULL
        if 'grade' in e_cols and not e_cols['grade'].get('nullable', True):
            op.alter_column('enrollments', 'grade', existing_type=sa.VARCHAR(length=50), nullable=True)
        if 'section' in e_cols and not e_cols['section'].get('nullable', True):
            op.alter_column('enrollments', 'section', existing_type=sa.VARCHAR(length=10), nullable=True)

        # Guard foreign key creation on enrollments.grade_id and enrollments.section_id
        conn = op.get_bind()
        inspector = sa.inspect(conn)
    
        try:
            existing_fks = inspector.get_foreign_keys('enrollments')
        except Exception:
            existing_fks = []
    
        fk_names = {fk.get('name') for fk in existing_fks if fk.get('name')}
    
        # Detect if there's already an FK for grade_id -> grades(id), independent of name
        has_grade_fk = any(
            ('grade_id' in (fk.get('constrained_columns') or []))
            and (fk.get('referred_table') == 'grades')
            for fk in existing_fks
        )
        if not has_grade_fk and 'enrollments_grade_id_fkey' not in fk_names:
            op.create_foreign_key(
                'enrollments_grade_id_fkey',
                'enrollments',
                'grades',
                ['grade_id'],
                ['id'],
            )
    
        # Detect if there's already an FK for section_id -> sections(id), independent of name
        has_section_fk = any(
            ('section_id' in (fk.get('constrained_columns') or []))
            and (fk.get('referred_table') == 'sections')
            for fk in existing_fks
        )
        if not has_section_fk and 'enrollments_section_id_fkey' not in fk_names:
            op.create_foreign_key(
                'enrollments_section_id_fkey',
                'enrollments',
                'sections',
                ['section_id'],
                ['id'],
            )

    # Students: drop legacy grade/section columns if present
    if 'students' in existing_tables:
        s_cols = [c['name'] for c in insp.get_columns('students')]
        if 'grade' in s_cols:
            op.drop_column('students', 'grade')
        if 'section' in s_cols:
            op.drop_column('students', 'section')
    # ### end Alembic commands ###


def downgrade() -> None:
    # Guard foreign key drops for enrollments
    conn = op.get_bind()
    inspector = sa.inspect(conn)

    try:
        existing_fks = inspector.get_foreign_keys('enrollments')
    except Exception:
        existing_fks = []

    fk_names = {fk.get('name') for fk in existing_fks if fk.get('name')}

    if 'enrollments_grade_id_fkey' in fk_names:
        op.drop_constraint('enrollments_grade_id_fkey', 'enrollments', type_='foreignkey')

    if 'enrollments_section_id_fkey' in fk_names:
        op.drop_constraint('enrollments_section_id_fkey', 'enrollments', type_='foreignkey')

    # Drop FK to grades
    for fk in insp.get_foreign_keys('enrollments'):
        if 'grade_id' in fk.get('constrained_columns', []) and fk.get('referred_table') == 'grades':
            if fk.get('name'):
                op.drop_constraint(fk['name'], 'enrollments', type_='foreignkey')
    # Drop FK to sections
    for fk in insp.get_foreign_keys('enrollments'):
        if 'section_id' in fk.get('constrained_columns', []) and fk.get('referred_table') == 'sections':
            if fk.get('name'):
                op.drop_constraint(fk['name'], 'enrollments', type_='foreignkey')

    e_cols = {c['name']: c for c in insp.get_columns('enrollments')}

    # Restore NOT NULLs where appropriate
    if 'section' in e_cols and e_cols['section'].get('nullable', True):
        op.alter_column('enrollments', 'section', existing_type=sa.VARCHAR(length=10), nullable=False)
    if 'grade' in e_cols and e_cols['grade'].get('nullable', True):
        op.alter_column('enrollments', 'grade', existing_type=sa.VARCHAR(length=50), nullable=False)
    if 'academic_year' in e_cols and e_cols['academic_year'].get('nullable', True):
        op.alter_column('enrollments', 'academic_year', existing_type=sa.VARCHAR(length=20), nullable=False)
    if 'academic_year_id' in e_cols and not e_cols['academic_year_id'].get('nullable', True):
        # Only relax to nullable if needed; safe operation
        op.alter_column('enrollments', 'academic_year_id', existing_type=sa.UUID(), nullable=True)

    # Drop added columns if present
    if 'section_id' in e_cols:
        op.drop_column('enrollments', 'section_id')
    if 'grade_id' in e_cols:
        op.drop_column('enrollments', 'grade_id')

    # Classes: drop description if present
    if 'classes' in existing_tables:
        c_cols = [c['name'] for c in insp.get_columns('classes')]
        if 'description' in c_cols:
            op.drop_column('classes', 'description')

    # Attendances: drop unique and relax class_id to nullable if currently NOT NULL
    if 'attendances' in existing_tables:
        a_uniques = {uc['name'] for uc in insp.get_unique_constraints('attendances')}
        if 'unique_student_class_date_attendance' in a_uniques:
            op.drop_constraint('unique_student_class_date_attendance', 'attendances', type_='unique')

        a_cols = {c['name']: c for c in insp.get_columns('attendances')}
        if 'class_id' in a_cols and not a_cols['class_id'].get('nullable', True):
            op.alter_column('attendances', 'class_id', existing_type=sa.UUID(), nullable=True)

    # Class enrollments: drop index and table only if present
    if 'class_enrollments' in existing_tables:
        ce_indexes = {idx['name'] for idx in insp.get_indexes('class_enrollments')}
        if 'ix_class_enrollments_tenant_id' in ce_indexes:
            op.drop_index(op.f('ix_class_enrollments_tenant_id'), table_name='class_enrollments')
        op.drop_table('class_enrollments')
    # ### end Alembic commands ###