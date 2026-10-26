"""
import_period_attendance

Copy existing period attendance (attendances) into school-day attendance
(daily_attendances): one record per student per date, keeping the best status
(present > late > tardy > excused > sick > absent). Days that already have a
daily record are left alone. Each imported record gets an audit event.

Revision ID: a7d2e5c9f413
Revises: f1c9d3e7a2b5
Create Date: 2026-10-27 09:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'a7d2e5c9f413'
down_revision = 'f1c9d3e7a2b5'
branch_labels = None
depends_on = None

IMPORT_REASON = 'Imported from period attendance'


def upgrade() -> None:
    op.get_bind().execute(sa.text("""
        WITH best AS (
            SELECT DISTINCT ON (tenant_id, student_id, date) *
            FROM attendances
            ORDER BY tenant_id, student_id, date,
                     CASE status::text
                         WHEN 'PRESENT' THEN 1 WHEN 'LATE' THEN 2 WHEN 'TARDY' THEN 3
                         WHEN 'EXCUSED' THEN 4 WHEN 'SICK' THEN 5 ELSE 6
                     END,
                     marked_at DESC
        ),
        inserted AS (
            INSERT INTO daily_attendances (
                id, created_at, updated_at, tenant_id, student_id, class_id, academic_year_id,
                date, status, source, marked_by, marked_at, notes,
                excuse_reason, excuse_status, excuse_reviewed_by
            )
            SELECT gen_random_uuid(), now(), now(), b.tenant_id, b.student_id, b.class_id, b.academic_year_id,
                   b.date, b.status, 'MANUAL', b.marked_by, COALESCE(b.marked_at, now()), b.notes,
                   CASE WHEN b.status::text = 'EXCUSED'
                        THEN COALESCE(NULLIF(b.notes, ''), 'Recorded in period attendance') END,
                   CASE WHEN b.status::text = 'EXCUSED' THEN 'APPROVED'::excusestatus END,
                   CASE WHEN b.status::text = 'EXCUSED' THEN b.marked_by END
            FROM best b
            ON CONFLICT (tenant_id, student_id, date) DO NOTHING
            RETURNING id, tenant_id, student_id, status, marked_by
        )
        INSERT INTO attendance_events (
            id, created_at, updated_at, tenant_id, daily_attendance_id, student_id,
            event_type, new_status, actor_id, reason, occurred_at
        )
        SELECT gen_random_uuid(), now(), now(), tenant_id, id, student_id,
               'manual_set', lower(status::text), marked_by, :reason, now()
        FROM inserted
    """), {"reason": IMPORT_REASON})


def downgrade() -> None:
    # Remove imported records nobody has touched since (only the import event exists)
    bind = op.get_bind()
    untouched = sa.text("""
        SELECT e.daily_attendance_id FROM attendance_events e
        WHERE e.reason = :reason
          AND NOT EXISTS (
              SELECT 1 FROM attendance_events o
              WHERE o.daily_attendance_id = e.daily_attendance_id AND o.id <> e.id
          )
    """)
    ids = [row[0] for row in bind.execute(untouched, {"reason": IMPORT_REASON})]
    if not ids:
        return
    params = {"ids": ids}
    bind.execute(sa.text("DELETE FROM attendance_events WHERE daily_attendance_id = ANY(:ids)"), params)
    bind.execute(sa.text("DELETE FROM attendance_documents WHERE daily_attendance_id = ANY(:ids)"), params)
    bind.execute(sa.text("DELETE FROM daily_attendances WHERE id = ANY(:ids)"), params)
