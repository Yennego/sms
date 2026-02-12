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
    from alembic import op
    import sqlalchemy as sa

    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tenant_cols = {c['name'] for c in inspector.get_columns('tenants')}

    if 'domain' not in tenant_cols:
        op.add_column('tenants', sa.Column('domain', sa.String(length=255), nullable=True))
    if 'subdomain' not in tenant_cols:
        op.add_column('tenants', sa.Column('subdomain', sa.String(length=255), nullable=True))
    if 'logo' not in tenant_cols:
        op.add_column('tenants', sa.Column('logo', sa.String(length=255), nullable=True))
    if 'primary_color' not in tenant_cols:
        op.add_column('tenants', sa.Column('primary_color', sa.String(length=20), nullable=True))
    if 'secondary_color' not in tenant_cols:
        op.add_column('tenants', sa.Column('secondary_color', sa.String(length=20), nullable=True))


def downgrade() -> None:
    """Remove branding fields from tenants table."""
    # Remove the added columns
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tenant_cols = {c['name'] for c in inspector.get_columns('tenants')}

    for col in ['secondary_color', 'primary_color', 'logo', 'subdomain', 'domain']:
        if col in tenant_cols:
            op.drop_column('tenants', col)