"""
tenant_slug_case_insensitive

School addresses (/{domain}/...) are looked up without regard to case, so make domain and
subdomain unique that way too: 'foundation' can't be added next to 'Foundation'.

Revision ID: f1a9c3e7b2d4
Revises: e4b8a1d6c3f2
Create Date: 2026-10-28 18:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'f1a9c3e7b2d4'
down_revision = 'e4b8a1d6c3f2'
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    for column in ("domain", "subdomain"):
        clashes = bind.execute(sa.text(
            f"SELECT count(*) FROM (SELECT 1 FROM tenants WHERE {column} IS NOT NULL "
            f"GROUP BY lower({column}) HAVING count(*) > 1) d"
        )).scalar()
        if clashes:
            raise RuntimeError(f"Schools share a {column} that differs only in case; rename one first.")
        op.create_index(f"uq_tenants_{column}_lower", "tenants", [sa.text(f"lower({column})")], unique=True)


def downgrade() -> None:
    op.drop_index("uq_tenants_subdomain_lower", table_name="tenants")
    op.drop_index("uq_tenants_domain_lower", table_name="tenants")
