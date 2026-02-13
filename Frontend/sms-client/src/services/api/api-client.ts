import { useTenant } from '@/hooks/use-tenant';
import { useAuth } from '@/hooks/use-auth';
import { handleError, createError, ErrorType, AppError } from '@/utils/error-utils';
import { useMemo, useEffect } from 'react';
import axios, { AxiosInstance, AxiosRequestConfig, AxiosError } from 'axios';

// Use Next.js API routes instead of calling backend directly
const API_BASE_URL = '/api/v1';

// Create a module-level cache that's shared across instances
const globalCache = new Map<string, { data: unknown; timestamp: number }>();
const CACHE_TTL = 10000; // 10 seconds cache lifetime

// Utility: consider client ready as soon as instance exists
export async function waitForApiClientReady(apiClient: ApiClient | null): Promise<void> {
  let retryCount = 0;
  const maxRetries = 50;
  const baseDelayMs = 50;

  while (retryCount < maxRetries) {
    if (apiClient) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, baseDelayMs));
    retryCount++;
  }

  throw new Error('API client is not ready. Tenant context is still loading.');
}

// Helper function to create a waitForApiClientReady function that returns the client
export function createWaitForApiClientReady(apiClient: ApiClient | null) {
  return async (): Promise<ApiClient> => {
    await waitForApiClientReady(apiClient);
    if (!apiClient) {
      throw new Error('API client is null after waiting');
    }
    return apiClient;
  };
}

