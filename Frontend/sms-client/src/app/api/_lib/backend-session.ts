// Server-side token refresh shared by the /api/v1 proxy and the auth routes.
import { normalizeBaseUrl } from '@/app/api/_lib/http';
import { BILLING_STATUS_HEADER } from '@/lib/billing-block';

export type TokenPair = { access_token: string; refresh_token: string };

/** The backend refused the refresh because of the school's billing (a suspended school, non-admin). */
export type BillingRefusal = { billingStatus: string; detail: string };

export type RefreshResult = TokenPair | BillingRefusal | null;

export function isBillingRefusal(result: RefreshResult): result is BillingRefusal {
  return Boolean(result && 'billingStatus' in result);
}

// A page load fires many API calls at once; when the access token has expired they would all try
// to refresh with the same refresh token, and since refresh rotates (the old token is revoked)
// all but the first would fail and sign the user out. Share one refresh per refresh token, and
// keep its result briefly for requests that still carry the old cookie.
const inflight = new Map<string, { promise: Promise<RefreshResult>; expires: number }>();
const SHARE_MS = 30_000;

async function callRefresh(refreshToken: string, extraHeaders: Record<string, string>): Promise<RefreshResult> {
  try {
    const res = await fetch(`${normalizeBaseUrl(process.env.BACKEND_API_URL)}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...extraHeaders },
      body: JSON.stringify({ refresh_token: refreshToken }),
      cache: 'no-store',
    });
    if (!res.ok) {
      // phase7-design.md §8: a suspended school lets only its admins refresh (403 with the status)
      const billingStatus = res.headers.get(BILLING_STATUS_HEADER);
      if (res.status === 403 && billingStatus) {
        const data = await res.json().catch(() => null);
        const detail = typeof data?.detail === 'string' && data.detail ? data.detail : "Your school's account is suspended.";
        return { billingStatus, detail };
      }
      return null;
    }
    const data = await res.json().catch(() => null);
    return data?.access_token && data?.refresh_token ? data : null;
  } catch (error) {
    console.error('Token refresh error:', error instanceof Error ? error.message : error);
    return null;
  }
}

/**
 * Exchange a refresh token for a new pair, sharing the call between concurrent requests. Null when
 * the session is over; a BillingRefusal when the school's billing status keeps the user out.
 * `extraHeaders`: the visitor's trusted address (client-ip.ts) of the request that starts the call.
 */
export function refreshTokens(
  refreshToken: string,
  extraHeaders: Record<string, string> = {}
): Promise<RefreshResult> {
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
