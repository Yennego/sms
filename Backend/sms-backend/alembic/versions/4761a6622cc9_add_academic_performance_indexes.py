"""
add_academic_performance_indexes

Revision ID: 4761a6622cc9
Revises: 8e3408a0ea03
Create Date: 2025-12-08 19:58:33.246607

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '4761a6622cc9'
down_revision = '8e3408a0ea03'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add performance indexes for academic queries."""
    bind = op.get_bind()
    from sqlalchemy.engine import reflection
    insp = reflection.Inspector.from_engine(bind)

    # Only add indexes on columns we're 100% sure exist
    # Classes table - tenant_id comes from TenantModel base class
    existing_classes_indexes = [i['name'] for i in insp.get_indexes('classes')]
    if 'idx_classes_tenant_active' not in existing_classes_indexes:
        op.create_index(
            'idx_classes_tenant_active',
            'classes',
            ['tenant_id', 'is_active'],
            unique=False
        )
    
    # Subjects table - tenant_id comes from TenantModel base class
    existing_subjects_indexes = [i['name'] for i in insp.get_indexes('subjects')]
    if 'idx_subjects_tenant' not in existing_subjects_indexes:
        op.create_index(
            'idx_subjects_tenant',
            'subjects',
            ['tenant_id'],
            unique=False
        )


def downgrade() -> None:
    """Remove performance indexes."""
    bind = op.get_bind()
    from sqlalchemy.engine import reflection
    insp = reflection.Inspector.from_engine(bind)

    existing_subjects_indexes = [i['name'] for i in insp.get_indexes('subjects')]
    if 'idx_subjects_tenant' in existing_subjects_indexes:
        op.drop_index('idx_subjects_tenant', table_name='subjects')

    existing_classes_indexes = [i['name'] for i in insp.get_indexes('classes')]
    if 'idx_classes_tenant_active' in existing_classes_indexes:
        op.drop_index('idx_classes_tenant_active', table_name='classes')