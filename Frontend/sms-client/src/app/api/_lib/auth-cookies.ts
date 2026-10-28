// Session cookies, set and cleared only by server code (the /api/auth/* routes and the /api/v1 proxy).
//
// - accessToken: httpOnly, path '/'. Page scripts can't read it; the /api/v1 proxy attaches it to
//   backend calls as a Bearer header. It lives as long as the session, because middleware treats
//   its presence as "signed in"; an expired token inside it is refreshed by the proxy on first 401.
// - refreshToken: httpOnly, SameSite=Strict, path '/api' so only API routes (refresh, logout and
//   the proxy's automatic refresh) ever receive it.
// - session: script-readable marker ('1') so client code can tell someone is signed in without
//   seeing a token. tenantId stays script-readable too (it is not a secret).
import { NextRequest, NextResponse } from 'next/server';
import type { CookieNamespace } from '@/utils/cookie-manager';
import { SESSION_NAMESPACES, cookieName, decodeJwtPayload, namespaceOrder } from '@/lib/session';

export { decodeJwtPayload };

export const NAMESPACES = SESSION_NAMESPACES;
export const REFRESH_COOKIE_PATH = '/api';
// Paths earlier versions used for the refresh cookie; cleared on logout so none linger.
const LEGACY_REFRESH_PATHS = ['/', '/api/auth'];

const REFRESH_MAX_AGE = 30 * 24 * 60 * 60; // matches REFRESH_TOKEN_EXPIRE_DAYS on the backend
const ACCESS_MAX_AGE = REFRESH_MAX_AGE;
const SECURE = process.env.NODE_ENV === 'production';

/** Super-admins use the SUPER_ADMIN namespace (the /platform pages look for sa_ cookies first). */
export function namespaceForToken(accessToken: string): CookieNamespace {
  return decodeJwtPayload(accessToken).is_super_admin === true ? 'SUPER_ADMIN' : 'TENANT';
}

export function setSessionCookies(
  res: NextResponse,
  namespace: CookieNamespace,
  accessToken: string,
  refreshToken: string,
  tenantId?: string | null,
) {
  res.cookies.set(cookieName('accessToken', namespace), accessToken, {
    httpOnly: true, secure: SECURE, sameSite: 'lax', path: '/', maxAge: ACCESS_MAX_AGE,
  });
  res.cookies.set(cookieName('refreshToken', namespace), refreshToken, {
    httpOnly: true, secure: SECURE, sameSite: 'strict', path: REFRESH_COOKIE_PATH, maxAge: REFRESH_MAX_AGE,
  });
  res.cookies.set(cookieName('session', namespace), '1', {
    httpOnly: false, secure: SECURE, sameSite: 'lax', path: '/', maxAge: REFRESH_MAX_AGE,
  });
  if (tenantId) {
    res.cookies.set(cookieName('tenantId', namespace), tenantId, {
      httpOnly: false, secure: SECURE, sameSite: 'lax', path: '/', maxAge: REFRESH_MAX_AGE,
    });
  }
}

/** Set cookies from a backend token response; the namespace and school come from the token itself. */
export function setSessionFromTokens(res: NextResponse, accessToken: string, refreshToken: string, fallbackTenantId?: string | null) {
  const tid = decodeJwtPayload(accessToken).tenant_id;
  const tenantId = typeof tid === 'string' && tid !== 'None' && tid !== 'null' ? tid : fallbackTenantId;
  setSessionCookies(res, namespaceForToken(accessToken), accessToken, refreshToken, tenantId);
}

/** Refresh token from the httpOnly cookie, preferring the namespace the client is in. */
export function readRefreshToken(req: NextRequest, preferred?: string | null): string | undefined {
  const pref = preferred && (NAMESPACES as string[]).includes(preferred) ? (preferred as CookieNamespace) : null;
  for (const ns of namespaceOrder(pref)) {
    const value = req.cookies.get(cookieName('refreshToken', ns))?.value;
    if (value) return value;
  }
  return undefined;
}

/**
 * Expire every session cookie in every namespace, including refresh cookies on older paths.
 * Call it last: res.cookies keeps one entry per name, so the per-path refresh expiries are
 * appended as raw headers, which a later res.cookies.set() would drop.
 */
export function clearSessionCookies(res: NextResponse) {
  for (const ns of NAMESPACES) {
    for (const key of ['accessToken', 'session', 'tenantId']) {
      res.cookies.set(cookieName(key, ns), '', { path: '/', maxAge: 0 });
    }
  }
  for (const ns of NAMESPACES) {
    for (const path of [REFRESH_COOKIE_PATH, ...LEGACY_REFRESH_PATHS]) {
      res.headers.append('Set-Cookie', `${cookieName('refreshToken', ns)}=; Path=${path}; Max-Age=0; HttpOnly; SameSite=Strict`);
    }
  }
}
