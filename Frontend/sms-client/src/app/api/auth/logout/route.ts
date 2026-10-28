import { NextRequest, NextResponse } from 'next/server';
import { normalizeBaseUrl } from '@/app/api/_lib/http';
import { clearSessionCookies, readRefreshToken } from '@/app/api/_lib/auth-cookies';
import { rejectCrossSite } from '@/app/api/_lib/csrf';
import { getSession } from '@/lib/session';
import type { CookieNamespace } from '@/utils/cookie-manager';

/**
 * Log out everywhere this browser is signed in: revoke the access and refresh tokens on the
 * backend, then expire every session cookie (all of them httpOnly or path-scoped, so scripts
 * can't do this themselves). Always succeeds from the user's point of view.
 */
export async function POST(request: NextRequest) {
  const blocked = rejectCrossSite(request);
  if (blocked) return blocked;

  const context = request.headers.get('X-Auth-Context');
  const session = getSession(request.cookies, context as CookieNamespace | null);
  const refreshToken = readRefreshToken(request, context);

  if (session || refreshToken) {
    try {
      await fetch(`${normalizeBaseUrl(process.env.BACKEND_API_URL)}/auth/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session && { Authorization: `Bearer ${session.token}` }),
        },
        body: JSON.stringify({ refresh_token: refreshToken ?? null }),
        cache: 'no-store',
      });
    } catch (error) {
      console.error('Backend logout error:', error instanceof Error ? error.message : error);
    }
  }

  const res = NextResponse.json({ message: 'Successfully logged out' });
  clearSessionCookies(res);
  return res;
}
