"""
phase6_communication

Communication (docs/remodel/phase6-design.md §3-§4).

1. notifications and announcements are rebuilt; their old rows are dropped (old notifications
   had no school; there is no working screen for the old announcements). Nothing else references
   either table (checked first: the migration stops if something does). The old enum type
   announcementtargettype goes too.
2. New tables, with composite tenant keys (fk_tn_/uq_tn_) and row level security:
   notifications, notification_deliveries, notification_preferences, announcements, files.
   Nothing cascades on delete.
3. attendance_documents gains file_id: each document's bytes are written to the file storage
   configured in settings (FILE_STORAGE: local disk by default, or s3) with a files row, and the
   old data column is dropped.
4. attendance_events gains client_scan_id, unique per school when set (offline gate queue).
5. Permission send_announcements, granted to the admin system role.

Downgrade recreates the old notifications/announcements tables EMPTY, copies the documents' bytes
back from storage into attendance_documents.data (a document whose bytes are missing is removed
and reported; the stored objects are left in place), drops the new tables, client_scan_id and the
send_announcements permission.

Revision ID: b6f2d9a4e8c1
Revises: d2b7e4a9c1f3
Create Date: 2026-10-31 12:00:00.000000

"""
import hashlib
import uuid

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

# revision identifiers, used by Alembic.
revision = 'b6f2d9a4e8c1'
down_revision = 'd2b7e4a9c1f3'
branch_labels = None
depends_on = None

TAG = "[phase6_communication]"
RLS_CHECK = (
    "(current_setting('app.bypass_rls', true) = 'on' "
    "OR tenant_id::text = current_setting('app.tenant_id', true))"
)
NEW_TABLES = ("notification_deliveries", "notification_preferences", "notifications", "announcements", "files")
PERMISSION = "send_announcements"


def _bypass_rls(bind):
    bind.execute(sa.text("SELECT set_config('app.bypass_rls', 'on', true)"))


def _rows(bind, sql, **params):
    return bind.execute(sa.text(sql), params).mappings().all()


def _enable_rls(table):
    op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
    op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")
    op.execute(f"CREATE POLICY tenant_isolation ON {table} USING {RLS_CHECK} WITH CHECK {RLS_CHECK}")


def _base(table, *columns, **kw):
    """id, tenant_id, timestamps, the composite key target and the given columns."""
    return op.create_table(
        table,
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('tenant_id', UUID(as_uuid=True), sa.ForeignKey('tenants.id', ondelete='RESTRICT'), nullable=False),
        *columns,
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint('tenant_id', 'id', name=f'uq_tn_{table}'),
        **kw,
    )


def _fk(table, column, target):
    return sa.ForeignKeyConstraint(['tenant_id', column], [f'{target}.tenant_id', f'{target}.id'],
                                   name=f'fk_tn_{table}_{column}', ondelete='RESTRICT')


def _storage():
    # The storage the app is configured with (FILE_STORAGE; local disk by default)
    from src.services.files.storage import build_storage
    return build_storage()


def _check_references(bind):
    refs = _rows(bind, """
        SELECT conname, conrelid::regclass::text AS source, confrelid::regclass::text AS target FROM pg_constraint
        WHERE contype = 'f' AND confrelid IN ('notifications'::regclass, 'announcements'::regclass)
          AND conrelid NOT IN ('notifications'::regclass, 'announcements'::regclass)
    """)
    if refs:
        raise RuntimeError(f"{TAG} other tables reference notifications/announcements: "
                           + ", ".join(f"{r['source']}.{r['conname']} -> {r['target']}" for r in refs))


