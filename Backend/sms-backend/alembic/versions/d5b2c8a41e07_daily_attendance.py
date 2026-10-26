"""
daily_attendance

School-day attendance (one row per student per day), its audit log,
per-tenant attendance settings and the school calendar (holidays / make-up days).

Revision ID: d5b2c8a41e07
Revises: c3a7e1f2d9b4
Create Date: 2026-10-25 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'd5b2c8a41e07'
down_revision = 'c3a7e1f2d9b4'
branch_labels = None
depends_on = None

# attendancestatus already exists (attendances.status); reuse it
attendance_status = postgresql.ENUM(
    'PRESENT', 'ABSENT', 'LATE', 'EXCUSED', 'SICK', 'TARDY', name='attendancestatus', create_type=False
)
attendance_source = postgresql.ENUM('QR', 'MANUAL', 'AUTO', name='attendancesource')
excuse_status = postgresql.ENUM('PENDING', 'APPROVED', 'REJECTED', name='excusestatus')


def _base_columns():
    return [
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('tenant_id', sa.UUID(), sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False),
    ]


def upgrade() -> None:
    bind = op.get_bind()
    attendance_source.create(bind, checkfirst=True)
    excuse_status.create(bind, checkfirst=True)

    op.create_table(
        'daily_attendances',
        *_base_columns(),
        sa.Column('student_id', sa.UUID(), sa.ForeignKey('students.id'), nullable=False),
        sa.Column('class_id', sa.UUID(), sa.ForeignKey('classes.id'), nullable=False),
        sa.Column('academic_year_id', sa.UUID(), sa.ForeignKey('academic_years.id'), nullable=False),
        sa.Column('date', sa.Date(), nullable=False),
        sa.Column('status', attendance_status, nullable=False),
        sa.Column('check_in_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('check_out_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('source', postgresql.ENUM(name='attendancesource', create_type=False), nullable=False),
        sa.Column('marked_by', sa.UUID(), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('marked_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('excuse_reason', sa.Text(), nullable=True),
        sa.Column('excuse_status', postgresql.ENUM(name='excusestatus', create_type=False), nullable=True),
        sa.Column('excuse_document_url', sa.String(length=500), nullable=True),
        sa.Column('excuse_reviewed_by', sa.UUID(), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('tenant_id', 'student_id', 'date', name='uq_daily_attendance_student_date'),
    )
    op.create_index('ix_daily_attendances_tenant_id', 'daily_attendances', ['tenant_id'])
    op.create_index('ix_daily_attendances_date', 'daily_attendances', ['date'])
    op.create_index('idx_daily_att_tenant_class_date', 'daily_attendances', ['tenant_id', 'class_id', 'date'])

    op.create_table(
        'attendance_events',
        *_base_columns(),
        sa.Column('daily_attendance_id', sa.UUID(), sa.ForeignKey('daily_attendances.id'), nullable=True),
        sa.Column('student_id', sa.UUID(), sa.ForeignKey('students.id'), nullable=True),
        sa.Column('event_type', sa.String(length=30), nullable=False),
        sa.Column('old_status', sa.String(length=20), nullable=True),
        sa.Column('new_status', sa.String(length=20), nullable=True),
        sa.Column('actor_id', sa.UUID(), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('device_label', sa.String(length=100), nullable=True),
        sa.Column('reason', sa.Text(), nullable=True),
        sa.Column('occurred_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_attendance_events_tenant_id', 'attendance_events', ['tenant_id'])
    op.create_index('idx_att_events_tenant_daily', 'attendance_events', ['tenant_id', 'daily_attendance_id'])

    op.create_table(
        'attendance_settings',
        *_base_columns(),
        sa.Column('timezone', sa.String(length=64), nullable=False),
        sa.Column('school_days', sa.JSON(), nullable=False),
        sa.Column('late_after', sa.Time(), nullable=False),
        sa.Column('scan_closes_at', sa.Time(), nullable=False),
        sa.Column('auto_absent_at', sa.Time(), nullable=False),
        sa.Column('allow_checkout_scan', sa.Boolean(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('tenant_id', name='uq_attendance_settings_tenant'),
    )
    op.create_index('ix_attendance_settings_tenant_id', 'attendance_settings', ['tenant_id'])

    op.create_table(
        'school_calendar_days',
        *_base_columns(),
        sa.Column('date', sa.Date(), nullable=False),
        sa.Column('is_school_day', sa.Boolean(), nullable=False),
        sa.Column('label', sa.String(length=100), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('tenant_id', 'date', name='uq_school_calendar_day'),
    )
    op.create_index('ix_school_calendar_days_tenant_id', 'school_calendar_days', ['tenant_id'])


def downgrade() -> None:
    op.drop_table('school_calendar_days')
    op.drop_table('attendance_settings')
    op.drop_table('attendance_events')
    op.drop_table('daily_attendances')
    bind = op.get_bind()
    excuse_status.drop(bind, checkfirst=True)
    attendance_source.drop(bind, checkfirst=True)
