// Shared HTTP utilities for API routes
// Normalizes backend base URL and provides AbortController timeout helpers

export function normalizeBaseUrl(url?: string): string {
  let baseUrl = (url?.trim() || 'http://127.0.0.1:8000/api/v1');

  // First, strip all trailing slashes to start clean
  baseUrl = baseUrl.replace(/\/+$/, '');

  // Now check if it ends with /api/v1. If not, append it.
  if (!baseUrl.endsWith('/api/v1')) {
    baseUrl += '/api/v1';
  }

  baseUrl = baseUrl.replace('http://localhost:', 'http://127.0.0.1:');
  return baseUrl;
}

// Create a timeout AbortSignal that can be used with fetch
export function createTimeoutSignal(ms: number): { signal: AbortSignal; cancel: () => void } {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);
  return {
    signal: controller.signal,
    cancel: () => clearTimeout(timeout),
  };
}

// Build standard headers for backend calls
export function buildAuthHeaders(accessToken?: string, tenantId?: string): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;
  if (tenantId) headers['X-Tenant-ID'] = tenantId;
  return headers;
}

// Helper function to get namespaced cookies (e.g., sa_accessToken, tn_accessToken)
export function getNamespacedCookie(
  cookieStore: any, // type is ReadonlyRequestCookies from next/headers
  key: string,
  namespace: string = ''
): string | undefined {
  const namespacedKey = `${namespace}${key}`;
  return cookieStore.get(namespacedKey)?.value;
}