def _create_tables():
    _base('files',
          sa.Column('storage_key', sa.String(255), nullable=False),
          sa.Column('filename', sa.String(255), nullable=False),
          sa.Column('content_type', sa.String(100), nullable=False),
          sa.Column('size_bytes', sa.Integer(), nullable=False),
          sa.Column('sha256', sa.String(64), nullable=False),
          sa.Column('uploaded_by', UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=True),
          sa.UniqueConstraint('storage_key', name='uq_files_storage_key'))

    _base('notifications',
          sa.Column('user_id', UUID(as_uuid=True), nullable=False),
          sa.Column('event', sa.String(40), nullable=False),
          sa.Column('title', sa.String(255), nullable=False),
          sa.Column('body', sa.Text(), nullable=False),
          sa.Column('link', sa.String(500), nullable=True),
          sa.Column('data', sa.JSON(), nullable=True),
          sa.Column('source_key', sa.String(200), nullable=False),
          sa.Column('read_at', sa.DateTime(timezone=True), nullable=True),
          _fk('notifications', 'user_id', 'users'),
          sa.UniqueConstraint('tenant_id', 'user_id', 'event', 'source_key', name='uq_notifications_user_event_source'))
    op.create_index('ix_notifications_inbox', 'notifications', ['tenant_id', 'user_id', 'created_at'])

    _base('notification_deliveries',
          sa.Column('notification_id', UUID(as_uuid=True), nullable=False),
          sa.Column('channel', sa.String(10), nullable=False),
          sa.Column('status', sa.String(10), nullable=False, server_default='queued'),
          sa.Column('attempts', sa.Integer(), nullable=False, server_default='0'),
          sa.Column('last_error', sa.Text(), nullable=True),
          sa.Column('provider_ref', sa.String(255), nullable=True),
          sa.Column('next_attempt_at', sa.DateTime(timezone=True), nullable=True),
          sa.Column('sent_at', sa.DateTime(timezone=True), nullable=True),
          _fk('notification_deliveries', 'notification_id', 'notifications'),
          sa.CheckConstraint("channel IN ('email', 'sms')", name='ck_notification_deliveries_channel'),
          sa.CheckConstraint("status IN ('queued', 'sent', 'failed', 'skipped')", name='ck_notification_deliveries_status'))
    op.create_index('ix_notification_deliveries_queue', 'notification_deliveries', ['status', 'next_attempt_at'])
    op.create_index('ix_notification_deliveries_notification', 'notification_deliveries', ['tenant_id', 'notification_id'])

    _base('notification_preferences',
          sa.Column('user_id', UUID(as_uuid=True), nullable=False),
          sa.Column('event', sa.String(40), nullable=False),
          sa.Column('channel', sa.String(10), nullable=False),
          sa.Column('enabled', sa.Boolean(), nullable=False, server_default=sa.text('true')),
          _fk('notification_preferences', 'user_id', 'users'),
          sa.UniqueConstraint('tenant_id', 'user_id', 'event', 'channel',
                              name='uq_notification_preferences_user_event_channel'))

    _base('announcements',
          sa.Column('title', sa.String(200), nullable=False),
          sa.Column('body', sa.Text(), nullable=False),
          sa.Column('audience', sa.String(10), nullable=False),
          sa.Column('audience_role', sa.String(20), nullable=True),
          sa.Column('class_id', UUID(as_uuid=True), nullable=True),
          sa.Column('student_id', UUID(as_uuid=True), nullable=True),
          sa.Column('author_id', UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
          sa.Column('sent_at', sa.DateTime(timezone=True), nullable=False),
          sa.Column('withdrawn_at', sa.DateTime(timezone=True), nullable=True),
          sa.Column('withdrawn_by', UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=True),
          sa.Column('recipient_count', sa.Integer(), nullable=False, server_default='0'),
          _fk('announcements', 'class_id', 'classes'),
          _fk('announcements', 'student_id', 'students'),
          sa.CheckConstraint("audience IN ('all', 'role', 'class', 'family')", name='ck_announcements_audience'),
          sa.CheckConstraint("(audience = 'role') = (audience_role IS NOT NULL)", name='ck_announcements_role'),
          sa.CheckConstraint("(audience = 'class') = (class_id IS NOT NULL)", name='ck_announcements_class'),
          sa.CheckConstraint("(audience = 'family') = (student_id IS NOT NULL)", name='ck_announcements_family'),
          sa.CheckConstraint("audience_role IS NULL OR audience_role IN ('parents', 'students', 'teachers', 'staff')",
                             name='ck_announcements_audience_role'))
    op.create_index('ix_announcements_sent_at', 'announcements', ['tenant_id', 'sent_at'])

    for table in NEW_TABLES:
        op.create_index(f'ix_{table}_tenant_id', table, ['tenant_id'])
        _enable_rls(table)


def _move_documents(bind):
    op.add_column('attendance_documents', sa.Column('file_id', UUID(as_uuid=True), nullable=True))
    storage = _storage()
    docs = _rows(bind, "SELECT id, tenant_id, filename, content_type, data, uploaded_by, created_at "
                       "FROM attendance_documents ORDER BY created_at")
    for d in docs:
        data = bytes(d["data"])
        file_id = uuid.uuid4()
        key = f"{d['tenant_id']}/{file_id}"
        storage.put(key, data, d["content_type"])
        bind.execute(sa.text("""
            INSERT INTO files (id, tenant_id, storage_key, filename, content_type, size_bytes, sha256, uploaded_by,
                               created_at, updated_at)
            VALUES (:id, :t, :key, :name, :type, :size, :sha, :by, :at, now())
        """), {"id": file_id, "t": d["tenant_id"], "key": key, "name": d["filename"], "type": d["content_type"],
               "size": len(data), "sha": hashlib.sha256(data).hexdigest(), "by": d["uploaded_by"],
               "at": d["created_at"]})
        bind.execute(sa.text("UPDATE attendance_documents SET file_id = :f WHERE id = :id"), {"f": file_id, "id": d["id"]})
    print(f"{TAG} attendance_documents: {len(docs)} documents copied to {storage.name} storage")
    op.alter_column('attendance_documents', 'file_id', nullable=False)
    op.create_foreign_key('fk_tn_attendance_documents_file_id', 'attendance_documents', 'files',
                          ['tenant_id', 'file_id'], ['tenant_id', 'id'])
    op.drop_column('attendance_documents', 'data')


def upgrade() -> None:
    bind = op.get_bind()
    _bypass_rls(bind)

    _check_references(bind)
    old = {t: bind.execute(sa.text(f"SELECT count(*) FROM {t}")).scalar() for t in ("notifications", "announcements")}
    op.drop_table('announcements')
    op.execute("DROP TYPE IF EXISTS announcementtargettype")
    op.drop_table('notifications')
    print(f"{TAG} old tables dropped: notifications ({old['notifications']} rows), "
          f"announcements ({old['announcements']} rows)")

    _create_tables()
    _move_documents(bind)

    op.add_column('attendance_events', sa.Column('client_scan_id', sa.String(64), nullable=True))
    op.create_unique_constraint('uq_attendance_events_client_scan_id', 'attendance_events', ['tenant_id', 'client_scan_id'])

    bind.execute(sa.text("""
        INSERT INTO permissions (id, name, description, created_at, updated_at)
        SELECT :id, :name, 'Send announcements to the whole school, a role, any class or a family', now(), now()
        WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = :name)
    """), {"id": uuid.uuid4(), "name": PERMISSION})
    granted = bind.execute(sa.text("""
        INSERT INTO permission_role (permission_id, role_id)
        SELECT p.id, r.id FROM permissions p, user_roles r
        WHERE p.name = :name AND r.name = 'admin' AND r.tenant_id IS NULL
        ON CONFLICT DO NOTHING
    """), {"name": PERMISSION}).rowcount
    print(f"{TAG} permission {PERMISSION} granted to admin: {granted} new")


def downgrade() -> None:
    bind = op.get_bind()
    _bypass_rls(bind)

    bind.execute(sa.text("DELETE FROM permission_role WHERE permission_id IN (SELECT id FROM permissions WHERE name = :n)"),
                 {"n": PERMISSION})
    bind.execute(sa.text("DELETE FROM permissions WHERE name = :n"), {"n": PERMISSION})

    op.drop_constraint('uq_attendance_events_client_scan_id', 'attendance_events', type_='unique')
    op.drop_column('attendance_events', 'client_scan_id')

    # Documents: bytes back into the table
    op.add_column('attendance_documents', sa.Column('data', sa.LargeBinary(), nullable=True))
    storage = _storage()
    missing = []
    docs = _rows(bind, "SELECT d.id, f.storage_key FROM attendance_documents d JOIN files f ON f.id = d.file_id")
    for d in docs:
        try:
            data = storage.get(d["storage_key"])
        except Exception:
            missing.append(d["id"])
            continue
        bind.execute(sa.text("UPDATE attendance_documents SET data = :data WHERE id = :id"), {"data": data, "id": d["id"]})
    if missing:
        print(f"{TAG} {len(missing)} documents removed (bytes missing from storage): {missing[:50]}")
        bind.execute(sa.text("DELETE FROM attendance_documents WHERE id = ANY(:ids)"), {"ids": missing})
    print(f"{TAG} downgrade: {len(docs) - len(missing)} documents copied back from storage (objects left in place)")
    op.alter_column('attendance_documents', 'data', nullable=False)
    op.drop_constraint('fk_tn_attendance_documents_file_id', 'attendance_documents', type_='foreignkey')
    op.drop_column('attendance_documents', 'file_id')

    for table in NEW_TABLES:
        op.drop_table(table)

    # The old tables, EMPTY, as the baseline had them
    op.create_table(
        'notifications',
        sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('notification_type', sa.String(50), nullable=False),
        sa.Column('status', sa.String(50), nullable=False),
        sa.Column('is_read', sa.Boolean(), nullable=False),
        sa.Column('notification_metadata', sa.JSON(), nullable=True),
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
    )
    target = sa.Enum('ALL', 'STUDENTS', 'TEACHERS', 'PARENTS', 'GRADE', 'SECTION', 'CUSTOM',
                     name='announcementtargettype')
    op.create_table(
        'announcements',
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('author_id', UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('target_type', target, nullable=False),
        sa.Column('target_id', UUID(as_uuid=True), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('is_pinned', sa.Boolean(), nullable=False),
        sa.Column('publish_date', sa.DateTime(timezone=True), nullable=False),
        sa.Column('expiry_date', sa.DateTime(timezone=True), nullable=True),
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('tenant_id', UUID(as_uuid=True), sa.ForeignKey('tenants.id', ondelete='RESTRICT'), nullable=False),
    )
    op.create_index('ix_announcements_tenant_id', 'announcements', ['tenant_id'])
    _enable_rls('announcements')
    print(f"{TAG} downgrade: old notifications/announcements tables recreated EMPTY")
