"""
usernames_optional_email

Sign in with email or username (docs/remodel/05-schema-plan.md §2): families often have no
email, and phones are shared, so every account gets a username unique per school
(case-insensitive) and email becomes optional.

Existing accounts get a username from their name ("ama.kollie", "ama.kollie2", ...), oldest
account first.

Revision ID: c4e7a2b9d1f5
Revises: a3c8e5f1d9b6
Create Date: 2026-10-28 20:00:00.000000

"""
import re
import unicodedata

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'c4e7a2b9d1f5'
down_revision = 'a3c8e5f1d9b6'
branch_labels = None
depends_on = None


def _word(value):
    text = unicodedata.normalize("NFKD", value or "").encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "", text.lower())


def _base(first, last, email):
    # Same rule as src/db/models/auth/username.py (copied: migrations don't import app code)
    base = ".".join(p for p in (_word(first), _word(last)) if p)
    if len(base) < 3 and email:
        base = ".".join(p for p in re.split(r"[^a-z0-9]+", email.split("@")[0].lower()) if p)
    if len(base) < 3:
        base = (base + "user") if base else "user"
    return base[:46].strip("._-") or "user"


def upgrade() -> None:
    bind = op.get_bind()
    op.add_column('users', sa.Column('username', sa.String(50), nullable=True, comment="Sign-in name (unique per school)"))

    taken = {}
    rows = bind.execute(sa.text(
        "SELECT id, tenant_id, first_name, last_name, email FROM users ORDER BY created_at NULLS LAST, id"
    )).fetchall()
    for row in rows:
        used = taken.setdefault(row.tenant_id, set())
        base = _base(row.first_name, row.last_name, row.email)
        name, n = base, 2
        while name in used:
            name, n = f"{base}{n}", n + 1
        used.add(name)
        bind.execute(sa.text("UPDATE users SET username = :u WHERE id = :id"), {"u": name, "id": row.id})

    op.alter_column('users', 'username', existing_type=sa.String(50), nullable=False)
    op.create_index('uq_users_tenant_username', 'users', ['tenant_id', sa.text('lower(username)')], unique=True)
    op.alter_column('users', 'email', existing_type=sa.String(255), nullable=True)


def downgrade() -> None:
    missing = op.get_bind().execute(sa.text("SELECT count(*) FROM users WHERE email IS NULL")).scalar()
    if missing:
        raise RuntimeError(f"{missing} accounts have no email; give them one before downgrading.")
    op.alter_column('users', 'email', existing_type=sa.String(255), nullable=False)
    op.drop_index('uq_users_tenant_username', table_name='users')
    op.drop_column('users', 'username')
