"""
enrollment_year_name

Enrollments made by admission, import and class placement left the legacy `academic_year` text
(the year's name) empty, and the enrollments list requires it, so the whole page failed and showed
none. New enrollments now copy it from their class; this fills it in for the ones already saved.

Revision ID: d4a8e2c6f1b3
Revises: c3f9a1d7e2b8
"""
from alembic import op

revision = "d4a8e2c6f1b3"
down_revision = "c3f9a1d7e2b8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        UPDATE enrollments e SET academic_year = y.name
        FROM academic_years y
        WHERE y.id = e.academic_year_id AND e.academic_year IS NULL
    """)


def downgrade() -> None:
    pass  # the names are correct either way
