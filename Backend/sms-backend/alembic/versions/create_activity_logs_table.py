"""
create_activity_logs_table

Revision ID: create_activity_logs
Revises: 08c0efec5296
Create Date: 2024-01-XX XX:XX:XX.XXXXXX

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'create_activity_logs'
down_revision = '08c0efec5296'  # Changed from 'b3d55459d588' to '08c0efec5296'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create activity_logs table
    op.create_table('activity_logs',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('tenant_id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=True),
        sa.Column('action', sa.String(length=50), nullable=False),
        sa.Column('entity_type', sa.String(length=50), nullable=False),
        sa.Column('entity_id', sa.UUID(), nullable=True),
        sa.Column('old_values', sa.JSON(), nullable=True),
        sa.Column('new_values', sa.JSON(), nullable=True),
        sa.Column('ip_address', sa.String(length=50), nullable=True),
        sa.Column('user_agent', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create indexes for better performance
    op.create_index('ix_activity_logs_tenant_id', 'activity_logs', ['tenant_id'])
    op.create_index('ix_activity_logs_user_id', 'activity_logs', ['user_id'])
    op.create_index('ix_activity_logs_action', 'activity_logs', ['action'])
    op.create_index('ix_activity_logs_entity_type', 'activity_logs', ['entity_type'])
    op.create_index('ix_activity_logs_created_at', 'activity_logs', ['created_at'])


def downgrade() -> None:
    # Drop indexes
    op.drop_index('ix_activity_logs_created_at', table_name='activity_logs')
    op.drop_index('ix_activity_logs_entity_type', table_name='activity_logs')
    op.drop_index('ix_activity_logs_action', table_name='activity_logs')
    op.drop_index('ix_activity_logs_user_id', table_name='activity_logs')
    op.drop_index('ix_activity_logs_tenant_id', table_name='activity_logs')
    
    # Drop table
    op.drop_table('activity_logs')