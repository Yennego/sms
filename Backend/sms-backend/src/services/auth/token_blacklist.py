from typing import Optional
from datetime import datetime, timezone
# import redis  # Uncomment when Redis is available
from src.core.config import settings

class TokenBlacklistService:
    def __init__(self):
        # For now, use in-memory storage (not recommended for production)
        self._blacklisted_tokens = set()
        
        # Uncomment when Redis is available:
        # self.redis_client = redis.Redis(
        #     host=settings.REDIS_HOST,
        #     port=settings.REDIS_PORT,
        #     db=settings.REDIS_DB
        # )
    
    def blacklist_token(self, token: str, expiry_timestamp: int) -> bool:
        """Add token to blacklist with expiry."""
        try:
            # For now, use in-memory storage
            self._blacklisted_tokens.add(token)
            
            # When Redis is available, use this instead:
            # current_timestamp = int(datetime.now(timezone.utc).timestamp())
            # ttl = max(0, expiry_timestamp - current_timestamp)
            # if ttl > 0:
            #     self.redis_client.setex(f"blacklist:{token}", ttl, "1")
            
            return True
        except Exception as e:
            print(f"Failed to blacklist token: {e}")
            return False
    
    def is_token_blacklisted(self, token: str) -> bool:
        """Check if token is blacklisted."""
        try:
            # For now, use in-memory storage
            return token in self._blacklisted_tokens
            
            # When Redis is available, use this instead:
            # return bool(self.redis_client.exists(f"blacklist:{token}"))
        except Exception as e:
            print(f"Failed to check token blacklist: {e}")
            return False