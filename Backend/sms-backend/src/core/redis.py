try:
    import redis.asyncio as redis
    REDIS_AVAILABLE = True
except ImportError:
    import logging
    logging.warning("Redis module not available. Caching will be disabled.")
    redis = None
    REDIS_AVAILABLE = False
from src.core.config import settings
import json
from typing import Any, Optional, List, Dict
from pydantic import BaseModel
from sqlalchemy.orm import DeclarativeBase
from datetime import date, datetime
from uuid import UUID

class RedisEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, (datetime, date)):
            return obj.isoformat()
        if isinstance(obj, UUID):
            return str(obj)
        if isinstance(obj, BaseModel):
            return obj.model_dump()
        if hasattr(obj, '__table__'): # SQLAlchemy model
            data = {c.name: getattr(obj, c.name) for c in obj.__table__.columns}
            # Include loaded relationships to prevent data loss during caching
            from sqlalchemy import inspect
            state = inspect(obj)
            for rel in state.mapper.relationships:
                if rel.key in state.unloaded:
                    continue
                value = getattr(obj, rel.key)
                if value is not None:
                    data[rel.key] = value
            return data
        return super().default(obj)

class RedisCache:
    def __init__(self):
        self.client: Optional[redis.Redis] = None

    async def connect(self):
        if not REDIS_AVAILABLE:
            return
        if not self.client:
            try:
                self.client = redis.Redis(
                    host=settings.REDIS_HOST,
                    port=settings.REDIS_PORT,
                    db=settings.REDIS_DB,
                    password=settings.REDIS_PASSWORD,
                    decode_responses=True
                )
            except Exception as e:
                print(f"Failed to connect to Redis: {e}")
                self.client = None

    async def get(self, key: str) -> Any:
        if not REDIS_AVAILABLE:
            return None
        try:
            if not self.client:
                await self.connect()
            if not self.client:
                return None
            data = await self.client.get(key)
            return json.loads(data) if data else None
        except Exception as e:
            print(f"Redis get error: {e}")
            return None

    async def set(self, key: str, value: Any, expire: int = 300):
        if not REDIS_AVAILABLE:
            return
        try:
            if not self.client:
                await self.connect()
            if not self.client:
                return
            await self.client.set(key, json.dumps(value, cls=RedisEncoder), ex=expire)
        except Exception as e:
            print(f"Redis set error: {e}")

    async def delete(self, key: str):
        if not REDIS_AVAILABLE:
            return
        try:
            if not self.client:
                await self.connect()
            if not self.client:
                return
            await self.client.delete(key)
        except Exception as e:
            print(f"Redis delete error: {e}")

    async def delete_pattern(self, pattern: str):
        """Delete all keys matching a pattern."""
        if not REDIS_AVAILABLE:
            return
        try:
            if not self.client:
                await self.connect()
            if not self.client:
                return
            keys = await self.client.keys(pattern)
            if keys:
                await self.client.delete(*keys)
                print(f"[Redis] Deleted {len(keys)} keys matching pattern: {pattern}")
        except Exception as e:
            print(f"Redis delete_pattern error: {e}")

cache = RedisCache()
