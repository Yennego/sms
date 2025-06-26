"""add tenant branding fields

Revision ID: f7sadvgfiu768
Revises: 2f9c0672a7b8
Create Date: 2025-01-XX XX:XX:XX.XXXXXX

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'f7sadvgfiu768'  # Use the filename prefix
down_revision = '2f9c0672a7b8'  # Latest migration
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add branding fields to tenants table."""
    # Add new columns to tenants table
    op.add_column('tenants', sa.Column('domain', sa.String(length=255), nullable=True, comment='Domain for the tenant'))
    op.add_column('tenants', sa.Column('subdomain', sa.String(length=100), nullable=True, comment='Subdomain for the tenant'))
    op.add_column('tenants', sa.Column('logo', sa.String(length=500), nullable=True, comment='Logo URL for the tenant'))
    op.add_column('tenants', sa.Column('primary_color', sa.String(length=7), nullable=True, comment='Primary color for branding (hex)'))
    op.add_column('tenants', sa.Column('secondary_color', sa.String(length=7), nullable=True, comment='Secondary color for branding (hex)'))


def downgrade() -> None:
    """Remove branding fields from tenants table."""
    # Remove the added columns
    op.drop_column('tenants', 'secondary_color')
    op.drop_column('tenants', 'primary_color')
    op.drop_column('tenants', 'logo')
    op.drop_column('tenants', 'subdomain')
    op.drop_column('tenants', 'domain')