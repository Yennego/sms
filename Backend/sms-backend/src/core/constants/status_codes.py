"""
Status code constants for the application.
"""

# Success codes
SUCCESS = 200
CREATED = 201
ACCEPTED = 202
NO_CONTENT = 204

# Client error codes
BAD_REQUEST = 400
UNAUTHORIZED = 401
FORBIDDEN = 403
NOT_FOUND = 404
METHOD_NOT_ALLOWED = 405
CONFLICT = 409
GONE = 410
UNPROCESSABLE_ENTITY = 422
TOO_MANY_REQUESTS = 429

# Server error codes
INTERNAL_SERVER_ERROR = 500
NOT_IMPLEMENTED = 501
BAD_GATEWAY = 502
SERVICE_UNAVAILABLE = 503
GATEWAY_TIMEOUT = 504

# Custom status messages
STATUS_MESSAGES = {
    SUCCESS: "Success",
    CREATED: "Resource created successfully",
    ACCEPTED: "Request accepted for processing",
    NO_CONTENT: "Request processed successfully, no content to return",
    BAD_REQUEST: "Invalid request parameters",
    UNAUTHORIZED: "Authentication required",
    FORBIDDEN: "Permission denied",
    NOT_FOUND: "Resource not found",
    CONFLICT: "Resource conflict",
    INTERNAL_SERVER_ERROR: "Internal server error",
}