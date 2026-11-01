"""Writing alerts (phase6-design.md §2).

notify() adds one inbox notification per recipient and queues its email (and SMS) copies, in the
caller's transaction: the alerts exist exactly when the action that caused them does, and the
worker (scripts/send_notifications.py) sends the copies later. It never fails the action:
- a repeat (same school, user, event and source_key) is skipped by the unique key
  (INSERT ... ON CONFLICT DO NOTHING), so re-running the cut-off or re-publishing adds nothing;
- on PostgreSQL the writes run in a savepoint; any error is logged and only the alerts are lost.
Recipients are resolved when the alert is written: a parent linked later doesn't get old alerts.
Like the rest of the services, it only flushes; the caller commits.
"""
import logging
from datetime import datetime, UTC
from typing import Any, Dict, Iterable, List, Optional
from uuid import UUID, uuid4

from sqlalchemy import and_
from sqlalchemy.orm import Session

from src.db.models.auth.user import User
from src.db.models.communication.notification import (
    EVENTS, Notification, NotificationDelivery, NotificationPreference,
)

logger = logging.getLogger(__name__)

EVENT_LABELS = {
    "attendance_absent": "Absence alerts",
    "attendance_late": "Late arrival alerts",
    "results_published": "Results published",
    "payment_received": "Payments received",
    "announcement": "Announcements",
    "billing_reminder": "Platform billing reminders",
}


def _now() -> datetime:
    return datetime.now(UTC)


def _uuid(value) -> UUID:
    return value if isinstance(value, UUID) else UUID(str(value))


def email_disabled_users(db: Session, tenant_id, user_ids: Iterable, event: str) -> set:
    """Users (of the given ones) who turned email off for this event. No row means on."""
    ids = list({_uuid(u) for u in user_ids})
    if not ids:
        return set()
    rows = db.query(NotificationPreference.user_id).filter(
        NotificationPreference.tenant_id == _uuid(tenant_id), NotificationPreference.user_id.in_(ids),
        NotificationPreference.event == event, NotificationPreference.channel == "email",
        NotificationPreference.enabled == False,  # noqa: E712
    ).all()
    return {r[0] for r in rows}


def _insert_ignoring_repeats(db: Session, rows: List[Dict[str, Any]]) -> List[tuple]:
    """Insert notifications, skipping those already there. Returns (id, user_id) of the new ones."""
    dialect = db.get_bind().dialect.name
    if dialect in ("postgresql", "sqlite"):
        if dialect == "postgresql":
            from sqlalchemy.dialects.postgresql import insert
        else:
            from sqlalchemy.dialects.sqlite import insert
        stmt = insert(Notification).values(rows).on_conflict_do_nothing(
            index_elements=["tenant_id", "user_id", "event", "source_key"]
        ).returning(Notification.id, Notification.user_id)
        return [tuple(r) for r in db.execute(stmt).all()]
    # Other databases: check first (no concurrency guarantee)
    created = []
    for row in rows:
        exists = db.query(Notification.id).filter(and_(
            Notification.tenant_id == row["tenant_id"], Notification.user_id == row["user_id"],
            Notification.event == row["event"], Notification.source_key == row["source_key"])).first()
        if exists is None:
            db.add(Notification(**row))
            created.append((row["id"], row["user_id"]))
    db.flush()
    return created


def _write(db: Session, tenant_id: UUID, event: str, recipients: List[UUID], title: str, body: str,
           link: Optional[str], data: Optional[dict], source_key: str) -> int:
    users = {u.id: u for u in db.query(User.id, User.email, User.phone_number).filter(
        User.tenant_id == tenant_id, User.id.in_(recipients), User.is_active == True,  # noqa: E712
    ).all()}
    if not users:
        return 0
    now = _now()
    rows = [dict(id=uuid4(), tenant_id=tenant_id, created_at=now, updated_at=now, user_id=uid, event=event,
                 title=title[:255], body=body, link=link, data=data, source_key=source_key[:200])
            for uid in users]
    db.flush()  # pending ORM changes (e.g. the record that caused the alert) go first
    created = _insert_ignoring_repeats(db, rows)
    if not created:
        return 0

    no_email = email_disabled_users(db, tenant_id, [uid for _, uid in created], event)
    from src.services.tenant.features import feature_enabled
    sms_on = feature_enabled(db, tenant_id, "enable_sms_notifications")
    for notification_id, uid in created:
        user = users[uid]
        channels = []
        if user.email and uid not in no_email:
            channels.append("email")
        if sms_on and user.phone_number:
            channels.append("sms")
        for channel in channels:
            db.add(NotificationDelivery(tenant_id=tenant_id, notification_id=notification_id, channel=channel,
                                        status="queued", attempts=0, created_at=now, updated_at=now))
    db.flush()
    return len(created)


def notify(db: Session, tenant_id, *, event: str, recipients: Iterable, title: str, body: str,
           source_key: str, link: Optional[str] = None, data: Optional[dict] = None) -> int:
    """Alert each recipient (user ids of this school; inactive users are left out). Returns how many
    new inbox notifications were written (repeats count 0)."""
    if event not in EVENTS:
        raise ValueError(f"Unknown event {event}")
    tenant_id = _uuid(tenant_id)
    ids = list({_uuid(r) for r in recipients if r is not None})
    if not ids:
        return 0
    if db.get_bind().dialect.name != "postgresql":
        return _write(db, tenant_id, event, ids, title, body, link, data, source_key)
    try:
        with db.begin_nested():
            return _write(db, tenant_id, event, ids, title, body, link, data, source_key)
    except Exception:
        logger.exception("Alert %s %s for school %s was not written", event, source_key, tenant_id)
        return 0
