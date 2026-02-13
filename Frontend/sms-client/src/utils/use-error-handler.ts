import { useState, useCallback } from 'react';
import { handleError, getUserFriendlyErrorMessage } from './error-utils';

interface ErrorHandlerResult {
  error: string | null;
  setError: (message: string | null) => void;
  handleError: (error: unknown, fallbackMessage?: string) => void;
  clearError: () => void;
}

/**
 * Custom hook for handling errors in React components
 * @param initialError Initial error message (optional)
 * @returns Object with error state and error handling methods
 */
export function useErrorHandler(initialError: string | null = null): ErrorHandlerResult {
  const [error, setErrorState] = useState<string | null>(initialError);

  const clearError = useCallback(() => {
    setErrorState(null);
  }, []);

  const setError = useCallback((message: string | null) => {
    setErrorState(message);
  }, []);

  const processError = useCallback((err: unknown, fallbackMessage?: string) => {
    const appError = handleError(err, fallbackMessage);
    const userFriendlyMessage = getUserFriendlyErrorMessage(appError);
    setErrorState(userFriendlyMessage);
    
    // Log error for debugging (can be replaced with proper logging)
    console.error('Error caught:', appError);
    
    return appError;
  }, []);

  return {
    error,
    setError,
    handleError: processError,
    clearError,
  };
}
