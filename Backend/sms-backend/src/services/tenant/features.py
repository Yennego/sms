"""School feature switches (tenant_settings.settings["features"]), set by the platform operator.

A switch the school's settings don't mention takes TenantSettings.DEFAULT_SETTINGS.

The switchable school areas form the school's ceiling: an area that is off is refused by the
server (require_feature on its routes) for everyone in the school, admins included, and the
role screens show its permissions greyed out. Students, classes, the school year, grades and
staff are always on: report cards, promotion and year end depend on them.
"""
from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from src.core.security.auth import get_current_active_user, is_super_admin
from src.db.models.auth import User
from src.db.models.tenant import TenantSettings
from src.db.session import get_db

# key, switch, label, what it covers, the permissions that only make sense with the area on
SCHOOL_AREAS = [
    {"key": "fees", "feature": "enable_finance", "label": "Fees",
     "description": "Fee setup, invoices, payments, receipts, expenses and the families' fee pages.",
     "permissions": ["approve_financial_transactions", "create_invoices", "generate_financial_reports",
                     "issue_refunds", "manage_budgets", "manage_financial_data", "record_payments",
                     "view_budget_reports", "view_financial_data", "view_payment_history",
                     "view_child_financial_data", "view_own_financial_data"]},
    {"key": "attendance", "feature": "enable_attendance", "label": "Attendance",
     "description": "Daily attendance, scanning, excuses, attendance reports and ID cards.",
     "permissions": ["mark_attendance", "manage_attendance", "view_attendance", "view_school_attendance",
                     "manage_school_attendance"]},
    {"key": "homework", "feature": "enable_homework", "label": "Homework",
     "description": "Assignments teachers set and students hand in.",
     "permissions": ["create_assignments", "update_assignments", "delete_assignments", "view_assignments",
                     "submit_assignments", "grade_assignments"]},
    {"key": "timetable", "feature": "enable_timetable", "label": "Timetable",
     "description": "Class timetables for staff, students and parents.",
     "permissions": []},
    {"key": "parent_portal", "feature": "enable_parent_portal", "label": "Parent portal",
     "description": "Parents sign in to follow their children's attendance, results, fees and messages.",
     "permissions": ["view_child_records"]},
    {"key": "announcements", "feature": "enable_announcements", "label": "Announcements",
     "description": "Announcements from the school to staff, students and families. The inbox and school alerts stay on.",
     "permissions": ["send_announcements"]},
]

FEATURE_LABELS = {a["feature"]: a["label"] for a in SCHOOL_AREAS}


def feature_enabled(db: Session, tenant_id, key: str) -> bool:
    row = db.query(TenantSettings.settings).filter(TenantSettings.tenant_id == tenant_id).first()
    features = ((row[0] if row else None) or {}).get("features") or {}
    if key in features:
        return features[key] is True
    return TenantSettings.DEFAULT_SETTINGS["features"].get(key) is True


def school_areas(db: Session, tenant_id) -> list:
    """The switchable areas with whether this school has each one."""
    return [{**area, "enabled": feature_enabled(db, tenant_id, area["feature"])} for area in SCHOOL_AREAS]


PARENT_PORTAL_OFF = "The parent portal is turned off for this school. Contact the school for your child's information."


def _parent_only(user) -> bool:
    """Signs in only as a parent (a teacher who is also a parent keeps their staff access)."""
    names = {r.name for r in getattr(user, "roles", None) or [] if getattr(r, "tenant_id", None) is None}
    return bool(names) and names <= {"parent"}


def check_parent_portal_sign_in(db: Session, user) -> None:
    """Sign-in and session refresh: parents are refused while their school's portal is off."""
    if is_super_admin(user) or user.tenant_id is None or not _parent_only(user):
        return
    if not feature_enabled(db, user.tenant_id, "enable_parent_portal"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=PARENT_PORTAL_OFF)


async def enforce_parent_portal(request: Request, db: Session = Depends(get_db)) -> None:
    """Router-level guard (after authenticate_request): a parent already signed in is refused
    everything but signing out once the school turns the portal off."""
    user = getattr(request.state, "current_user", None)
    tenant_id = getattr(request.state, "tenant_id", None)
    if user is None or tenant_id is None or is_super_admin(user) or not _parent_only(user):
        return
    if request.method == "POST" and request.url.path.endswith("/auth/logout"):
        return
    if not feature_enabled(db, tenant_id, "enable_parent_portal"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=PARENT_PORTAL_OFF)


def require_feature(key: str):
    """Router dependency: 403 when the request's school has the feature switched off.
    A super-admin on a platform route (no school bound) passes."""

    async def check(request: Request, user: User = Depends(get_current_active_user), db: Session = Depends(get_db)) -> None:
        tenant_id = getattr(request.state, "tenant_id", None)
        if tenant_id is None and is_super_admin(user):
            return
        if not feature_enabled(db, tenant_id, key):
            label = FEATURE_LABELS.get(key, key)
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                                detail=f"{label} is turned off for this school. Ask the platform operator to turn it on.")

    return check
