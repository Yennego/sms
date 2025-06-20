from datetime import datetime, timedelta
from typing import Any, Dict, Optional, Union
from uuid import UUID

from jose import jwt
from pydantic import ValidationError

from src.core.config import settings
from src.schemas.auth.token import TokenPayload


SECRET_KEY = settings.SECRET_KEY
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = settings.ACCESS_TOKEN_EXPIRE_MINUTES
REFRESH_TOKEN_EXPIRE_DAYS = settings.REFRESH_TOKEN_EXPIRE_DAYS


def create_access_token(subject: Union[str, UUID], tenant_id: Union[str, UUID], expires_delta: Optional[timedelta] = None) -> str:
    """Create a JWT access token."""
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode = {
        "exp": expire,
        "sub": str(subject),
        "tenant_id": str(tenant_id),
        "type": "access"
    }
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def create_refresh_token(subject: Union[str, UUID], tenant_id: Union[str, UUID]) -> str:
    """Create a JWT refresh token."""
    expire = datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    
    to_encode = {
        "exp": expire,
        "sub": str(subject),
        "tenant_id": str(tenant_id),
        "type": "refresh"
    }
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def verify_token(token: str) -> Optional[TokenPayload]:
    """Verify a JWT token and return its payload."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        token_data = TokenPayload(**payload)
        
        if datetime.fromtimestamp(token_data.exp) < datetime.utcnow():
            return None
            
        # Check if token is blacklisted
        # This is a simplified example - implement actual Redis check
        # is_blacklisted = redis_client.exists(f"blacklist:{token}")
        # if is_blacklisted:
        #     return None
            
        return token_data
    except (jwt.JWTError, ValidationError):
        return None