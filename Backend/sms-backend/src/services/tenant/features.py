"""School feature switches (tenant_settings.settings["features"]), set by the platform operator.

A switch the school's settings don't mention takes TenantSettings.DEFAULT_SETTINGS.
"""
from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from src.core.security.auth import get_current_active_user, is_super_admin
from src.db.models.auth import User
from src.db.models.tenant import TenantSettings
from src.db.session import get_db

FEATURE_LABELS = {"enable_finance": "Fees"}


def feature_enabled(db: Session, tenant_id, key: str) -> bool:
    row = db.query(TenantSettings.settings).filter(TenantSettings.tenant_id == tenant_id).first()
    features = ((row[0] if row else None) or {}).get("features") or {}
    if key in features:
        return features[key] is True
    return TenantSettings.DEFAULT_SETTINGS["features"].get(key) is True


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
