"""
lowercase_tenant_slugs

School addresses are lower case: store every domain and subdomain that way
('Foundation' -> 'foundation'). New and changed ones are lower-cased on save.

Revision ID: a3c8e5f1d9b6
Revises: f1a9c3e7b2d4
Create Date: 2026-10-28 19:00:00.000000

"""
from alembic import op

# revision identifiers, used by Alembic.
revision = 'a3c8e5f1d9b6'
down_revision = 'f1a9c3e7b2d4'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # The case-insensitive unique indexes (f1a9c3e7b2d4) guarantee this can't collide
    op.execute("UPDATE tenants SET domain = lower(trim(domain)) WHERE domain IS NOT NULL AND domain <> lower(trim(domain))")
    op.execute("UPDATE tenants SET subdomain = lower(trim(subdomain)) WHERE subdomain IS NOT NULL AND subdomain <> lower(trim(subdomain))")


def downgrade() -> None:
    # The original capitalisation isn't kept; lower-case addresses work either way
    pass
