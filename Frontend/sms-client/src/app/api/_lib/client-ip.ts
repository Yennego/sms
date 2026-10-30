// The visitor's address for the backend's per-address limits (sign-in attempts, password reset,
// report card checks). Every call to the backend comes from this server, so the backend only
// trusts the X-Client-IP header when it arrives with the shared secret.
//
// PROXY_SHARED_SECRET is server-only (never NEXT_PUBLIC_). Without it nothing is sent and the
// backend falls back to the connecting address.

/** X-Client-IP and X-Proxy-Secret for a backend call, or nothing when no secret is configured. */
export function trustedClientHeaders(request: { headers: Headers }): Record<string, string> {
  const secret = process.env.PROXY_SHARED_SECRET?.trim();
  if (!secret) return {};
  const headers: Record<string, string> = { 'X-Proxy-Secret': secret };
  const ip = clientAddress(request.headers);
  if (ip) headers['X-Client-IP'] = ip;
  return headers;
}

/** First entry of X-Forwarded-For, else X-Real-IP, else null. */
function clientAddress(headers: Headers): string | null {
  const forwarded = headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  if (forwarded) return forwarded;
  const real = headers.get('x-real-ip')?.trim();
  return real || null;
}
