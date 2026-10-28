import { useMemo } from 'react';
import { handleError, createError, ErrorType, AppError } from '@/utils/error-utils';
import axios, { AxiosInstance, AxiosRequestConfig, AxiosError } from 'axios';

// Same-origin proxy: it attaches the httpOnly session cookie; this client never sees a token
const API_BASE_URL = '/api/v1';

export class SuperAdminApiClient {
  private axiosInstance: AxiosInstance;
  private tenantId: string | null;

  constructor(baseUrl = API_BASE_URL, tenantId: string | null = null) {
    this.tenantId = tenantId;

    // Create axios instance with base configuration
    this.axiosInstance = axios.create({
      baseURL: baseUrl,
      timeout: 30000, // 30 seconds timeout
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor for auth and tenant
    this.axiosInstance.interceptors.request.use(
      (config) => {
        config.headers['X-Auth-Context'] = 'SUPER_ADMIN';
        if (this.tenantId) {
          config.headers['X-Tenant-ID'] = this.tenantId;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor for error handling
    this.axiosInstance.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        // Don't throw errors for aborted requests
        if (error.code === 'ERR_CANCELED' || error.message === 'canceled') {
          return Promise.reject(error);
        }

        if (error.response && typeof window !== 'undefined') {
          // The proxy already tried a token refresh, so a 401 means the session is over
          if (error.response.status === 401) {
            window.location.href = '/platform/login';
          } else if (error.response.status === 403 && error.response.headers?.['x-password-change-required'] === '1'
            && window.location.pathname !== '/change-password') {
            window.location.href = '/change-password';
          }
        }

        if (error.response) {
          const { status, data } = error.response;
          let errorMessage: string;
          let errorType: ErrorType;

          // Extract error message with improved handling
          if (typeof data === 'string') {
            errorMessage = data;
          } else if (data && typeof data === 'object') {
            const errorData = data as unknown;

            // Handle FastAPI validation errors
            if ((errorData as { detail?: unknown }).detail) {
              if (typeof (errorData as { detail?: unknown }).detail === 'string') {
                errorMessage = (errorData as { detail: string }).detail;
              } else if (Array.isArray((errorData as { detail?: unknown }).detail)) {
                const detailArr = (errorData as { detail: unknown[] }).detail;
                errorMessage = detailArr.map((err: unknown) => {
                  if (typeof err === 'string') {
                    return err;
                  } else if (err && typeof err === 'object') {
                    const e = err as { loc?: unknown[]; msg?: string; message?: string };
                    const field = Array.isArray(e.loc) ? (e.loc as unknown[]).join('.') : 'field';
                    const message = e.msg || e.message || 'is invalid';
                    return `${field}: ${message}`;
                  }
                  return String(err);
                }).join('; ');
              } else {
                errorMessage = String((errorData as { detail?: unknown }).detail);
              }
            } else if ((errorData as { message?: unknown }).message) {
              errorMessage = String((errorData as { message?: unknown }).message);
            } else {
              errorMessage = JSON.stringify(errorData);
            }
          } else {
            errorMessage = error.message || 'An error occurred';
          }

          // Ensure we have a valid string message
          if (!errorMessage || errorMessage.trim() === '') {
            errorMessage = `HTTP ${status}: ${error.response.statusText || 'Unknown error'}`;
          }

          // Map status codes to error types
          switch (status) {
            case 400:
              errorType = ErrorType.VALIDATION;
              break;
            case 401:
              errorType = ErrorType.AUTHENTICATION;
              break;
            case 403:
              errorType = ErrorType.AUTHORIZATION;
              break;
            case 404:
              errorType = ErrorType.NOT_FOUND;
              break;
            case 422:
              errorType = ErrorType.VALIDATION;
              break;
            case 500:
            case 502:
            case 503:
              errorType = ErrorType.SERVER;
              break;
            default:
              errorType = ErrorType.UNKNOWN;
          }

          throw new AppError(errorMessage, errorType, status);
        } else if (error.request) {
          throw createError.network('Unable to connect to the server. Please check your connection.');
        } else {
          throw handleError(error, 'Failed to complete request');
        }
      }
    );
  }

  async request<T>(endpoint: string, config: AxiosRequestConfig = {}): Promise<T> {
    try {
      const response = await this.axiosInstance.request<T>({
        url: endpoint,
        ...config,
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  get<T>(endpoint: string, config: AxiosRequestConfig = {}): Promise<T> {
    return this.request<T>(endpoint, { ...config, method: 'GET' });
  }

  post<T>(endpoint: string, data?: unknown, config: AxiosRequestConfig = {}): Promise<T> {
    return this.request<T>(endpoint, {
      ...config,
      method: 'POST',
      data,
    });
  }

  patch<T>(endpoint: string, data?: unknown, config: AxiosRequestConfig = {}): Promise<T> {
    return this.request<T>(endpoint, {
      ...config,
      method: 'PATCH',
      data,
    });
  }

  put<T>(endpoint: string, data?: unknown, config: AxiosRequestConfig = {}): Promise<T> {
    return this.request<T>(endpoint, {
      ...config,
      method: 'PUT',
      data,
    });
  }

  delete<T>(endpoint: string, config: AxiosRequestConfig = {}): Promise<T> {
    return this.request<T>(endpoint, { ...config, method: 'DELETE' });
  }

  // Method to update tenant ID
  updateTenantId(tenantId: string | null) {
    this.tenantId = tenantId;
  }
}

// Hook to use the Super Admin API client - MEMOIZED
export function useSuperAdminApiClient(tenantId?: string) {
  return useMemo(() => new SuperAdminApiClient(API_BASE_URL, tenantId ?? null), [tenantId]);
}
