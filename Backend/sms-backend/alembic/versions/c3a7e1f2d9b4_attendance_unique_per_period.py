"""
attendance_unique_per_period

One attendance record per student, class, date AND period/schedule, so marking
period 2 no longer overwrites period 1.

Revision ID: c3a7e1f2d9b4
Revises: b4b19a40e0c9
Create Date: 2026-10-24 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'c3a7e1f2d9b4'
down_revision = 'b4b19a40e0c9'
branch_labels = None
depends_on = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    uniques = {uc['name'] for uc in inspector.get_unique_constraints('attendances')}
    if 'unique_student_class_date_attendance' in uniques:
        op.drop_constraint('unique_student_class_date_attendance', 'attendances', type_='unique')

    # Must match the Index in src/db/models/academics/attendance.py
    op.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_attendance_student_class_date_period "
        "ON attendances (tenant_id, student_id, class_id, date, "
        "coalesce(CAST(schedule_id AS VARCHAR), period, 'day'))"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS uq_attendance_student_class_date_period")
    # Fails if a student now has more than one period recorded for the same class/date
    op.create_unique_constraint(
        'unique_student_class_date_attendance', 'attendances', ['student_id', 'class_id', 'date']
    )
