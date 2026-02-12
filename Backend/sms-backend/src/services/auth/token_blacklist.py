from typing import Optional
from datetime import datetime, timezone
try:
    import redis.asyncio as redis  # type: ignore
except Exception:
    redis = None

from src.core.config import settings

class TokenBlacklistService:
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(TokenBlacklistService, cls).__new__(cls)
            cls._instance.redis_client = None
            cls._instance.redis_available = False
            cls._instance._blacklisted_tokens = set()
            cls._instance._last_activity = {}
            
            if redis is not None:
                try:
                    cls._instance.redis_client = redis.Redis(
                        host=settings.REDIS_HOST,
                        port=settings.REDIS_PORT,
                        db=settings.REDIS_DB,
                        password=getattr(settings, "REDIS_PASSWORD", None),
                        decode_responses=True
                    )
                    cls._instance.redis_available = True
                except Exception as e:
                    print(f"Redis unavailable, falling back to in-memory: {e}")
        return cls._instance

    async def blacklist_token(self, token: str, expiry_timestamp: int) -> bool:
        """Add token to blacklist with expiry."""
        try:
            if self.redis_available:
                current_timestamp = int(datetime.now(timezone.utc).timestamp())
                ttl = max(0, int(expiry_timestamp) - current_timestamp)
                await self.redis_client.setex(f"token:blacklist:{token}", ttl, "1")
            else:
                self._blacklisted_tokens.add(token)
            return True
        except Exception as e:
            print(f"Failed to blacklist token: {e}")
            return False
    
    async def is_token_blacklisted(self, token: str) -> bool:
        """Check if token is blacklisted."""
        try:
            if self.redis_available:
                return bool(await self.redis_client.exists(f"token:blacklist:{token}"))
            return token in self._blacklisted_tokens
        except Exception as e:
            print(f"Failed to check token blacklist: {e}")
            return False

    async def update_last_activity(self, jti: str, expiry_timestamp: int) -> None:
        """Update last activity timestamp for a token jti."""
        now_ts = int(datetime.now(timezone.utc).timestamp())
        try:
            if self.redis_available:
                key = f"token:last_activity:{jti}"
                ttl = max(0, int(expiry_timestamp) - now_ts)
                await self.redis_client.set(key, str(now_ts))
                if ttl > 0:
                    await self.redis_client.expire(key, ttl)
            else:
                self._last_activity[jti] = now_ts
        except Exception as e:
            print(f"Failed to update last activity: {e}")

    async def ensure_last_activity(self, jti: str, expiry_timestamp: int) -> None:
        """Set last activity if missing (first request after token issue)."""
        try:
            if self.redis_available:
                key = f"token:last_activity:{jti}"
                if not await self.redis_client.exists(key):
                    await self.update_last_activity(jti, expiry_timestamp)
            else:
                if jti not in self._last_activity:
                    await self.update_last_activity(jti, expiry_timestamp)
        except Exception as e:
            print(f"Failed to ensure last activity: {e}")

    async def get_last_activity(self, jti: str) -> Optional[int]:
        """Return last activity timestamp or None."""
        try:
            if self.redis_available:
                val = await self.redis_client.get(f"token:last_activity:{jti}")
                return int(val) if val is not None else None
            return self._last_activity.get(jti)
        except Exception as e:
            print(f"Failed to get last activity: {e}")
            return None

    async def is_idle_timed_out(self, jti: str) -> bool:
        """Check if idle window exceeded based on last activity."""
        idle_minutes = int(getattr(settings, "IDLE_TIMEOUT_MINUTES", 0))
        if idle_minutes <= 0:
            return False
        last_ts = await self.get_last_activity(jti)
        if last_ts is None:
            return False
        now_ts = int(datetime.now(timezone.utc).timestamp())
        return (now_ts - last_ts) > (idle_minutes * 60)
