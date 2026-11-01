"""Send queued alert emails (and SMS, a stub for now) for every school.

Run on a schedule, every 2 minutes (phase6-design.md §1 "Timing"):

    python -m scripts.send_notifications

Safe to run often and side by side: each batch locks its rows (FOR UPDATE SKIP LOCKED). While
SMTP_SERVER / SENDER_EMAIL / SENDER_PASSWORD are unset, queued emails are marked skipped.
"""
import logging
import sys

from src.db.session import platform_session
import src.db.models  # noqa: F401  registers every model
from src.services.notification.dispatch import send_pending

logger = logging.getLogger("send_notifications")


def send_all() -> int:
    db = platform_session()  # deliveries of every school
    try:
        counts = send_pending(db)
    except Exception:
        db.rollback()
        logger.exception("failed")
        return 1
    finally:
        db.close()
    logger.info("done: %(sent)d sent, %(retry)d to retry, %(failed)d failed, %(skipped)d skipped", counts)
    return 0


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    sys.exit(send_all())
