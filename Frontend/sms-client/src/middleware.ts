import { NextRequest, NextResponse } from 'next/server';
import { COOKIE_NAMESPACES, getNamespacedKey } from './utils/cookie-manager';
import { getSession, getSuperAdminSession } from './lib/session';
import { rejectCrossSite } from './app/api/_lib/csrf';
import { isPlatformPath, isReservedSlug } from './config/reserved-slugs';

type CookieNamespace = keyof typeof COOKIE_NAMESPACES;

// Tokens never appear in logs, in any environment: only whether one is present
function maskToken(token: string | undefined): string {
  return token ? '[present]' : 'undefined';
}

function getContextFromPath(pathname: string): CookieNamespace {
  if (isPlatformPath(pathname)) {
    return 'SUPER_ADMIN';
  }
  
  // These paths are NOT tenant-specific
  const nonTenantPrefixes = ['/api/', '/_next/', '/static/', '/public/', '/favicon.ico'];
  const topLevelNonTenant = ['login', 'register', 'session-expired', 'forgot-password', 'reset-password'];
  
  // Check if it's a known non-tenant path
  if (nonTenantPrefixes.some(prefix => pathname.startsWith(prefix))) {
    return 'DEFAULT';
  }
  
  // Check if it's a top-level public page (e.g. /login, /session-expired)
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length === 1 && topLevelNonTenant.includes(segments[0])) {
    return 'DEFAULT';
  }
  
  // Any path with a first segment that looks like a tenant domain/id is TENANT
  // e.g. /foundation/dashboard, /34624041-.../finance/fees
  if (segments.length >= 1 && segments[0] && 
      !segments[0].startsWith('_') && 
      !segments[0].startsWith('api')) {
    return 'TENANT';
  }
  
  return 'DEFAULT';
}

function getNamespacedCookie(request: NextRequest, key: string, namespace: CookieNamespace): string | undefined {
  const cookieName = getNamespacedKey(key, namespace);
  const value = request.cookies.get(cookieName)?.value;
  const displayValue = key === 'accessToken' ? maskToken(value) : (value || 'undefined');
  console.log(`[Middleware] Checking cookie: ${cookieName} = ${displayValue}`);
  return value;
}

function extractTenantFromSubdomain(hostname: string): string | null {
  const hostnameWithoutPort = hostname.split(':')[0].toLowerCase();
  
  // Skip deployment platform domains
  const ignoreList = ['.vercel.app', '.netlify.app', '.onrender.com', '.github.io', '.azurewebsites.net'];
  if (ignoreList.some(domain => hostnameWithoutPort.endsWith(domain))) {
    return null;
  }

  const parts = hostnameWithoutPort.split('.');
  
  // For subdomains like tenant.example.com
  if (parts.length > 2) {
    const subdomain = parts[0];
    if (subdomain !== 'www' && subdomain !== 'localhost') {
      return subdomain.toLowerCase();
    }
  }
  
  return null;
}

function extractTenantFromPath(pathname: string): string | null {
  const pathSegments = pathname.split('/');

  // Check for UUID-based tenant paths first
  if (pathSegments.length > 1 && pathSegments[1]) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
    if (uuidRegex.test(pathSegments[1])) {
      return pathSegments[1];
    }
  }
  
  // Check for tenant domain paths like /tenant-domain/dashboard
  const firstSegment = pathSegments[1]?.toLowerCase();
  
  if (pathSegments.length >= 2 && 
      firstSegment && 
      !firstSegment.startsWith('_') &&
      !isReservedSlug(firstSegment)) {
    return firstSegment;
  }
  
  return null;
}

