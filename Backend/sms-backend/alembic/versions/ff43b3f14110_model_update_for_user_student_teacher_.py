"""
model update for user, student, teacher and parent

Revision ID: ff43b3f14110
Revises: 886bcee22b82
Create Date: 2025-08-25 14:27:24.358645

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'ff43b3f14110'
down_revision = '886bcee22b82'
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)

    # Students: add/rename to student_address safely
    if 'students' in insp.get_table_names():
        s_cols = [c['name'] for c in insp.get_columns('students')]
        if 'student_address' not in s_cols:
            if 'address' in s_cols:
                op.execute("ALTER TABLE students RENAME COLUMN address TO student_address")
            else:
                op.add_column('students', sa.Column('student_address', sa.String(length=255), nullable=True))
        else:
            # student_address already exists; if legacy address remains, drop it
            if 'address' in s_cols:
                op.drop_column('students', 'address')

    # Teachers: add/rename to teacher_address safely
    if 'teachers' in insp.get_table_names():
        t_cols = [c['name'] for c in insp.get_columns('teachers')]
        if 'teacher_address' not in t_cols:
            if 'address' in t_cols:
                op.execute("ALTER TABLE teachers RENAME COLUMN address TO teacher_address")
            else:
                op.add_column('teachers', sa.Column('teacher_address', sa.String(length=255), nullable=True))
        else:
            # teacher_address already exists; if legacy address remains, drop it
            if 'address' in t_cols:
                op.drop_column('teachers', 'address')


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)

    # Students: revert to address safely
    if 'students' in insp.get_table_names():
        s_cols = [c['name'] for c in insp.get_columns('students')]
        if 'student_address' in s_cols and 'address' not in s_cols:
            op.execute("ALTER TABLE students RENAME COLUMN student_address TO address")
        elif 'address' not in s_cols:
            op.add_column('students', sa.Column('address', sa.String(length=255), nullable=True))
        if 'student_address' in s_cols and 'address' in s_cols:
            op.drop_column('students', 'student_address')

    # Teachers: revert to address safely
    if 'teachers' in insp.get_table_names():
        t_cols = [c['name'] for c in insp.get_columns('teachers')]
        if 'teacher_address' in t_cols and 'address' not in t_cols:
            op.execute("ALTER TABLE teachers RENAME COLUMN teacher_address TO address")
        elif 'address' not in t_cols:
            op.add_column('teachers', sa.Column('address', sa.String(length=255), nullable=True))
        if 'teacher_address' in t_cols and 'address' in t_cols:
            op.drop_column('teachers', 'teacher_address')