"""Self-service password reset by emailed link.

Reset tokens live only in Redis, with a TTL (no database table):

- the link carries a random token; Redis stores only its SHA-256 hash, mapped to the user
  and their school;
- a user has at most one live link (asking again replaces the previous one);
- a token is consumed atomically on use, so it works once.

When Redis can't be reached, password reset is unavailable (the endpoints answer 503).
"""
import hashlib
import json
import logging
import secrets
from typing import Any, Optional
from uuid import UUID

from src.core.config import settings
from src.core.redis import REDIS_AVAILABLE, cache
from src.services.notification.email_service import EmailService

logger = logging.getLogger(__name__)

RESET_TOKEN_TTL_SECONDS = 30 * 60
_TOKEN_KEY = "pwreset:token:{}"
_USER_KEY = "pwreset:user:{}"


async def get_store() -> Optional[Any]:
    """A Redis client that answered a ping, or None when Redis is unavailable."""
    if not REDIS_AVAILABLE:
        return None
    try:
        if not cache.client:
            await cache.connect()
        if not cache.client:
            return None
        await cache.client.ping()
        return cache.client
    except Exception as e:
        logger.warning("Password reset store (Redis) unavailable: %s", e)
        return None


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


async def hit_counter(store, key: str, window_seconds: int) -> int:
    """Increment a rate-limit counter for a window; returns the new count."""
    async with store.pipeline() as pipe:
        await pipe.incr(key)
        await pipe.expire(key, window_seconds)
        count, _ = await pipe.execute()
    return int(count)


async def issue_token(store, user_id: UUID, tenant_id: UUID) -> str:
    """Create a reset token for the user (replacing any earlier one) and return it."""
    token = secrets.token_urlsafe(32)
    digest = hash_token(token)
    user_key = _USER_KEY.format(user_id)
    previous = await store.get(user_key)
    record = json.dumps({"user_id": str(user_id), "tenant_id": str(tenant_id)})
    async with store.pipeline() as pipe:
        if previous:
            await pipe.delete(_TOKEN_KEY.format(previous))
        await pipe.set(_TOKEN_KEY.format(digest), record, ex=RESET_TOKEN_TTL_SECONDS)
        await pipe.set(user_key, digest, ex=RESET_TOKEN_TTL_SECONDS)
        await pipe.execute()
    return token


async def consume_token(store, token: str) -> Optional[dict]:
    """Use a token: returns {"user_id", "tenant_id"} once, then None forever after."""
    if not token:
        return None
    key = _TOKEN_KEY.format(hash_token(token))
    async with store.pipeline() as pipe:  # MULTI: two concurrent uses can't both read it
        await pipe.get(key)
        await pipe.delete(key)
        raw, _ = await pipe.execute()
    if not raw:
        return None
    try:
        record = json.loads(raw)
        await store.delete(_USER_KEY.format(record["user_id"]))
        return record
    except (ValueError, KeyError, TypeError):
        return None


def reset_link(tenant_path: str, token: str) -> str:
    return f"{settings.FRONTEND_URL}/{tenant_path}/reset-password?token={token}"


def send_reset_email(email: str, link: str, school_name: str, user_id: UUID) -> None:
    """Email the link (runs after the response is sent). Never logs the link outside DEBUG."""
    service = EmailService()
    if service.is_configured():
        sent = service.send_password_reset_link(email, link, school_name, RESET_TOKEN_TTL_SECONDS // 60)
        reason = "sending failed"
    else:
        sent = False
        reason = "email is not configured"
    if sent:
        return
    logger.warning("Password reset email for user %s could not be sent: %s", user_id, reason)
    if settings.DEBUG:
        logger.warning("[DEBUG] Password reset link for user %s: %s", user_id, link)
