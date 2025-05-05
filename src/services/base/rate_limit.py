from typing import Optional, Dict, Any, Callable
from fastapi import HTTPException, status, Request
from datetime import datetime, timedelta
import json
import hashlib
import logging

from src.core.config import settings

# Setup logging
logger = logging.getLogger(__name__)

# Initialize Redis client if possible
try:
    import redis
    redis_client = redis.Redis(
        host=settings.REDIS_HOST,
        port=settings.REDIS_PORT,
        db=settings.REDIS_DB,
        password=settings.REDIS_PASSWORD,
        decode_responses=True
    )
    # Test connection
    redis_client.ping()
    REDIS_AVAILABLE = True
    logger.info("Redis connection established successfully")
except ImportError as e:
    logger.warning(f"Redis module not available: {e}. Rate limiting will be disabled.")
    REDIS_AVAILABLE = False
    redis_client = None
except Exception as e:
    logger.warning(f"Redis connection error: {e}. Rate limiting will be disabled.")
    REDIS_AVAILABLE = False
    redis_client = None


class RateLimitService:
    """
    Service for implementing rate limiting on API endpoints.
    """
    def __init__(self, limit: int = 100, period: int = 60):
        """
        Initialize rate limiter.
        
        Args:
            limit: Maximum number of requests allowed in the period
            period: Time period in seconds
        """
        self.limit = limit
        self.period = period
    
    def _get_key(self, request: Request, tenant_id: Optional[str] = None) -> str:
        """
        Generate a unique key for rate limiting based on client IP and tenant ID.
        """
        client_ip = request.client.host
        path = request.url.path
        
        # Include tenant_id in the key if provided
        if tenant_id:
            key_base = f"{client_ip}:{tenant_id}:{path}"
        else:
            key_base = f"{client_ip}:{path}"
        
        # Hash the key to ensure it's safe for Redis
        return f"rate_limit:{hashlib.md5(key_base.encode()).hexdigest()}"
    
    async def check_rate_limit(self, request: Request, tenant_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Check if the request exceeds the rate limit.
        
        Returns:
            Dict with rate limit information
        
        Raises:
            HTTPException if rate limit is exceeded
        """
        # If Redis is not available, skip rate limiting
        if not REDIS_AVAILABLE:
            return {
                "limit": self.limit,
                "remaining": self.limit,
                "reset": int(datetime.utcnow().timestamp() + self.period)
            }
            
        key = self._get_key(request, tenant_id)
        current_time = datetime.utcnow().timestamp()
        window_start = current_time - self.period
        
        # Remove old requests
        redis_client.zremrangebyscore(key, 0, window_start)
        
        # Count current requests in the window
        current_count = redis_client.zcard(key)
        
        # Check if limit is exceeded
        if current_count >= self.limit:
            # Get reset time
            oldest_request = float(redis_client.zrange(key, 0, 0, withscores=True)[0][1])
            reset_time = oldest_request + self.period - current_time
            
            # Set headers for rate limit response
            headers = {
                "X-RateLimit-Limit": str(self.limit),
                "X-RateLimit-Remaining": "0",
                "X-RateLimit-Reset": str(int(reset_time))
            }
            
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Rate limit exceeded",
                headers=headers
            )
        
        # Add current request to the window
        redis_client.zadd(key, {str(current_time): current_time})
        # Set expiration on the key
        redis_client.expire(key, self.period)
        
        # Return rate limit information
        return {
            "limit": self.limit,
            "remaining": self.limit - current_count - 1,
            "reset": int(current_time + self.period)
        }

# Create dependency for rate limiting
def rate_limit(limit: int = 100, period: int = 60):
    """
    Dependency for rate limiting API endpoints.
    
    Args:
        limit: Maximum number of requests allowed in the period
        period: Time period in seconds
    """
    rate_limiter = RateLimitService(limit=limit, period=period)
    
    async def check_rate_limit_dependency(request: Request):
        return await rate_limiter.check_rate_limit(request)
    
    return check_rate_limit_dependency