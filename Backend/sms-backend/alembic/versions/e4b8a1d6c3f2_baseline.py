"""
baseline

The whole schema as of October 2026, replacing the earlier migration history (which could
not build a database from empty; it remains in git history). It keeps the revision id of the
last old migration, so databases that were already at that revision need no change.

- alembic/baseline/schema.sql: tables, constraints (composite tenant keys), indexes and the
  row level security policies, as pg_dump wrote them;
- alembic/baseline/seed_roles_permissions.sql: the system roles and permissions.

New schema changes go in new migrations on top of this one.

Revision ID: e4b8a1d6c3f2
Revises:
Create Date: 2026-10-28 16:00:00.000000

"""
from pathlib import Path

from alembic import op

# revision identifiers, used by Alembic.
revision = 'e4b8a1d6c3f2'
down_revision = None
branch_labels = None
depends_on = None

BASELINE = Path(__file__).resolve().parent.parent / "baseline"


def upgrade() -> None:
    bind = op.get_bind()
    for name in ("schema.sql", "seed_roles_permissions.sql"):
        # Raw driver call: the dump contains ':' and '%' that bound-parameter parsing would misread
        bind.exec_driver_sql((BASELINE / name).read_text(encoding="utf-8"))


def downgrade() -> None:
    raise RuntimeError("The baseline can't be downgraded; drop and recreate the database instead.")
