"""Business logic related exceptions."""

class BusinessLogicError(Exception):
    """Base class for all business logic errors."""
    pass


class EntityNotFoundError(BusinessLogicError):
    """Raised when an entity is not found."""
    def __init__(self, entity_type: str, entity_id: str):
        self.entity_type = entity_type
        self.entity_id = entity_id
        self.message = f"{entity_type} with ID {entity_id} not found"
        super().__init__(self.message)


class DuplicateEntityError(BusinessLogicError):
    """Raised when attempting to create a duplicate entity."""
    def __init__(self, entity_type: str, field: str, value: str):
        self.entity_type = entity_type
        self.field = field
        self.value = value
        self.message = f"{entity_type} with {field} '{value}' already exists"
        super().__init__(self.message)


class InvalidStatusTransitionError(BusinessLogicError):
    """Raised when attempting an invalid status transition."""
    def __init__(self, entity_type: str, current_status: str, target_status: str):
        self.entity_type = entity_type
        self.current_status = current_status
        self.target_status = target_status
        self.message = f"Cannot transition {entity_type} from '{current_status}' to '{target_status}'"
        super().__init__(self.message)


class BusinessRuleViolationError(BusinessLogicError):
    """Raised when a business rule is violated."""
    def __init__(self, message: str):
        self.message = message
        super().__init__(message)


class PermissionDeniedError(BusinessLogicError):
    """Raised when a user does not have permission to perform an action."""
    def __init__(self, action: str, resource_type: str = None):
        self.action = action
        self.resource_type = resource_type
        if resource_type:
            self.message = f"Permission denied: Cannot {action} {resource_type}"
        else:
            self.message = f"Permission denied: Cannot {action}"
        super().__init__(self.message)


class DatabaseError(Exception):
    """Raised when a database error occurs."""
    pass