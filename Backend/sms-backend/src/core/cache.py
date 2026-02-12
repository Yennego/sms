from functools import wraps
from typing import Any, Callable, Optional, TypeVar
import json
from src.core.redis import cache
import inspect

T = TypeVar("T")

def cached(prefix: str, expire: int = 300):
    """
    Decorator to cache function results in Redis.
    The key is generated based on the prefix and the function arguments.
    Works with both sync and async functions.
    """
    def decorator(func: Callable[..., Any]):
        @wraps(func)
        async def async_wrapper(*args, **kwargs):
            # Generate key: prefix:arg1:arg2:kwarg1=val1...
            # We skip 'self' or 'db' arguments if they exist
            key_parts = [prefix]
            
            # Get function signature to map args to names
            sig = inspect.signature(func)
            bound_args = sig.bind(*args, **kwargs)
            bound_args.apply_defaults()
            
            for name, value in bound_args.arguments.items():
                if name in ('self', 'db', 'tenant'):
                    continue
                if hasattr(value, 'id'):  # Handle objects with ID
                    key_parts.append(f"{name}={value.id}")
                else:
                    key_parts.append(f"{name}={value}")
            
            # Add tenant_id if available on 'self'
            if args and hasattr(args[0], 'tenant_id'):
                 key_parts.append(f"tenant={args[0].tenant_id}")
            
            cache_key = ":".join(map(str, key_parts))
            
            # Try to get from cache
            result = await cache.get(cache_key)
            if result is not None:
                return result
            
            # Execute function
            if inspect.iscoroutinefunction(func):
                result = await func(*args, **kwargs)
            else:
                result = func(*args, **kwargs)
            
            # Store in cache
            if result is not None:
                await cache.set(cache_key, result, expire=expire)
            
            return result

        return async_wrapper
    return decorator
