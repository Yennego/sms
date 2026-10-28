"""Forgot / reset password (public routes, listed in PUBLIC_ROUTES).

Accounts are per school: the school comes from X-Tenant-ID (the school in the page URL), the
email is looked up only in that school, and a reset link only works on its own school.
Families without email ask the school office, which uses POST /auth/admin/reset-password/{id}.
"""
from typing import Any
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from src.core.security.auth import is_super_admin, resolve_requested_tenant
from src.core.security.password import get_password_hash
from src.core.security.password_policy import PasswordPolicy
from src.db.crud import user as user_crud
from src.db.session import bind_session_to_tenant, get_db, set_tenant_id
from src.services.auth import password_reset
from src.services.auth.token_blacklist import TokenBlacklistService

router = APIRouter()

RATE_WINDOW_SECONDS = 900
# Per client address and school, like login (a whole school may share one IP). Behind the
# Next.js server every browser shares that server's address, so the per-account limit is the
# one that protects inboxes.
FORGOT_PER_IP = 30
FORGOT_PER_ACCOUNT = 3  # counted whether or not the account exists, so it reveals nothing
RESET_PER_IP = 30

GENERIC_FORGOT_MESSAGE = (
    "If an account with that email exists at this school, we've sent it a link to reset the "
    "password. The link expires in 30 minutes. No email? Ask your school office to reset your password."
)
INVALID_TOKEN = "This reset link is invalid, has expired or was already used. Request a new one."

UNAVAILABLE = HTTPException(
    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
    detail="Password reset is temporarily unavailable. Please try again later or ask your school office.",
)
TOO_MANY = HTTPException(
    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
    detail="Too many password reset attempts. Please wait 15 minutes and try again.",
)


class ForgotPasswordRequest(BaseModel):
    email: str = Field(..., min_length=3, max_length=254)


class ResetPasswordRequest(BaseModel):
    token: str = Field(..., min_length=16, max_length=256)
    new_password: str = Field(..., min_length=1, max_length=128)


async def _store():
    store = await password_reset.get_store()
    if store is None:
        raise UNAVAILABLE
    return store


async def _limit(store, key: str, limit: int) -> None:
    try:
        count = await password_reset.hit_counter(store, key, RATE_WINDOW_SECONDS)
    except Exception:
        raise UNAVAILABLE
    if count > limit:
        raise TOO_MANY


def _client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


def _school(request: Request, db: Session):
    tenant = resolve_requested_tenant(request, db)
    if tenant is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="School not found. Open this page from your school's sign-in page.",
        )
    set_tenant_id(tenant.id)
    bind_session_to_tenant(db, tenant.id)
    return tenant


@router.post("/forgot-password")
async def forgot_password(
    body: ForgotPasswordRequest,
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
) -> Any:
    """Email a reset link if the account exists. The answer is the same either way."""
    store = await _store()
    tenant = _school(request, db)
    email = body.email.strip().lower()
    await _limit(store, f"pwreset_attempts:ip:{tenant.id}:{_client_ip(request)}", FORGOT_PER_IP)
    await _limit(store, f"pwreset_attempts:account:{tenant.id}:{email}", FORGOT_PER_ACCOUNT)

    user = user_crud.get_by_email(db, tenant_id=tenant.id, email=email)
    # Super-admins don't reset by email: a platform account must not hinge on one mailbox
    if user and user.is_active and user.email and not is_super_admin(user):
        try:
            token = await password_reset.issue_token(store, user.id, tenant.id)
        except Exception:
            raise UNAVAILABLE
        link = password_reset.reset_link(tenant.domain or str(tenant.id), token)
        background_tasks.add_task(password_reset.send_reset_email, user.email, link, tenant.name, user.id)

    return {"message": GENERIC_FORGOT_MESSAGE}


@router.post("/reset-password")
async def reset_password(
    body: ResetPasswordRequest,
    request: Request,
    db: Session = Depends(get_db),
) -> Any:
    """Set a new password with a reset token from the emailed link (single use)."""
    store = await _store()
    await _limit(store, f"pwreset_attempts:reset_ip:{_client_ip(request)}", RESET_PER_IP)

    # Policy first, so a rejected password doesn't use up the link
    errors = PasswordPolicy().validate(body.new_password)
    if errors:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=" ".join(
            e if e.endswith(".") else e + "." for e in errors
        ))

    try:
        record = await password_reset.consume_token(store, body.token)
    except Exception:
        raise UNAVAILABLE
    if not record:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=INVALID_TOKEN)

    # The link only works on its own school's page
    tenant = resolve_requested_tenant(request, db)
    if tenant is None or str(tenant.id) != record.get("tenant_id"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=INVALID_TOKEN)
    set_tenant_id(tenant.id)
    bind_session_to_tenant(db, tenant.id)

    try:
        user_id = UUID(record["user_id"])
    except (KeyError, ValueError, TypeError):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=INVALID_TOKEN)
    user = user_crud.get_by_id(db, tenant_id=tenant.id, id=user_id)
    if not user or not user.is_active or is_super_admin(user):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=INVALID_TOKEN)

    user.password_hash = get_password_hash(body.new_password)
    user.is_first_login = False
    db.add(user)
    db.flush()

    # Sign out everywhere (a stolen session ends here) and lift any login lockout
    await TokenBlacklistService().revoke_user_sessions(user.id)
    try:
        await store.delete(f"login_failures:{(user.email or '').strip().lower()}")
    except Exception:
        pass

    return {"message": "Your password has been reset. You can now sign in with your new password."}
