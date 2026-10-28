"""Mark unmarked students absent once each school's auto-absent cut-off has passed.

Run on a schedule (e.g. a Render Cron Job every 30 minutes):

    python -m scripts.close_attendance_days

Idempotent: it only creates records for students with none, so running it often is
safe. Each tenant is checked in its own timezone, for today and yesterday (in case a
run was missed after yesterday's cut-off).
"""
import logging
import sys
from datetime import timedelta

from src.core.exceptions.business import BusinessRuleViolationError
from src.db.session import platform_session
import src.db.models  # noqa: F401  registers every model
from src.db.models.tenant.tenant import Tenant
from src.services.academics.daily_attendance_service import DailyAttendanceService

logger = logging.getLogger("close_attendance_days")


def close_all_tenants() -> int:
    db = platform_session()  # runs for every school
    total = 0
    failures = 0
    try:
        tenant_ids = [t.id for t in db.query(Tenant.id).filter(Tenant.is_active == True).all()]
        for tenant_id in tenant_ids:
            service = DailyAttendanceService(tenant=tenant_id, db=db)
            today = service.school_today()
            for day in (today - timedelta(days=1), today):
                try:
                    info = service.day_info(day)
                    if not info.auto_absent_applied:
                        continue
                    count = service.fill_unmarked_absences(day)
                    total += count
                    if count:
                        logger.info("tenant %s %s: marked %d absent", tenant_id, day, count)
                except BusinessRuleViolationError as exc:
                    logger.info("tenant %s %s: skipped (%s)", tenant_id, day, exc)
                except Exception:
                    db.rollback()
                    failures += 1
                    logger.exception("tenant %s %s: failed", tenant_id, day)
    finally:
        db.close()
    logger.info("done: %d marked absent, %d failures", total, failures)
    return failures


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    sys.exit(1 if close_all_tenants() else 0)
