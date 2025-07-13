"""recreate tenants and tenant_settings tables

Revision ID: 08c0efec5296
Revises: b3d55459d588
Create Date: 2024-01-10 16:30:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '08c0efec5296'
down_revision = 'b3d55459d588'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Drop tenant_settings table first if it exists (to remove foreign key constraint)
    op.execute("DROP TABLE IF EXISTS tenant_settings CASCADE")
    
    # Drop tenants table if it exists
    op.execute("DROP TABLE IF EXISTS tenants CASCADE")
    
    # Create tenants table
    op.create_table('tenants',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False, comment='Name of the tenant'),
        sa.Column('code', sa.String(length=10), nullable=False, comment='Unique uppercase code for the tenant'),
        sa.Column('is_active', sa.Boolean(), nullable=False, comment='Whether the tenant is active'),
        sa.Column('domain', sa.String(length=255), nullable=True, comment='Domain for the tenant'),
        sa.Column('subdomain', sa.String(length=100), nullable=True, comment='Subdomain for the tenant'),
        sa.Column('logo', sa.String(length=500), nullable=True, comment='Logo URL for the tenant'),
        sa.Column('primary_color', sa.String(length=7), nullable=True, comment='Primary color for branding (hex)'),
        sa.Column('secondary_color', sa.String(length=7), nullable=True, comment='Secondary color for branding (hex)'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('domain')
    )
    
    # Create indexes for tenants
    op.create_index(op.f('ix_tenants_code'), 'tenants', ['code'], unique=True)
    op.create_index(op.f('ix_tenants_name'), 'tenants', ['name'], unique=False)
    
    # Create tenant_settings table
    op.create_table('tenant_settings',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('theme', sa.String(length=20), nullable=False),
        sa.Column('settings', postgresql.JSON(astext_type=sa.Text()), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create index for tenant_settings
    op.create_index(op.f('ix_tenant_settings_tenant_id'), 'tenant_settings', ['tenant_id'], unique=False)


def downgrade() -> None:
    # Drop tenant_settings table first (due to foreign key)
    op.drop_index(op.f('ix_tenant_settings_tenant_id'), table_name='tenant_settings')
    op.drop_table('tenant_settings')
    
    # Drop tenants table
    op.drop_index(op.f('ix_tenants_name'), table_name='tenants')
    op.drop_index(op.f('ix_tenants_code'), table_name='tenants')
    op.drop_table('tenants')