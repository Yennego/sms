"""The delivery worker (phase6-design.md §3): sends queued email/SMS copies of notifications.

Run by scripts/send_notifications.py every 2 minutes, across every school. Each batch takes
queued rows with SELECT ... FOR UPDATE SKIP LOCKED, so two workers never send the same message,
and commits once it has sent them. A failed send is retried after 2, then 10 minutes; the third
failure is final (status failed). A channel that isn't set up (no SMTP settings; SMS) marks its
rows skipped, which are never retried by the worker (an admin can retry them from the log).
"""
import logging
from datetime import datetime, timedelta, UTC
from typing import Dict, Optional

from sqlalchemy import or_
from sqlalchemy.orm import Session

from src.db.models.auth.user import User
from src.db.models.communication.notification import Notification, NotificationDelivery
from src.db.models.tenant.tenant import Tenant
from src.services.notification.senders import (
    MessageSender, OutgoingMessage, SendResult, SmsStubSender, SmtpEmailSender, alert_email,
)

logger = logging.getLogger(__name__)

MAX_ATTEMPTS = 3
BACKOFF = (timedelta(minutes=2), timedelta(minutes=10))  # after the 1st and 2nd failure
BATCH_SIZE = 50


def _now() -> datetime:
    return datetime.now(UTC)


def default_senders() -> Dict[str, MessageSender]:
    return {"email": SmtpEmailSender(), "sms": SmsStubSender()}


def _message(delivery: NotificationDelivery, notification: Notification, user: Optional[User],
             school_name: Optional[str]) -> Optional[OutgoingMessage]:
    if user is None or not user.is_active:
        return None
    to = user.email if delivery.channel == "email" else user.phone_number
    if not to:
        return None
    msg = alert_email(notification.title, notification.body, notification.link, school_name)
    msg.to = to
    if delivery.channel == "sms":
        msg.html = None
        msg.text = notification.body
    return msg


def send_batch(db: Session, senders: Optional[Dict[str, MessageSender]] = None, now: Optional[datetime] = None,
               batch_size: int = BATCH_SIZE) -> Dict[str, int]:
    """Send one batch of due deliveries and commit. Returns counts by outcome."""
    senders = senders or default_senders()
    now = now or _now()
    rows = (db.query(NotificationDelivery)
            .filter(NotificationDelivery.status == "queued",
                    or_(NotificationDelivery.next_attempt_at.is_(None), NotificationDelivery.next_attempt_at <= now))
            .order_by(NotificationDelivery.created_at)
            .limit(batch_size)
            .with_for_update(skip_locked=True)
            .all())
    counts = {"sent": 0, "failed": 0, "retry": 0, "skipped": 0}
    if not rows:
        db.commit()
        return counts
    notifications = {n.id: n for n in db.query(Notification).filter(
        Notification.id.in_({r.notification_id for r in rows}))}
    users = {u.id: u for u in db.query(User).filter(User.id.in_({n.user_id for n in notifications.values()}))}
    schools = dict(db.query(Tenant.id, Tenant.name).filter(Tenant.id.in_({r.tenant_id for r in rows})).all())

    for d in rows:
        n = notifications[d.notification_id]
        d.updated_at = now
        sender = senders.get(d.channel)
        message = _message(d, n, users.get(n.user_id), schools.get(d.tenant_id))
        if message is None:
            d.status, d.last_error = "skipped", "The recipient has no address for this channel or is inactive"
            counts["skipped"] += 1
            continue
        if sender is None or not sender.configured():
            d.status, d.last_error = "skipped", ("Email" if d.channel == "email" else "SMS") + " is not set up"
            counts["skipped"] += 1
            continue
        d.attempts = (d.attempts or 0) + 1
        try:
            result = sender.send(message)
        except Exception as exc:  # a sender bug must not stop the batch
            logger.exception("Delivery %s: sender error", d.id)
            result = SendResult("failed", error=f"{type(exc).__name__}: {exc}")
        if result.status == "sent":
            d.status, d.sent_at, d.provider_ref, d.last_error = "sent", now, result.provider_ref, None
            counts["sent"] += 1
        elif result.status == "skipped":
            d.status, d.last_error = "skipped", result.error
            counts["skipped"] += 1
        elif d.attempts >= MAX_ATTEMPTS:
            d.status, d.last_error = "failed", (result.error or "Failed")[:1000]
            counts["failed"] += 1
        else:
            d.last_error = (result.error or "Failed")[:1000]
            d.next_attempt_at = now + BACKOFF[min(d.attempts, len(BACKOFF)) - 1]
            counts["retry"] += 1
    db.commit()
    return counts


def send_pending(db: Session, senders: Optional[Dict[str, MessageSender]] = None, now: Optional[datetime] = None,
                 max_batches: int = 100) -> Dict[str, int]:
    """Send batches until nothing is due (or max_batches)."""
    total = {"sent": 0, "failed": 0, "retry": 0, "skipped": 0}
    for _ in range(max_batches):
        counts = send_batch(db, senders, now)
        for k, v in counts.items():
            total[k] += v
        if not any(counts.values()):
            break
    return total
