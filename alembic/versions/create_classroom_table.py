"""create classroom table

Revision ID: create_classroom_table
Revises: create_default_data
Create Date: 2025-04-27 16:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'create_classroom_table'
down_revision = 'create_default_data'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create classroom table
    op.create_table(
        'classroom',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('tenant_id', sa.String(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('grade_level', sa.String(), nullable=False),
        sa.Column('subject', sa.String(), nullable=False),
        sa.Column('room_number', sa.String(), nullable=True),
        sa.Column('max_capacity', sa.Integer(), nullable=True),
        sa.Column('is_active', sa.Boolean(), default=True, nullable=False),
        sa.Column('teacher_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenant.id']),
        sa.ForeignKeyConstraint(['teacher_id'], ['teacher.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('tenant_id', 'name', 'grade_level', name='uq_class_room_tenant_name_grade')
    )


def downgrade() -> None:
    op.drop_table('classroom') 