// Add: UUID validator (module-scope)
function isValidUUID(str: string | null | undefined): boolean {
  if (!str) return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

export class ApiClient {
  private axiosInstance: AxiosInstance;
  private tenantId: string | null;
  private accessToken: string | null;

  constructor(baseUrl = API_BASE_URL, tenantId: string | null = null, accessToken: string | null = null) {
    console.log('[ApiClient Constructor] Received tenantId:', tenantId, 'Type:', typeof tenantId);

    this.tenantId = tenantId;
    this.accessToken = accessToken;

    // Create axios instance with base configuration
    this.axiosInstance = axios.create({
      baseURL: baseUrl,
      timeout: 90000,
      headers: {
        'Content-Type': 'application/json',
      },
      withCredentials: true,
      timeoutErrorMessage: 'Request timed out. Please try again.',
    });

    // Request interceptor for auth and headers
    this.axiosInstance.interceptors.request.use(
      (config) => {
        console.log('[ApiClient Request] About to send request to:', config.url);
        console.log('[ApiClient Request] Current tenantId:', this.tenantId, 'IsValidUUID:', isValidUUID(this.tenantId));

        // Add auth token if available
        if (this.accessToken) {
          config.headers.Authorization = `Bearer ${this.accessToken}`;
        }

        const parseCookie = (name: string) => {
          const m = typeof document !== 'undefined' ? document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]+)')) : null;
          return m ? decodeURIComponent(m[1]) : null;
        };
        const candidateTenant = (() => {
          if (this.tenantId) return this.tenantId as string;
          const c1 = parseCookie('tn_tenantId') || parseCookie('tenantId');
          if (c1) return c1;
          const seg = typeof window !== 'undefined' ? window.location.pathname.split('/')[1] || null : null;
          // Allow any segment that isn't a reserved word
          const reserved = [
            'api', '_next', 'static', 'super-admin', 'login',
            'students', 'teachers', 'parents', 'academics',
            'communication', 'resources', 'logging', 'settings',
            'dashboard', 'profile'
          ];
          if (seg && !reserved.includes(seg.toLowerCase())) return seg;
          return null;
        })();
        if (candidateTenant) {
          config.headers['X-Tenant-ID'] = candidateTenant;
        } else if ((config.headers as Record<string, unknown>)['X-Tenant-ID']) {
          const hdrs = (config.headers as Record<string, unknown>);
          delete hdrs['X-Tenant-ID'];
        }

        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor for error handling
    this.axiosInstance.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        if (error.response) {
          const { status, data } = error.response;
          let errorMessage: string;
          let errorType: ErrorType;

          const method = error.config?.method?.toUpperCase() || 'UNKNOWN';
          const url = error.config?.url || 'UNKNOWN_URL';
          const contentType = ((error.response.headers as unknown as Record<string, unknown>)?.['content-type'] as string) || '';

          // Always warn (avoid Next overlay from console.error for expected failures)
          const logger = console.warn;
          logger('[ApiClient Error]', { status, method, url, contentType });

          // Extract error message
          if (typeof data === 'string') {
            const isHtmlPayload = /^\s*<!DOCTYPE html/i.test(data) || /\<html/i.test(data);
            errorMessage = isHtmlPayload
              ? `Page not found or HTML error at ${url} (${status ?? 'unknown'})`
              : data;
          } else if (data && typeof data === 'object') {
            const errorData = data as any;
            if (errorData.message) {
              errorMessage = errorData.message;
            } else if (errorData.detail) {
              if (Array.isArray(errorData.detail)) {
                const arr = errorData.detail;
                errorMessage = arr.map((err: any) =>
                  typeof err === 'string' ? err : err.msg || JSON.stringify(err)
                ).join(', ');
              } else if (typeof errorData.detail === 'string') {
                errorMessage = errorData.detail;
              } else {
                errorMessage = JSON.stringify(errorData.detail);
              }
            } else if (errorData.error) {
              const e = errorData.error;
              errorMessage = typeof e === 'string' ? e : JSON.stringify(e);
            } else {
              errorMessage = JSON.stringify(errorData);
            }
          } else {
            errorMessage = error.message || 'An error occurred';
          }

          // Map status codes to error types
          switch (status) {
            case 400:
              errorType = ErrorType.VALIDATION;
              break;
            case 401:
              errorType = ErrorType.AUTHENTICATION;
              if (typeof window !== 'undefined' &&
                !error.config?.url?.includes('/auth/login') &&
                !error.config?.url?.includes('/auth/refresh') &&
                !error.config?.url?.includes('/auth/me')) {
                try { sessionStorage.setItem('sessionExpired', '1'); } catch { }

                const currentPath = window.location.pathname;
                const endsWithSessionExpired = currentPath.endsWith('/session-expired');
                const onLoginPage = currentPath.endsWith('/login') || /\/login(\/|$)/.test(currentPath);

                if (this.accessToken && !endsWithSessionExpired && !onLoginPage) {
                  const tenantSeg = (this.tenantId && isValidUUID(this.tenantId))
                    ? this.tenantId
                    : (document.cookie.match(/(?:^|; )tn_tenantId=([^;]+)/)?.[1] ||
                      document.cookie.match(/(?:^|; )tenantId=([^;]+)/)?.[1] ||
                      null);

                  const target = tenantSeg ? `/${tenantSeg}/session-expired` : '/session-expired';
                  window.location.href = target;
                }
              }
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
              errorType = ErrorType.SERVER;
              break;
            case 502:
            case 503:
            case 504:
              errorType = ErrorType.NETWORK;
              break;
            default:
              errorType = ErrorType.UNKNOWN;
          }

          // Friendly duplicate-email mapping (even if server sent 500)
          if (typeof errorMessage === 'string') {
            const em = errorMessage.toLowerCase();
            const looksDuplicateEmail =
              em.includes('uniqueviolation') ||
              (em.includes('duplicate key') && em.includes('email')) ||
              em.includes('users_email_key');

            if (looksDuplicateEmail) {
              errorType = ErrorType.VALIDATION;
              errorMessage = 'Email already exists. Please use a different email or select the existing student.';
            }
          }

          throw new AppError(errorMessage, errorType, status, error);
        } else if (error.request) {
          // Distinguish timeouts and cancellations from generic network failures
          if (axios.isAxiosError(error)) {
            const msg = String(error.message || '').toLowerCase();
            if (error.code === 'ERR_CANCELED') {
              throw createError.network('Request canceled', error);
            }
            if (msg.includes('timeout')) {
              throw createError.network('Request timed out. Please try again.', error);
            }
          }
          throw createError.network('Unable to connect to the server. Please check your connection.', error);
        } else {
          // Something else happened
          throw handleError(error, 'Failed to complete request');
        }
      }
    );
  }

  async request<T>(endpoint: string, config: AxiosRequestConfig = {}): Promise<T> {
    // For GET requests, check cache first
    if (!config.method || config.method.toLowerCase() === 'get') {
      const cacheKey = `${endpoint}-${this.tenantId || 'no-tenant'}`;
      const cachedItem = globalCache.get(cacheKey);
      if (cachedItem && (Date.now() - cachedItem.timestamp < CACHE_TTL)) {
        console.log(`Using cached data for: ${endpoint}`);
        return cachedItem.data as T;
      }
    }

    try {
      const response = await this.axiosInstance.request<T>({
        url: endpoint,
        ...config,
      });

      // Cache GET requests
      if (!config.method || config.method.toLowerCase() === 'get') {
        const cacheKey = `${endpoint}-${this.tenantId || 'no-tenant'}`;
        globalCache.set(cacheKey, {
          data: response.data,
          timestamp: Date.now()
        });
      }

      return response.data;
    } catch (error) {
      const isGet = !config.method || config.method.toLowerCase() === 'get';
      const appErr = handleError(error);
      if (isGet && appErr instanceof AppError && appErr.type === ErrorType.NETWORK) {
        const attempt = (config as { __attempt?: number }).__attempt ?? 0;
        const maxRetries = 3;
        const base = 500; // Increased from 250
        const backoffMs = Math.min(base * Math.pow(2, attempt), 3000); // Max 3s
        const jitterMs = Math.round(backoffMs * (0.5 + Math.random() * 1.0)); // Wider jitter
        console.warn(`[ApiClient] Network/timeout for ${endpoint}. Retrying in ${jitterMs}ms (attempt ${attempt + 1}/${maxRetries})`);
        await new Promise(r => setTimeout(r, jitterMs));
        const prevTimeout = typeof config.timeout === 'number'
          ? config.timeout
          : this.axiosInstance.defaults.timeout ?? 45000;
        const nextTimeout = Math.min(prevTimeout + 10000, 60000);
        const nextConfig = { ...config, __attempt: attempt + 1, timeout: nextTimeout } as AxiosRequestConfig;
        return this.request<T>(endpoint, nextConfig);
      }
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
    }).then(res => {
      clearGlobalCache();
      return res;
    });
  }

  put<T>(endpoint: string, data?: unknown, config: AxiosRequestConfig = {}): Promise<T> {
    return this.request<T>(endpoint, {
      ...config,
      method: 'PUT',
      data,
    }).then(res => {
      clearGlobalCache();
      return res;
    });
  }

  delete<T>(endpoint: string, config: AxiosRequestConfig = {}): Promise<T> {
    return this.request<T>(endpoint, { ...config, method: 'DELETE' }).then(res => {
      clearGlobalCache();
      return res;
    });
  }

  // Method to update access token
  updateAccessToken(token: string | null) {
    this.accessToken = token;
  }
}

