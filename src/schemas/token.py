from typing import Optional
from pydantic import BaseModel


class TokenPayload(BaseModel):
    sub: Optional[str] = None


class Token(BaseModel):
    access_token: str
    token_type: str
