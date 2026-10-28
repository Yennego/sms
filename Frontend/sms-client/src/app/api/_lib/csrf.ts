// Cross-site request check for state-changing API calls. Session cookies are sent automatically,
// so a POST from another site would otherwise act as the signed-in user. Edge-safe (used by middleware).
import { NextResponse } from 'next/server';

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function hostOf(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).host.toLowerCase();
  } catch {
    return null;
  }
}

/** True when the request is a write whose Origin (or Referer) is not this app's own host. */
export function isCrossSiteWrite(req: { method: string; headers: Headers }): boolean {
  if (!UNSAFE_METHODS.has(req.method.toUpperCase())) return false;
  const host = (req.headers.get('x-forwarded-host') || req.headers.get('host') || '').toLowerCase();
  if (req.headers.get('origin') === 'null') return true; // opaque origin: sandboxed frame, file://
  const source = hostOf(req.headers.get('origin')) ?? hostOf(req.headers.get('referer'));
  // No Origin and no Referer: not a browser form or fetch from another site (browsers send
  // Origin on cross-site writes), e.g. a server-side call. Allow it.
  if (!source) return false;
  return source !== host;
}

export function crossSiteResponse(): NextResponse {
  return NextResponse.json({ detail: 'Cross-site request blocked' }, { status: 403 });
}

/** Returns a 403 response for a cross-site write, or null when the request may continue. */
export function rejectCrossSite(req: { method: string; headers: Headers }): NextResponse | null {
  return isCrossSiteWrite(req) ? crossSiteResponse() : null;
}
