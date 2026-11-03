"""
principal_fees_and_school_logo

1. The principal (academic-admin system role) reviews fees and approves voids: a payment voided
   after its day goes to the bursar the same day, then to the principal or admin. Grants
   view_financial_data and approve_financial_transactions to academic-admin. Recording payments
   and fee setup stay with the bursar and the admin.
2. tenants.logo_image: a logo uploaded on the School profile page (PNG, like the seal), served at
   GET /tenants/{id}/logo; tenants.logo then points there. A platform table: no row level security,
   so the public sign-in page can show it.

Downgrade takes both permissions back from academic-admin and drops the column (a logo URL that
pointed at an uploaded logo is cleared).

Revision ID: a7c3e9f1b2d4
Revises: e5a1c8d3b7f4
Create Date: 2026-11-02 10:00:00.000000

"""
import uuid

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'a7c3e9f1b2d4'
down_revision = 'e5a1c8d3b7f4'
branch_labels = None
depends_on = None

TAG = "[principal_fees_and_school_logo]"
ROLE = "academic-admin"
GRANTED = ("view_financial_data", "approve_financial_transactions")


def upgrade() -> None:
    bind = op.get_bind()
    for name in GRANTED:
        bind.execute(sa.text("""
            INSERT INTO permissions (id, name, description, created_at, updated_at)
            SELECT :id, :name, :name, now(), now()
            WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = :name)
        """), {"id": uuid.uuid4(), "name": name})
    granted = bind.execute(sa.text("""
        INSERT INTO permission_role (permission_id, role_id)
        SELECT p.id, r.id FROM permissions p, user_roles r
        WHERE p.name = ANY(:names) AND r.name = :role AND r.tenant_id IS NULL
        ON CONFLICT DO NOTHING
    """), {"names": list(GRANTED), "role": ROLE}).rowcount
    print(f"{TAG} permissions granted to {ROLE}: {granted} new")

    op.add_column('tenants', sa.Column('logo_image', sa.LargeBinary(), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    bind.execute(sa.text("UPDATE tenants SET logo = NULL WHERE logo LIKE '/api/v1/tenants/%/logo%'"))
    op.drop_column('tenants', 'logo_image')
    bind.execute(sa.text("""
        DELETE FROM permission_role
        WHERE permission_id IN (SELECT id FROM permissions WHERE name = ANY(:names))
          AND role_id IN (SELECT id FROM user_roles WHERE name = :role AND tenant_id IS NULL)
    """), {"names": list(GRANTED), "role": ROLE})
