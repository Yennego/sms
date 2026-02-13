// Shared HTTP utilities for API routes
// Normalizes backend base URL and provides AbortController timeout helpers

export function normalizeBaseUrl(url?: string): string {
  let baseUrl = (url?.trim() || 'http://127.0.0.1:8000/api/v1');
  if (!baseUrl.endsWith('/api/v1')) {
    baseUrl = baseUrl.replace(/\/+$/, '') + '/api/v1';
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
