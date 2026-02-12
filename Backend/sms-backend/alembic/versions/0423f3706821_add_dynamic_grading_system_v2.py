"""
add_dynamic_grading_system_v2

Revision ID: 0423f3706821
Revises: 54b7dc2a87c8
Create Date: 2026-01-24 09:06:44.064507

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '0423f3706821'
down_revision = '54b7dc2a87c8'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Create new grading tables
    op.create_table('grading_schemas',
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('tenant_id', sa.UUID(), nullable=False),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_grading_schemas_tenant_id'), 'grading_schemas', ['tenant_id'], unique=False)
    
    op.create_table('grading_categories',
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('weight', sa.Float(), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('schema_id', sa.UUID(), nullable=False),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('tenant_id', sa.UUID(), nullable=False),
        sa.ForeignKeyConstraint(['schema_id'], ['grading_schemas.id'], ),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('schema_id', 'name', name='uq_grading_category_schema_name')
    )
    op.create_index(op.f('ix_grading_categories_tenant_id'), 'grading_categories', ['tenant_id'], unique=False)

    # 2. Add columns to existing tables
    op.add_column('assessments', sa.Column('class_id', sa.UUID(), nullable=True))
    op.add_column('assessments', sa.Column('grading_category_id', sa.UUID(), nullable=True))
    op.create_foreign_key('fk_assessments_grading_category', 'assessments', 'grading_categories', ['grading_category_id'], ['id'])
    op.create_foreign_key('fk_assessments_class', 'assessments', 'classes', ['class_id'], ['id'])
    
    op.add_column('classes', sa.Column('grading_schema_id', sa.UUID(), nullable=True))
    op.create_foreign_key('fk_classes_grading_schema', 'classes', 'grading_schemas', ['grading_schema_id'], ['id'])
    
    op.add_column('grades', sa.Column('grading_category_id', sa.UUID(), nullable=True))
    op.create_foreign_key('fk_grades_grading_category', 'grades', 'grading_categories', ['grading_category_id'], ['id'])

def downgrade() -> None:
    op.drop_constraint('fk_grades_grading_category', 'grades', type_='foreignkey')
    op.drop_column('grades', 'grading_category_id')
    
    op.drop_constraint('fk_classes_grading_schema', 'classes', type_='foreignkey')
    op.drop_column('classes', 'grading_schema_id')
    
    op.drop_constraint('fk_assessments_class', 'assessments', type_='foreignkey')
    op.drop_constraint('fk_assessments_grading_category', 'assessments', type_='foreignkey')
    op.drop_column('assessments', 'grading_category_id')
    op.drop_column('assessments', 'class_id')
    
    op.drop_index(op.f('ix_grading_categories_tenant_id'), table_name='grading_categories')
    op.drop_table('grading_categories')
    op.drop_index(op.f('ix_grading_schemas_tenant_id'), table_name='grading_schemas')
    op.drop_table('grading_schemas')