// Hook to use the API client with current tenant and auth context
// Add this function before the ApiClient class
export function clearGlobalCache() {
  globalCache.clear();
  console.log('[API Client] Global cache cleared');
}

// Modify the useApiClient hook to clear cache when tenant changes
// Enhanced useApiClient hook with better debugging and timing handling
export function useApiClient(): ApiClient {
  const { tenant } = useTenant();
  const { accessToken } = useAuth();

  // Clear cache only when tenant changes
  useEffect(() => {
    if (tenant?.id) {
      clearGlobalCache();
    }
  }, [tenant?.id]);

  // Memoize the ApiClient instance to prevent infinite re-renders
  const apiClient = useMemo(() => {
    // Prefer ID, but fallback to domain or code if available
    const safeTenantId = (tenant?.id || tenant?.domain || tenant?.code) as string | null;
    const client = new ApiClient(API_BASE_URL, safeTenantId, accessToken || null);
    return client;
  }, [tenant?.id, tenant?.domain, tenant?.code, accessToken]);

  return apiClient;
}

// New hook that provides both client and loading state
export function useApiClientWithLoading(): { apiClient: ApiClient | null; isLoading: boolean } {
  const { tenant } = useTenant();
  const { accessToken } = useAuth();

  const cookieMatch = typeof document !== 'undefined'
    ? (document.cookie.match(/(?:^|; )tn_tenantId=([^;]+)/) || document.cookie.match(/(?:^|; )tenantId=([^;]+)/))
    : null;
  const cookieTenantId = cookieMatch ? decodeURIComponent(cookieMatch[1]) : null;

  // Consider loaded if we have ANY tenant identifier (ID, domain, or code)
  const hasTenantIdentifier = !!(tenant?.id || tenant?.domain || tenant?.code || cookieTenantId);
  const effectiveLoading = !hasTenantIdentifier;

  // Clear cache when tenant changes and client is usable
  useEffect(() => {
    if (tenant?.id && !effectiveLoading) {
      clearGlobalCache();
    }
  }, [tenant?.id, effectiveLoading]);

  const apiClient = useMemo(() => {
    const safeTenantId = (() => {
      // 1. Try tenant context (ID -> Domain -> Code)
      if (tenant?.id) return tenant.id;
      if (tenant?.domain) return tenant.domain;
      if (tenant?.code) return tenant.code;

      // 2. Try cookies
      const m = typeof document !== 'undefined'
        ? (document.cookie.match(/(?:^|; )tn_tenantId=([^;]+)/) || document.cookie.match(/(?:^|; )tenantId=([^;]+)/))
        : null;
      if (m) return decodeURIComponent(m[1]);

      return null;
    })();
    return new ApiClient(API_BASE_URL, safeTenantId, accessToken || null);
  }, [tenant?.id, tenant?.domain, tenant?.code, accessToken]);

  return { apiClient, isLoading: effectiveLoading };
}
