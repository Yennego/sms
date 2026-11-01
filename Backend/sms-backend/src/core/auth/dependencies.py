from src.core.security.permissions import has_role, has_any_role, has_permission, has_any_permission, holds_any_permission
from src.core.security.auth import get_current_user, get_current_active_user
# The tenant must come from the authenticated session, never straight from the header
from src.core.middleware.tenant import get_tenant_id_from_request

# Re-export these functions
__all__ = ["has_role", "has_any_role", "has_permission", "has_any_permission", "holds_any_permission","get_current_user", "get_tenant_id_from_request", "get_current_active_user"]
