import uuid
from typing import Any, Optional, Union

def ensure_uuid(value: Any) -> Optional[uuid.UUID]:
    """
    Safely convert a value to UUID if it's not already a UUID.
    Returns None if the value is None or cannot be converted.
    """
    if value is None:
        return None
    
    if isinstance(value, uuid.UUID):
        return value
    
    try:
        return uuid.UUID(str(value))
    except (ValueError, AttributeError, TypeError):
        return None