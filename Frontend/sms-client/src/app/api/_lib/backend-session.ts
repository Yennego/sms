// Server-side token refresh shared by the /api/v1 proxy and the auth routes.
import { normalizeBaseUrl } from '@/app/api/_lib/http';

export type TokenPair = { access_token: string; refresh_token: string };

// A page load fires many API calls at once; when the access token has expired they would all try
// to refresh with the same refresh token, and since refresh rotates (the old token is revoked)
// all but the first would fail and sign the user out. Share one refresh per refresh token, and
// keep its result briefly for requests that still carry the old cookie.
const inflight = new Map<string, { promise: Promise<TokenPair | null>; expires: number }>();
const SHARE_MS = 30_000;

async function callRefresh(refreshToken: string, extraHeaders: Record<string, string>): Promise<TokenPair | null> {
  try {
    const res = await fetch(`${normalizeBaseUrl(process.env.BACKEND_API_URL)}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...extraHeaders },
      body: JSON.stringify({ refresh_token: refreshToken }),
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    return data?.access_token && data?.refresh_token ? data : null;
  } catch (error) {
    console.error('Token refresh error:', error instanceof Error ? error.message : error);
    return null;
  }
}

/**
 * Exchange a refresh token for a new pair, sharing the call between concurrent requests.
 * `extraHeaders`: the visitor's trusted address (client-ip.ts) of the request that starts the call.
 */
export function refreshTokens(
  refreshToken: string,
  extraHeaders: Record<string, string> = {}
): Promise<TokenPair | null> {
  const now = Date.now();
  for (const [key, entry] of inflight) {
    if (entry.expires <= now) inflight.delete(key);
  }
  const existing = inflight.get(refreshToken);
  if (existing) return existing.promise;
  const promise = callRefresh(refreshToken, extraHeaders);
  inflight.set(refreshToken, { promise, expires: now + SHARE_MS });
  return promise;
}
