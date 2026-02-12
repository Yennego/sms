from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional, Union
from uuid import UUID

from jose import jwt
from pydantic import ValidationError

from src.core.config import settings
from src.schemas.auth.token import TokenPayload
from uuid import uuid4


SECRET_KEY = settings.SECRET_KEY
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = settings.ACCESS_TOKEN_EXPIRE_MINUTES
REFRESH_TOKEN_EXPIRE_DAYS = settings.REFRESH_TOKEN_EXPIRE_DAYS


def create_access_token(subject: Union[str, UUID], tenant_id: Union[str, UUID], is_super_admin: bool = False, expires_delta: Optional[timedelta] = None) -> str:
    """Create a JWT access token."""
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode = {
        "exp": expire,
        "sub": str(subject),
        "tenant_id": str(tenant_id),
        "type": "access",
        "is_super_admin": is_super_admin
        ,
        "jti": str(uuid4())
    }
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def create_refresh_token(subject: Union[str, UUID], tenant_id: Union[str, UUID], is_super_admin: bool = False) -> str:
    """Create a JWT refresh token."""
    expire = datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    
    to_encode = {
        "exp": expire,
        "sub": str(subject),
        "tenant_id": str(tenant_id),
        "type": "refresh",
        "is_super_admin": is_super_admin  # Add this field
        ,
        "jti": str(uuid4())
    }
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


async def verify_token(token: str) -> Optional[TokenPayload]:
    """Verify a JWT token and return its payload."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        token_data = TokenPayload(**payload)
        
        # Fix: Use timezone-aware datetime comparison
        if datetime.fromtimestamp(token_data.exp, tz=timezone.utc) < datetime.now(timezone.utc):
            return None
            
        # Check if token is blacklisted
        from src.services.auth.token_blacklist import TokenBlacklistService
        blacklist_service = TokenBlacklistService()
        if await blacklist_service.is_token_blacklisted(token):
            return None

        # Enforce idle timeout for access tokens
        if settings.IDLE_ENFORCEMENT_ENABLED and token_data.type == "access" and token_data.jti:
            # Ensure last-activity exists at first usage
            await blacklist_service.ensure_last_activity(token_data.jti, token_data.exp)
            if await blacklist_service.is_idle_timed_out(token_data.jti):
                # Optional: mark token blacklisted for faster future failures
                await blacklist_service.blacklist_token(token, token_data.exp)
                return None
            
        return token_data
    except (jwt.JWTError, ValidationError) as e:
        print(f"Token verification failed: {e}")
        return None