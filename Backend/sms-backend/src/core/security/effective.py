"""What a role allows in one school, and so what a person may do there.

A role's own permissions, plus what the platform operator added for that school, minus what they
took away (role_permission_overrides). Every other school keeps the role as it is. Every
permission check goes through these helpers rather than reading role.permissions directly.
"""
from typing import Dict, Iterable, Optional, Set, Tuple
from uuid import UUID

from sqlalchemy.orm import Session, object_session

from src.db.models.auth.permission import Permission
from src.db.models.auth.role_override import RolePermissionOverride

_CACHE_ATTR = "_effective_permission_names"


def _session(obj) -> Optional[Session]:
    try:
        return object_session(obj)
    except Exception:  # not a mapped instance (plain objects in unit tests)
        return None


def school_adjustments(db: Session, tenant_id, role_ids: Iterable) -> Dict[UUID, Tuple[Set[str], Set[str]]]:
    """role id -> (added, taken away) permission names for this school."""
    role_ids = list(role_ids)
    if tenant_id is None or not role_ids:
        return {}
    rows = (
        db.query(RolePermissionOverride.role_id, RolePermissionOverride.effect, Permission.name)
        .join(Permission, Permission.id == RolePermissionOverride.permission_id)
        .filter(RolePermissionOverride.tenant_id == tenant_id, RolePermissionOverride.role_id.in_(role_ids))
        .all()
    )
    out: Dict[UUID, Tuple[Set[str], Set[str]]] = {}
    for role_id, effect, name in rows:
        added, removed = out.setdefault(role_id, (set(), set()))
        (added if effect == "grant" else removed).add(name)
    return out


def role_permission_names(role, tenant_id, db: Optional[Session] = None) -> Set[str]:
    """What this role allows in this school."""
    names = {p.name for p in role.permissions}
    db = db or _session(role)
    if db is None or tenant_id is None:
        return names
    added, removed = school_adjustments(db, tenant_id, [role.id]).get(role.id, (set(), set()))
    return (names | added) - removed


def effective_permission_names(user) -> Set[str]:
    """Everything the user's roles allow in the user's school (computed once per loaded user).
    No user (a background job, a system check) allows nothing."""
    if user is None:
        return set()
    cached = getattr(user, "__dict__", {}).get(_CACHE_ATTR)
    if cached is not None:
        return cached
    roles = list(getattr(user, "roles", None) or [])
    db = _session(user)
    tenant_id = getattr(user, "tenant_id", None)
    role_ids = [r.id for r in roles if getattr(r, "id", None) is not None]
    adjustments = school_adjustments(db, tenant_id, role_ids) if db is not None else {}
    names: Set[str] = set()
    for role in roles:
        added, removed = adjustments.get(getattr(role, "id", None), (set(), set()))
        names |= ({p.name for p in role.permissions} | added) - removed
    try:
        user.__dict__[_CACHE_ATTR] = names
    except (AttributeError, TypeError):  # plain objects in unit tests
        pass
    return names
