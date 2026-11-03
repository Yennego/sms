# Backend\sms-backend\src\core\security\auth.py
"""Request authentication and tenant binding.

Every API route (except the PUBLIC_ROUTES allow-list) runs `authenticate_request`,
which loads the user from an *access* token and binds the request to a tenant:

- regular users are always bound to their own tenant; an X-Tenant-ID header naming
  a different school is rejected with 403, so a header can never widen access;
- super-admins (by DB role, never by token claim) may act on the school named in
  X-Tenant-ID, or on no school at all for platform routes.

`get_tenant_from_request` then serves that bound tenant to every service.

Users still on an admin-issued password (is_first_login) can only reach FIRST_LOGIN_ROUTES
until they change it.
"""

from typing import Optional
from uuid import UUID

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session, joinedload

from src.core.security.jwt import verify_token
from src.db.session import bind_session_to_tenant, get_db, set_tenant_id
from src.db.models.auth import User
from src.db.models.tenant import Tenant


oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")

# (method, route template) pairs reachable without a session. Everything else needs a token.
PUBLIC_ROUTES = {
    ("POST", "/api/v1/auth/login"),
    ("POST", "/api/v1/auth/refresh"),
    ("POST", "/api/v1/auth/logout"),
    # Self-service password reset by emailed link (rate-limited; answers never reveal accounts)
    ("POST", "/api/v1/auth/forgot-password"),
    ("POST", "/api/v1/auth/reset-password"),
    # School lookup for the login page: these return public branding fields only
    ("GET", "/api/v1/tenants/"),
    ("GET", "/api/v1/tenants/by-domain/"),
    ("GET", "/api/v1/tenants/{tenant_id}"),
    ("GET", "/api/v1/tenants/{tenant_id}/logo"),  # the uploaded logo image, shown on the sign-in page
    # Report card check from a printed QR (rate-limited; returns only that card's listed fields)
    ("GET", "/api/v1/verify/report-cards/{code}"),
    # Online payment notifications (the provider's signature is checked; 404 while none is configured)
    ("POST", "/api/v1/super-admin/billing/payments/webhook/{provider}"),
}

# While a user still has an admin-issued password (is_first_login), only these work
FIRST_LOGIN_ROUTES = {
    ("GET", "/api/v1/auth/me"),
    ("POST", "/api/v1/auth/change-password"),
}
PASSWORD_CHANGE_HEADER = "X-Password-Change-Required"

SUPER_ADMIN_ROLE_NAMES = ("super-admin", "superadmin")


def is_super_admin(user: User) -> bool:
    # Only the built-in role counts: a school's custom role can never be named into power
    return any(
        role.name in SUPER_ADMIN_ROLE_NAMES and getattr(role, "tenant_id", None) is None
        for role in user.roles
    )


def _credentials_error(detail: str = "Could not validate credentials") -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


def resolve_requested_tenant(request: Request, db: Session) -> Optional[Tenant]:
    """The active school named by X-Tenant-ID (id, code or domain), if any."""
    raw = (request.headers.get("X-Tenant-ID") or "").strip()
    if not raw:
        return None
    query = db.query(Tenant).filter(Tenant.is_active == True)  # noqa: E712
    try:
        return query.filter(Tenant.id == UUID(raw)).first()
    except ValueError:
        return (
            query.filter(Tenant.code == raw.upper()).first()
            or query.filter(Tenant.domain == raw.lower()).first()
            or query.filter(Tenant.subdomain == raw.lower()).first()
        )


async def get_current_user(
    request: Request,
    db: Session = Depends(get_db),
    token: str = Depends(oauth2_scheme)
) -> User:
    """Authenticate an access token and bind the request to the user's tenant."""
    cached = getattr(request.state, "current_user", None)
    if cached is not None:
        return cached

    token_data = await verify_token(token, expected_type="access")
    if not token_data:
        raise _credentials_error()

    try:
        user_uuid = UUID(token_data.sub)
    except (ValueError, TypeError):
        raise _credentials_error()

    user = db.query(User).options(joinedload(User.roles)).filter(User.id == user_uuid).first()
    if not user or not user.is_active:
        raise _credentials_error()

    requested = resolve_requested_tenant(request, db)
    if is_super_admin(user):
        bound_tenant_id = requested.id if requested else None
    else:
        # The token must have been issued for the user's own school
        if str(user.tenant_id) != str(token_data.tenant_id):
            raise _credentials_error()
        if requested and requested.id != user.tenant_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have access to this school",
            )
        tenant_active = db.query(Tenant.id).filter(
            Tenant.id == user.tenant_id, Tenant.is_active == True  # noqa: E712
        ).first()
        if not tenant_active:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="This school is inactive")
        bound_tenant_id = user.tenant_id

    set_tenant_id(bound_tenant_id)
    # Database row level security follows the same binding; a super-admin on a platform
    # route (no school chosen) sees every school
    bind_session_to_tenant(db, bound_tenant_id, bypass=bound_tenant_id is None)
    request.state.tenant_id = bound_tenant_id
    request.state.current_user = user
    return user


async def authenticate_request(request: Request, db: Session = Depends(get_db)) -> None:
    """Router-level guard: every route needs a valid session unless it is in PUBLIC_ROUTES."""
    route = request.scope.get("route")
    template = getattr(route, "path", request.url.path)
    if (request.method, template) in PUBLIC_ROUTES or request.method == "OPTIONS":
        return
    token = await oauth2_scheme(request)
    user = await get_current_user(request=request, db=db, token=token)
    if user.is_first_login and (request.method, template) not in FIRST_LOGIN_ROUTES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Change your password to continue.",
            headers={PASSWORD_CHANGE_HEADER: "1"},
        )


async def get_current_active_user(current_user: User = Depends(get_current_user)) -> User:
    """Get the current active user (inactive users are already rejected at authentication)."""
    return current_user