function resolveTenantId(request: NextRequest, context: CookieNamespace): string | null {
  const { pathname } = request.nextUrl;
  const hostname = request.headers.get('host') || '';
  
  console.log(`[Middleware] Resolving tenant ID for context: ${context}`);
  
  // 1. Try context-specific cookies FIRST
  let tenantId: string | null = getNamespacedCookie(request, 'tenantId', context) || null;
  if (tenantId) {
    console.log(`[Middleware] Found tenantId in context ${context}: ${tenantId}`);
    return tenantId;
  }
  
  // 2. Try the URL path (High Priority)
  const tenantFromPath = extractTenantFromPath(pathname);
  if (tenantFromPath) {
    console.log(`[Middleware] Found tenant ID from path: ${tenantFromPath}`);
    return tenantFromPath;
  }

  // 3. For DEFAULT context, try global tenantId cookie
  if (context === 'DEFAULT') {
    const directTenantId = request.cookies.get('tenantId')?.value || null;
    if (directTenantId) {
      return directTenantId;
    }
  }
  
  // 4. Try extract from subdomain
  const tenantFromSubdomain = extractTenantFromSubdomain(hostname);
  if (tenantFromSubdomain) {
    return tenantFromSubdomain;
  }

  // 5. If still no tenantId and this is an API route, try checking TENANT context explicitly
  if (!tenantId && pathname.startsWith('/api/')) {
    tenantId = getNamespacedCookie(request, 'tenantId', 'TENANT') || null;
    if (tenantId) {
      console.log(`[Middleware] Found tenantId in TENANT fallback for API route: ${tenantId}`);
      return tenantId;
    }
  }

  // 6. The school in the signed-in user's token (current namespace first)
  return getSession(request.cookies, context)?.tenantId ?? null;
}

