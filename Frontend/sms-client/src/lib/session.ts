// Server-side session lookup, shared by middleware (edge) and route handlers (node).
//
// The access token lives in an httpOnly cookie per namespace (sa_, tn_, ''); browser code never
// sees it. This module only decodes the payload for routing decisions: the backend verifies the
// signature on every request and stays the authority on who may do what.
import type { CookieNamespace } from '@/utils/cookie-manager';

export const SESSION_NAMESPACES: CookieNamespace[] = ['SUPER_ADMIN', 'TENANT', 'DEFAULT'];

const PREFIX: Record<CookieNamespace, string> = { SUPER_ADMIN: 'sa_', TENANT: 'tn_', DEFAULT: '' };

export function cookieName(key: string, namespace: CookieNamespace): string {
  return `${PREFIX[namespace]}${key}`;
}

/** Anything with a Next.js-style cookie getter: NextRequest.cookies or cookies() from next/headers. */
type CookieSource = { get(name: string): { value: string } | undefined };

export type Session = {
  token: string;
  namespace: CookieNamespace;
  userId: string | null;
  tenantId: string | null;
  isSuperAdmin: boolean;
  exp: number | null;
  expired: boolean;
};

/** Decode (not verify) a JWT payload. Works in both the edge and node runtimes. */
export function decodeJwtPayload(token: string): Record<string, unknown> {
  try {
    const b64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    return JSON.parse(atob(padded));
  } catch {
    return {};
  }
}

/** Read the namespace a request asks for: the X-Auth-Context header, else the page it came from. */
export function preferredNamespace(headers: Headers): CookieNamespace | null {
  const ctx = headers.get('X-Auth-Context');
  if (ctx && (SESSION_NAMESPACES as string[]).includes(ctx)) return ctx as CookieNamespace;
  const referer = headers.get('referer');
  if (referer) {
    try {
      return new URL(referer).pathname.startsWith('/super-admin') ? 'SUPER_ADMIN' : 'TENANT';
    } catch {
      return null;
    }
  }
  return null;
}

/** Namespaces to try, the preferred one first. */
export function namespaceOrder(preferred?: CookieNamespace | null): CookieNamespace[] {
  return preferred ? [preferred, ...SESSION_NAMESPACES.filter(n => n !== preferred)] : SESSION_NAMESPACES;
}

function toSession(token: string, namespace: CookieNamespace): Session {
  const payload = decodeJwtPayload(token);
  const tid = payload.tenant_id;
  const exp = typeof payload.exp === 'number' ? payload.exp : null;
  return {
    token,
    namespace,
    userId: typeof payload.sub === 'string' ? payload.sub : null,
    tenantId: typeof tid === 'string' && !['None', 'null', 'undefined', ''].includes(tid) ? tid : null,
    isSuperAdmin: payload.is_super_admin === true,
    exp,
    expired: exp !== null && exp * 1000 <= Date.now(),
  };
}

/**
 * The signed-in session, if any. Looks in the preferred namespace first, then the others.
 * An expired access token still counts as a session (the proxy refreshes it on first use);
 * use `session.expired` when that matters.
 */
export function getSession(cookies: CookieSource, preferred?: CookieNamespace | null): Session | null {
  for (const ns of namespaceOrder(preferred)) {
    const token = cookies.get(cookieName('accessToken', ns))?.value;
    if (token) return toSession(token, ns);
  }
  return null;
}

/** A super-admin session in any namespace (super-admins may have signed in through a school page). */
export function getSuperAdminSession(cookies: CookieSource): Session | null {
  for (const ns of namespaceOrder('SUPER_ADMIN')) {
    const token = cookies.get(cookieName('accessToken', ns))?.value;
    if (token) {
      const session = toSession(token, ns);
      if (session.isSuperAdmin) return session;
    }
  }
  return null;
}
