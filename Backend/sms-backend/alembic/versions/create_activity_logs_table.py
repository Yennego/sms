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
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    table_names = set(inspector.get_table_names())

    if 'activity_logs' not in table_names:
        op.create_table(
            'activity_logs',
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
            sa.PrimaryKeyConstraint('id'),
        )

    idx_names = set()
    if 'activity_logs' in table_names:
        idx_names = {idx['name'] for idx in inspector.get_indexes('activity_logs')}

    if 'ix_activity_logs_tenant_id' not in idx_names:
        op.create_index('ix_activity_logs_tenant_id', 'activity_logs', ['tenant_id'])
    if 'ix_activity_logs_user_id' not in idx_names:
        op.create_index('ix_activity_logs_user_id', 'activity_logs', ['user_id'])
    if 'ix_activity_logs_action' not in idx_names:
        op.create_index('ix_activity_logs_action', 'activity_logs', ['action'])
    if 'ix_activity_logs_entity_type' not in idx_names:
        op.create_index('ix_activity_logs_entity_type', 'activity_logs', ['entity_type'])
    if 'ix_activity_logs_created_at' not in idx_names:
        op.create_index('ix_activity_logs_created_at', 'activity_logs', ['created_at'])


def downgrade() -> None:
    # Drop indexes
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    table_names = set(inspector.get_table_names())

    if 'activity_logs' not in table_names:
        op.create_table(
            'activity_logs',
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
            sa.PrimaryKeyConstraint('id'),
        )

    idx_names = set()
    if 'activity_logs' in table_names:
        idx_names = {idx['name'] for idx in inspector.get_indexes('activity_logs')}

    if 'ix_activity_logs_tenant_id' not in idx_names:
        op.create_index('ix_activity_logs_tenant_id', 'activity_logs', ['tenant_id'])
    if 'ix_activity_logs_user_id' not in idx_names:
        op.create_index('ix_activity_logs_user_id', 'activity_logs', ['user_id'])
    if 'ix_activity_logs_action' not in idx_names:
        op.create_index('ix_activity_logs_action', 'activity_logs', ['action'])
    if 'ix_activity_logs_entity_type' not in idx_names:
        op.create_index('ix_activity_logs_entity_type', 'activity_logs', ['entity_type'])
    if 'ix_activity_logs_created_at' not in idx_names:
        op.create_index('ix_activity_logs_created_at', 'activity_logs', ['created_at'])

    if 'activity_logs' in table_names:
        idx_names = {idx['name'] for idx in inspector.get_indexes('activity_logs')}

        if 'ix_activity_logs_created_at' in idx_names:
            op.drop_index('ix_activity_logs_created_at', table_name='activity_logs')
        if 'ix_activity_logs_entity_type' in idx_names:
            op.drop_index('ix_activity_logs_entity_type', table_name='activity_logs')
        if 'ix_activity_logs_action' in idx_names:
            op.drop_index('ix_activity_logs_action', table_name='activity_logs')
        if 'ix_activity_logs_user_id' in idx_names:
            op.drop_index('ix_activity_logs_user_id', table_name='activity_logs')
        if 'ix_activity_logs_tenant_id' in idx_names:
            op.drop_index('ix_activity_logs_tenant_id', table_name='activity_logs')

        op.drop_table('activity_logs')