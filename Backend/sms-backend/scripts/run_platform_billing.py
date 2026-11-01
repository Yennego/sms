"""Platform billing, once a day (phase7-design.md §7):

    python -m scripts.run_platform_billing

For every school: issue the invoice for the semester in progress if it has none (the price list in
force today; the school's first term free), move the status (read-only 30 days overdue, suspended
at 60, back to active when paid; not during a grace period, never out of dormant) and send the
due-date reminders to its admins (each once; emailed by scripts/send_notifications.py).

Idempotent: running it again the same day issues and sends nothing new. Each school is committed on
its own, so one school's failure doesn't hold back the others.
"""
import logging
import sys

from src.db.session import platform_session
import src.db.models  # noqa: F401  registers every model
from src.db.models.tenant.tenant import Tenant
from src.services.billing.platform_billing import BillingService, today

logger = logging.getLogger("run_platform_billing")


def run_all() -> int:
    db = platform_session()  # every school's billing
    on = today()
    failures = issued = reminders = 0
    try:
        tenant_ids = [t.id for t in db.query(Tenant.id).order_by(Tenant.name).all()]
        for tenant_id in tenant_ids:
            try:
                result = BillingService(db).run_for_school(tenant_id, on)
                db.commit()
            except Exception:
                db.rollback()
                failures += 1
                logger.exception("tenant %s: failed", tenant_id)
                continue
            issued += 1 if result["issued"] else 0
            reminders += result["reminders"]
            if result["issued"] or result["reminders"] or result.get("skipped"):
                logger.info("tenant %s: issued %s, status %s, %d reminders%s", tenant_id, result["issued"] or "-",
                            result["status"], result["reminders"],
                            f", skipped ({result['skipped']})" if result.get("skipped") else "")
    finally:
        db.close()
    logger.info("done %s: %d invoices issued, %d reminders, %d failures", on, issued, reminders, failures)
    return failures


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    sys.exit(1 if run_all() else 0)
