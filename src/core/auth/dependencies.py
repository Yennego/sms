from src.core.security.permissions import has_role, has_any_role, has_permission
from src.core.security.auth import get_current_user, get_current_active_user
from fastapi import Depends, Header, HTTPException, status
from typing import Optional
from uuid import UUID

# Re-export these functions
__all__ = ["has_role", "has_any_role", "has_permission", "get_current_user", "get_tenant_id_from_request", "get_current_active_user"]

# Add this new function
async def get_tenant_id_from_request(x_tenant_id: Optional[str] = Header(None)) -> UUID:
    """Get tenant ID from request header."""
    if not x_tenant_id:
        raise HTTPException(status_code=400, detail="X-Tenant-ID header is required")
    try:
        return UUID(x_tenant_id)  # Convert to UUID here
    except ValueError:
        raise HTTPException(status_code=400, detail="X-Tenant-ID must be a valid UUID")