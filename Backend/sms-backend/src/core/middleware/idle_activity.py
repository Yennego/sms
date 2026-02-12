from starlette.middleware.base import BaseHTTPMiddleware
from fastapi import Request
from src.core.security.jwt import verify_token
from src.services.auth.token_blacklist import TokenBlacklistService

class IdleActivityMiddleware(BaseHTTPMiddleware):
    """Middleware to keep last-activity updated for authenticated requests."""

    def __init__(self, app):
        super().__init__(app)
        self.excluded_paths = {
            "/docs", "/redoc", "/openapi.json", "/favicon.ico", "/health", "/metrics"
        }

    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        # Skip excluded paths
        if any(excluded in path for excluded in self.excluded_paths):
            return await call_next(request)

        # Extract Bearer token
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
            try:
                payload = await verify_token(token)
                # Only track access tokens
                if payload and payload.type == "access" and payload.jti:
                    await TokenBlacklistService().update_last_activity(payload.jti, payload.exp)
            except Exception as e:
                # Don't block request on middleware error
                print(f"IdleActivity middleware warning: {e}")

        return await call_next(request)