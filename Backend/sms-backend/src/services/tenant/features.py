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
