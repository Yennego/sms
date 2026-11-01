"""The client address used for per-IP rate limits.

Behind the Next.js server (BFF) every browser shares that server's address, so the BFF sends the
browser's address in X-Client-IP. That header is believed only when the request also carries
X-Proxy-Secret equal to settings.PROXY_SHARED_SECRET (compared in constant time, and only when
the setting is not empty); anyone else could put any address there.
"""
import hmac

from fastapi import Request

from src.core.config import settings

CLIENT_IP_HEADER = "X-Client-IP"
PROXY_SECRET_HEADER = "X-Proxy-Secret"


def client_ip(request: Request) -> str:
    secret = settings.PROXY_SHARED_SECRET or ""
    claimed = (request.headers.get(CLIENT_IP_HEADER) or "").strip()
    sent = request.headers.get(PROXY_SECRET_HEADER) or ""
    if secret and claimed and hmac.compare_digest(sent.encode(), secret.encode()):
        return claimed[:64]
    return request.client.host if request.client else "unknown"
