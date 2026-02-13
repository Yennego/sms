 

// Error types for different scenarios
export enum ErrorType {
  NETWORK = 'network_error',
  AUTHENTICATION = 'authentication_error',
  AUTHORIZATION = 'authorization_error',
  VALIDATION = 'validation_error',
  NOT_FOUND = 'not_found_error',
  SERVER = 'server_error',
  UNKNOWN = 'unknown_error'
}

// Custom error class with additional properties
export class AppError extends Error {
  type: ErrorType;
  statusCode?: number;
  originalError?: unknown;

  constructor(message: string, type: ErrorType = ErrorType.UNKNOWN, statusCode?: number, originalError?: unknown) {
    super(message);
    this.name = 'AppError';
    this.type = type;
    this.statusCode = statusCode;
    this.originalError = originalError;
    
    // Ensures proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

/**
 * Handles unknown errors and converts them to AppError
 * @param error The caught error (unknown type)
 * @param fallbackMessage Default message if error can't be processed
 * @returns AppError with appropriate type and message
 */
export function handleError(error: unknown, fallbackMessage = 'An unexpected error occurred'): AppError {
  // Already an AppError, return as is
  if (error instanceof AppError) {
    return error;
  }
  
  // Standard Error object
  if (error instanceof Error) {
    return new AppError(error.message, ErrorType.UNKNOWN, undefined, error);
  }
  
  // Network errors (fetch API)
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return new AppError(
      'Network error. Please check your connection and try again.',
      ErrorType.NETWORK,
      undefined,
      error
    );
  }
  
  // Handle string errors
  if (typeof error === 'string') {
    return new AppError(error, ErrorType.UNKNOWN);
  }
  
  // Handle object errors with message property
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return new AppError(error.message, ErrorType.UNKNOWN, undefined, error);
  }
  
  // Default case - unknown error
  return new AppError(fallbackMessage, ErrorType.UNKNOWN, undefined, error);
}

/**
 * Creates a user-friendly error message based on error type
 * @param error The AppError object
 * @returns User-friendly error message
 */
export function getUserFriendlyErrorMessage(error: AppError): string {
  switch (error.type) {
    case ErrorType.NETWORK:
      return 'Unable to connect to the server. Please check your internet connection and try again.';
    case ErrorType.AUTHENTICATION:
      return 'Authentication failed. Please check your credentials and try again.';
    case ErrorType.AUTHORIZATION:
      return 'You do not have permission to perform this action.';
    case ErrorType.VALIDATION:
      return error.message || 'Please check your input and try again.';
    case ErrorType.NOT_FOUND:
      return 'The requested resource was not found.';
    case ErrorType.SERVER:
      return 'The server encountered an error. Please try again later.';
    default:
      return error.message || 'An unexpected error occurred. Please try again.';
  }
}

/**
 * Helper function to create specific error types
 */
export const createError = {
  network: (message = 'Network error', originalError?: unknown) => 
    new AppError(message, ErrorType.NETWORK, undefined, originalError),
  
  authentication: (message = 'Authentication failed', originalError?: unknown) => 
    new AppError(message, ErrorType.AUTHENTICATION, 401, originalError),
  
  authorization: (message = 'Not authorized', originalError?: unknown) => 
    new AppError(message, ErrorType.AUTHORIZATION, 403, originalError),
  
  validation: (message = 'Validation failed', originalError?: unknown) => 
    new AppError(message, ErrorType.VALIDATION, 400, originalError),
  
  notFound: (message = 'Resource not found', originalError?: unknown) => 
    new AppError(message, ErrorType.NOT_FOUND, 404, originalError),
  
  server: (message = 'Server error', originalError?: unknown) => 
    new AppError(message, ErrorType.SERVER, 500, originalError),
};