// The school's address for a redirect: its slug (from the URL, then the remembered domain),
// and its id only when no slug is known (the school layout swaps an id for the slug)
function schoolPathSegment(request: NextRequest, context: CookieNamespace, tenantId: string): string {
  const fromPath = extractTenantFromPath(request.nextUrl.pathname);
  if (fromPath && !isValidUUID(fromPath)) return fromPath;
  const remembered = getNamespacedCookie(request, 'currentTenantDomain', context)
    || request.cookies.get('currentTenantDomain')?.value;
  if (remembered && !isReservedSlug(remembered)) return remembered.toLowerCase();
  return tenantId;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Basic normalization
  const segs = pathname.split('/');
  const first = segs[1];
  const reserved = ['api', '_next', 'static', 'platform', 'super-admin'];

  if (first && /[A-Z]/.test(first) && !reserved.includes(first.toLowerCase())) {
    segs[1] = first.toLowerCase();
    const url = new URL(request.url);
    url.pathname = segs.join('/');
    return NextResponse.redirect(url);
  }

  const context = getContextFromPath(pathname);
  console.log(`[Middleware] Processing ${context} request for: ${pathname}`);

  // Cross-site writes never reach a route handler (session cookies would otherwise be sent along)
  if (pathname.startsWith('/api/')) {
    const blocked = rejectCrossSite(request);
    if (blocked) return blocked;
  }

  // Signed in = an access cookie (httpOnly) in any namespace; /platform pages need a super-admin one
  const session = context === 'SUPER_ADMIN'
    ? getSuperAdminSession(request.cookies)
    : getSession(request.cookies, context);
  console.log(`[Middleware] Session (${context}): ${maskToken(session?.token)}`);
  let tenantId = resolveTenantId(request, context);
  let cookieResponse: NextResponse | null = null;
  
  // Convert domain names to UUIDs if possible, but FAIL GRACEFULLY
  if (tenantId && !isValidUUID(tenantId)) {
    console.log(`[Middleware] Domain '${tenantId}' needs resolution to UUID`);
    const tenantUUID = await getTenantUUIDByDomain(tenantId);
    
    if (tenantUUID) {
      console.log(`[Middleware] Successfully resolved '${tenantId}' to UUID '${tenantUUID}'`);
      tenantId = tenantUUID;
      
      // Update response with localized cookie
      cookieResponse = NextResponse.next();
      cookieResponse.cookies.set(getNamespacedKey('tenantId', context), tenantId, {
        httpOnly: false, // Accessible to client TenantContext
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 30 * 24 * 60 * 60,
      });
      
      // Also update global cookie for compatibility
      cookieResponse.cookies.set('tenantId', tenantId, { path: '/', maxAge: 30 * 24 * 60 * 60 });
    } else {
      // CRITICAL FIX: If resolution fails, do NOT clear tenantId. 
      // Keep the domain string so the request can proceed and the client can handle lookups.
      console.warn(`[Middleware] Could not resolve UUID for domain '${tenantId}'. Proceeding with domain name.`);
    }
  }
  
  // Check if this is a direct dashboard route access that needs redirecting
  const dashboardRoutes = [
    'dashboard', 'students', 'teachers', 'classes', 'timetable', 
    'attendance', 'exams', 'grades', 'communication', 'settings', 'academics'
  ];
  const pathSegments = pathname.split('/');
  
  if ((pathSegments.length === 2 && dashboardRoutes.includes(pathSegments[1])) ||
      (pathSegments.length === 3 && pathSegments[1] === 'settings')) {
    
    if (tenantId) {
      const targetPath = `/${schoolPathSegment(request, context, tenantId)}${pathname}`;
      console.log(`[Middleware] URL missing tenant segment. Redirecting to: ${targetPath}`);
      const redirect = NextResponse.redirect(new URL(targetPath, request.url));
      // Carry over any cookies we might have set
      if (cookieResponse) {
        cookieResponse.cookies.getAll().forEach(c => redirect.cookies.set(c.name, c.value));
      }
      return redirect;
    }
    // If no tenantId, we let it fall through to public/protected check
  }
  
  const isPublicRoute = [
    '/login', '/session-expired', '/platform/login', '/register',
    '/forgot-password', '/reset-password', '/_next', '/favicon.ico',
    '/api/auth/login', '/api/auth/logout', '/api/auth/me',
    '/api/auth/forgot-password', '/api/auth/reset-password',
    '/api/auth/refresh', '/api/tenants/public', '/api/tenants',
  ].some(route => pathname.startsWith(route));

  const isTenantPublicRoute = /^\/[^/]+\/(login|session-expired|register|forgot-password|reset-password)$/.test(pathname);
  const isPublic = isPublicRoute || isTenantPublicRoute;

  // API Route Handling: the route handlers and the backend check the session; here we only
  // supply the school when the caller didn't name one (super-admins name it explicitly).
  if (pathname.startsWith('/api/')) {
    if (isPublic || request.headers.has('X-Tenant-ID')) return NextResponse.next();

    if (tenantId && isValidUUID(tenantId)) {
      const headers = new Headers(request.headers);
      headers.set('X-Tenant-ID', tenantId);
      return NextResponse.next({ request: { headers } });
    }
    return NextResponse.next();
  }

  // Page Route Protected Check
  if (!isPublic) {
    if (!session) {
      if (context === 'SUPER_ADMIN') {
        console.log(`[Middleware] No super-admin session. Redirecting to /platform/login.`);
        return NextResponse.redirect(new URL('/platform/login', request.url));
      }
      console.log(`[Middleware] No session. Redirecting to session-expired.`);
      const target = (tenantId) ? `/${schoolPathSegment(request, context, tenantId)}/session-expired` : '/session-expired';
      return NextResponse.redirect(new URL(target, request.url));
    }

    if (context === 'TENANT' && !tenantId) {
      console.log(`[Middleware] Protected tenant route but no tenant context. Redirecting to root login.`);
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  return cookieResponse || NextResponse.next();
}

export const config = {
  // Skip build assets and anything that looks like a file or a well-known URI
  // (/.well-known/..., /favicon.ico, /robots.txt): those are never a school's address
  matcher: ['/((?!_next|static|public|_vercel|\\.well-known|.*\\.[a-zA-Z0-9]+$).*)'],
};

function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

async function getTenantUUIDByDomain(domain: string): Promise<string | null> {
  try {
    const backendUrl = process.env.BACKEND_API_URL || 'http://localhost:8000/api/v1';
    console.log(`[Middleware] Resolving domain '${domain}' via ${backendUrl}`);
    
    const response = await fetch(`${backendUrl}/tenants/?domain=${encodeURIComponent(domain.toLowerCase())}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      next: { revalidate: 3600 } // Cache for 1 hour
    });

    if (!response.ok) return null;

    const data = await response.json();
    const tenants = Array.isArray(data) ? data : [data];
    return tenants.length > 0 && tenants[0].id ? tenants[0].id : null;
  } catch (error) {
    console.error(`[Middleware] Resolution error:`, error);
    return null;
  }
}
