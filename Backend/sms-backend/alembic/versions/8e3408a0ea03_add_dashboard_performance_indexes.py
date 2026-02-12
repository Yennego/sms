"""
add_dashboard_performance_indexes

Revision ID: 8e3408a0ea03
Revises: cfaec3bf6048
Create Date: 2025-12-08 10:01:52.204728

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '8e3408a0ea03'
down_revision = 'cfaec3bf6048'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add performance indexes for dashboard stats queries."""
    # Student-specific indexes (students table only has status, not tenant_id)
    op.create_index(
        'idx_students_status',
        'students',
        ['status'],
        unique=False
    )
    
    # Teacher-specific indexes (teachers table only has status, not tenant_id)
    op.create_index(
        'idx_teachers_status',
        'teachers',
        ['status'],
        unique=False
    )
    
    # Class indexes for dashboard stats
    op.create_index(
        'idx_classes_tenant_active',
        'classes',
        ['tenant_id', 'is_active'],
        unique=False
    )
    
    # User indexes for dashboard stats (tenant_id is in users table)
    op.create_index(
        'idx_users_tenant_active',
        'users',
        ['tenant_id', 'is_active'],
        unique=False
    )
    op.create_index(
        'idx_users_tenant_type',
        'users',
        ['tenant_id', 'type'],
        unique=False
    )
    op.create_index(
        'idx_users_tenant_login',
        'users',
        ['tenant_id', 'last_login'],
        unique=False
    )


def downgrade() -> None:
    """Remove performance indexes."""
    # Drop indexes in reverse order
    op.drop_index('idx_users_tenant_login', table_name='users')
    op.drop_index('idx_users_tenant_type', table_name='users')
    op.drop_index('idx_users_tenant_active', table_name='users')
    op.drop_index('idx_classes_tenant_active', table_name='classes')
    op.drop_index('idx_teachers_status', table_name='teachers')
    op.drop_index('idx_students_status', table_name='students')