"""What a school's billing status allows (phase7-design.md §1, §5), and usage recording at sign-in.

`enforce_school_billing` runs on every API route after `authenticate_request` and reads the stored
status (one primary-key lookup; the amount due is only worked out for a refusal):
- read_only and dormant: reads (GET) work; every change is refused (403) except WRITE_ALLOWED;
- suspended: only the school's admins (built-in `admin` role), and only WRITE_ALLOWED and
  SUSPENDED_READS; everyone else is refused everything but the billing status;
- platform accounts, platform routes (no school bound) and public routes are never affected.
Refusals carry the status in the X-School-Billing-Status header and name the amount due for admins.

Sign-in and session refresh refuse non-admins of a suspended school, and record the user's month in
user_activity_months once (INSERT ... ON CONFLICT DO NOTHING); recording never fails a sign-in.
"""
import logging

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from src.core.security.auth import is_super_admin
from src.db.models.billing import UserActivityMonth
from src.db.session import bind_session_to_tenant, get_db
from src.services.billing import platform_billing as pb

logger = logging.getLogger(__name__)

API = "/api/v1"
STATUS_HEADER = "X-School-Billing-Status"
RESTRICTED = ("read_only", "suspended", "dormant")

# Changes still allowed while a school is read-only or suspended: signing in and out, one's own
# password, one's own inbox, and the few reads the app sends as POST
WRITE_ALLOWED = {
    ("POST", f"{API}/auth/login"),
    ("POST", f"{API}/auth/refresh"),
    ("POST", f"{API}/auth/logout"),
    ("POST", f"{API}/auth/change-password"),
    ("POST", f"{API}/communication/inbox/read-all"),
    ("POST", f"{API}/communication/inbox/{{notification_id}}/read"),
    ("POST", f"{API}/people/students/bulk-enrollments"),
    ("POST", f"{API}/academics/promotions/evaluate"),
    ("POST", f"{API}/academics/remedial/identify"),
}
# What a suspended school's admin can still open: the app shell, the inbox and everything under
# /billing (amount due, invoices, receipts, export)
SUSPENDED_READS = {
    f"{API}/auth/me",
    f"{API}/tenants/{{tenant_id}}",  # the school by id (the address may hold the id)
    f"{API}/tenants/{{tenant_id}}/settings",
    f"{API}/tenants/self/profile",
    f"{API}/communication/inbox",
    f"{API}/communication/inbox/unread-count",
}
BILLING_PREFIX = f"{API}/billing"
BILLING_STATUS = f"{API}/billing/status"


def refusal(db: Session, tenant_id, user, current: str) -> HTTPException:
    admin = pb.is_school_admin(user)
    message = None
    if admin:
        acct = pb.BillingService(db).account(tenant_id)
        message = pb.status_message(current, acct["amount_due"], acct["oldest_due_date"], None, True)
    message = message or pb.status_message(current, {}, None, None, False)
    return HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=message, headers={STATUS_HEADER: current})


async def enforce_school_billing(request: Request, db: Session = Depends(get_db)) -> None:
    """Router-level guard (after authenticate_request): applies the school's stored billing status."""
    user = getattr(request.state, "current_user", None)
    tenant_id = getattr(request.state, "tenant_id", None)
    if user is None or tenant_id is None or is_super_admin(user):
        return
    current = pb.stored_status(db, tenant_id)
    if current not in RESTRICTED:
        return
    route = request.scope.get("route")
    template = getattr(route, "path", request.url.path)
    method = request.method
    reading = method in ("GET", "HEAD")
    allowed_write = (method, template) in WRITE_ALLOWED
    if current == "suspended":
        if (reading and template == BILLING_STATUS) or (method, template) == ("POST", f"{API}/auth/logout"):
            return  # anyone: the banner's explanation, and signing out
        if pb.is_school_admin(user) and (allowed_write or (reading and (
                template in SUSPENDED_READS or template.startswith(BILLING_PREFIX)))):
            return
        raise refusal(db, tenant_id, user, current)
    if reading or allowed_write:
        return
    raise refusal(db, tenant_id, user, current)


def check_sign_in(db: Session, user) -> None:
    """Sign-in and refresh: a suspended school lets only its admins in."""
    if is_super_admin(user) or user.tenant_id is None:
        return
    if pb.stored_status(db, user.tenant_id) == "suspended" and not pb.is_school_admin(user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                            detail="Your school's account is suspended. Only the school's administrators can sign in.",
                            headers={STATUS_HEADER: "suspended"})


def record_activity(db: Session, user) -> None:
    """Note that the user was active this month (once per month). Never raises."""
    try:
        if is_super_admin(user) or user.tenant_id is None:
            return
        values = {"tenant_id": user.tenant_id, "user_id": user.id, "month": pb.today().replace(day=1)}
        # Row level security: the write belongs to the user's own school
        bind_session_to_tenant(db, user.tenant_id)
        dialect = db.get_bind().dialect.name
        if dialect == "postgresql":
            from sqlalchemy.dialects.postgresql import insert
            with db.begin_nested():
                db.execute(insert(UserActivityMonth).values(**values).on_conflict_do_nothing())
        elif dialect == "sqlite":
            from sqlalchemy.dialects.sqlite import insert
            db.execute(insert(UserActivityMonth).values(**values).on_conflict_do_nothing())
        elif db.get(UserActivityMonth, (values["tenant_id"], values["user_id"], values["month"])) is None:
            db.add(UserActivityMonth(**values))
            db.flush()
    except Exception:
        logger.exception("Activity month for user %s was not recorded", getattr(user, "id", None))
