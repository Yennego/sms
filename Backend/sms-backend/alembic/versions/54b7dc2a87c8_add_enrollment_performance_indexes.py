"""
add enrollment performance indexes

Revision ID: 54b7dc2a87c8
Revises: 4761a6622cc9
Create Date: 2026-01-12 18:48:27.804181

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '54b7dc2a87c8'
down_revision = '4761a6622cc9'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add indexes for enrollment performance
    op.create_index('ix_enrollments_student_id', 'enrollments', ['student_id'])
    op.create_index('ix_enrollments_academic_year_id', 'enrollments', ['academic_year_id'])
    op.create_index('ix_enrollments_grade_id', 'enrollments', ['grade_id'])
    op.create_index('ix_enrollments_section_id', 'enrollments', ['section_id'])
    op.create_index('ix_enrollments_tenant_grade_active', 'enrollments', ['tenant_id', 'grade_id', 'is_active'])


def downgrade() -> None:
    # Remove indexes
    op.drop_index('ix_enrollments_student_id', table_name='enrollments')
    op.drop_index('ix_enrollments_academic_year_id', table_name='enrollments')
    op.drop_index('ix_enrollments_grade_id', table_name='enrollments')
    op.drop_index('ix_enrollments_section_id', table_name='enrollments')
    op.drop_index('ix_enrollments_tenant_grade_active', table_name='enrollments')