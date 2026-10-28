// The one proxy from the browser to the FastAPI backend (backend-for-frontend).
//
// The browser never holds a token: this route reads the httpOnly access cookie and sends it as a
// Bearer header. When the access token has expired it refreshes once with the httpOnly refresh
// cookie, retries, and sets the rotated cookies on the response. Only known backend areas are
// forwarded, and cross-site writes are refused.
import { NextRequest, NextResponse } from 'next/server';
import { normalizeBaseUrl } from '@/app/api/_lib/http';
import { clearSessionCookies, readRefreshToken, setSessionFromTokens } from '@/app/api/_lib/auth-cookies';
import { refreshTokens, type TokenPair } from '@/app/api/_lib/backend-session';
import { rejectCrossSite } from '@/app/api/_lib/csrf';
import { cookieName, getSession, preferredNamespace } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Top-level routers in Backend/sms-backend/src/api/v1/api.py
const BACKEND_AREAS = new Set([
  'tenants', 'auth', 'people', 'academics', 'communication', 'logging',
  'resources', 'super-admin', 'specialized', 'finance',
]);

// Frontend paths that name a backend path differently (prefix → prefix)
const PATH_REWRITES: [string, string][] = [
  ['academics/student-grades', 'academics/grades'],
];

const REQUEST_HEADERS = ['accept', 'accept-language', 'content-type', 'x-tenant-id'];
const RESPONSE_HEADERS = [
  'content-type', 'content-disposition', 'cache-control', 'retry-after',
  'x-password-change-required', 'x-total-count',
];

type Params = { params: Promise<{ path: string[] }> };

function backendPath(segments: string[]): string {
  let path = segments.map(encodeURIComponent).join('/');
  for (const [from, to] of PATH_REWRITES) {
    if (path === from || path.startsWith(`${from}/`)) {
      path = to + path.slice(from.length);
      break;
    }
  }
  return path;
}

async function proxy(request: NextRequest, { params }: Params) {
  const blocked = rejectCrossSite(request);
  if (blocked) return blocked;

  const { path: segments = [] } = await params;
  // Dot segments would be resolved by fetch and could step outside /api/v1
  if (!segments.length || !BACKEND_AREAS.has(segments[0]) || segments.some((s) => s === '.' || s === '..')) {
    return NextResponse.json({ detail: 'Not found' }, { status: 404 });
  }

  const url = `${normalizeBaseUrl(process.env.BACKEND_API_URL)}/${backendPath(segments)}${request.nextUrl.search}`;
  const method = request.method.toUpperCase();
  // Buffer the body once so the request can be replayed after a token refresh
  const body = method === 'GET' || method === 'HEAD' ? undefined : await request.arrayBuffer();

  const session = getSession(request.cookies, preferredNamespace(request.headers));
  const headers = new Headers();
  for (const name of REQUEST_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  if (!headers.has('x-tenant-id') && session) {
    const tenantId = request.cookies.get(cookieName('tenantId', session.namespace))?.value || session.tenantId;
    if (tenantId) headers.set('x-tenant-id', tenantId);
  }

  const send = (token: string | undefined) => {
    if (token) headers.set('authorization', `Bearer ${token}`);
    else headers.delete('authorization');
    return fetch(url, { method, headers, body, cache: 'no-store' });
  };

  const refreshToken = readRefreshToken(request, session?.namespace);
  let rotated: TokenPair | null = null;
  let refreshFailed = false;

  try {
    // Expired already: refresh first instead of spending a round trip on a certain 401
    if (session?.expired && refreshToken) {
      rotated = await refreshTokens(refreshToken);
      refreshFailed = !rotated;
    }

    let upstream = await send(rotated?.access_token ?? session?.token);
    if (upstream.status === 401 && !rotated && !refreshFailed && refreshToken) {
      rotated = await refreshTokens(refreshToken);
      refreshFailed = !rotated;
      if (rotated) upstream = await send(rotated.access_token);
    }

    const resHeaders = new Headers();
    for (const name of RESPONSE_HEADERS) {
      const value = upstream.headers.get(name);
      if (value) resHeaders.set(name, value);
    }
    const noBody = upstream.status === 204 || upstream.status === 304 || method === 'HEAD';
    const res = new NextResponse(noBody ? null : await upstream.arrayBuffer(), {
      status: upstream.status,
      headers: resHeaders,
    });

    if (rotated) {
      setSessionFromTokens(res, rotated.access_token, rotated.refresh_token, session?.tenantId);
    } else if (upstream.status === 401 && session) {
      // The session is over: drop the cookies so middleware stops treating the browser as signed in
      clearSessionCookies(res);
    }
    return res;
  } catch (error) {
    console.error(`[api/v1 proxy] ${method} /${segments.join('/')}:`, error instanceof Error ? error.message : error);
    return NextResponse.json({ detail: 'The server could not be reached. Try again.' }, { status: 502 });
  }
}

export { proxy as GET, proxy as POST, proxy as PUT, proxy as PATCH, proxy as DELETE, proxy as HEAD };
