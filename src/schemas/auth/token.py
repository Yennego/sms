from typing import Optional
from pydantic import BaseModel
from uuid import UUID


class Token(BaseModel):
    """Schema for token response."""
    access_token: str
    refresh_token: str
    token_type: str
    requires_password_change: bool = False


class TokenPayload(BaseModel):
    """Schema for token payload."""
    sub: Optional[str] = None
    tenant_id: Optional[str] = None
    exp: int
    type: str