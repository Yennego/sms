"""
Custom exceptions for the application.
"""

class TenantNotFoundError(Exception):
    """Raised when a tenant is not found."""
    pass

from src.core.exceptions.business import PermissionDeniedError