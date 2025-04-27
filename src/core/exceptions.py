from fastapi import HTTPException, status


class TenantNotFoundError(HTTPException):
    """Exception raised when a tenant is not found."""
    def __init__(self, detail: str = "Tenant not found"):
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=detail
        )


class ResourceNotFoundError(HTTPException):
    """Exception raised when a resource is not found."""
    def __init__(self, detail: str = "Resource not found"):
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=detail
        )


class TenantPermissionError(HTTPException):
    """Exception raised when a user tries to access a resource from another tenant."""
    def __init__(self, detail: str = "Not authorized to access this resource"):
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=detail
        )


class ValidationError(HTTPException):
    """Exception raised when validation fails."""
    def __init__(self, detail: str = "Validation error"):
        super().__init__(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=detail
        )