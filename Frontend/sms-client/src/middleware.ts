import { NextRequest, NextResponse } from 'next/server';
import { COOKIE_NAMESPACES, getNamespacedKey } from './utils/cookie-manager';

type CookieNamespace = keyof typeof COOKIE_NAMESPACES;

// Utility function to mask sensitive tokens in logs
function maskToken(token: string | undefined): string {
  if (!token) return 'undefined';
  if (process.env.NODE_ENV === 'production') {
    return token.length > 10 ? `${token.substring(0, 6)}...${token.substring(token.length - 4)}` : '***masked***';
  }
  return token; // Show full token in development
}

function getContextFromPath(pathname: string): CookieNamespace {
  if (pathname.startsWith('/super-admin')) {
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
  
  // Define dashboard routes that should not be treated as tenant domains
  const dashboardRoutes = [
      'dashboard', 'students', 'teachers', 'classes', 'timetable', 
      'timetables', 'attendance', 'exams', 'grades', 'communication', 'settings', 'academics'
  ];
  
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
      !firstSegment.startsWith('api') &&
      !firstSegment.startsWith('super-admin') &&
      !dashboardRoutes.includes(firstSegment) &&
      !['login', 'register', 'session-expired', 'forgot-password', 'reset-password'].includes(firstSegment)) {
    return firstSegment;
  }
  
  return null;
}

function extractTenantFromToken(accessToken: string): string | null {
  try {
    const payload = JSON.parse(atob(accessToken.split('.')[1]));
    const tenantId = payload.tenant_id;
    if (!tenantId || tenantId === 'None' || tenantId === 'null' || tenantId === 'undefined') {
      return null;
    }
    return tenantId;
  } catch {
    return null;
  }
}

function resolveTenantId(request: NextRequest, context: CookieNamespace): string | null {
  const { pathname, searchParams } = request.nextUrl;
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

  // 6. Try extract from JWT token - check both current and TENANT namespace for API calls
  let jwtAccessToken = getNamespacedCookie(request, 'accessToken', context);
  if (!jwtAccessToken && pathname.startsWith('/api/') && context !== 'TENANT') {
    jwtAccessToken = getNamespacedCookie(request, 'accessToken', 'TENANT');
  }

  if (jwtAccessToken) {
    const fromToken = extractTenantFromToken(jwtAccessToken);
    if (fromToken) return fromToken;
  }
  
  return null;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Basic normalization
  const segs = pathname.split('/');
  const first = segs[1];
  const reserved = ['api', '_next', 'static', 'super-admin'];

  if (first && /[A-Z]/.test(first) && !reserved.includes(first.toLowerCase())) {
    segs[1] = first.toLowerCase();
    const url = new URL(request.url);
    url.pathname = segs.join('/');
    return NextResponse.redirect(url);
  }

  const context = getContextFromPath(pathname);
  console.log(`[Middleware] Processing ${context} request for: ${pathname}`);

  const accessToken = getNamespacedCookie(request, 'accessToken', context);
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
      const targetPath = `/${tenantId}${pathname}`;
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
    '/login', '/session-expired', '/super-admin/login', '/register',
    '/forgot-password', '/reset-password', '/_next', '/favicon.ico',
    '/api/auth/login', '/api/auth/logout', '/api/auth/me', '/api/auth/register',
    '/api/auth/refresh', '/api/tenants/public', '/api/tenants',
  ].some(route => pathname.startsWith(route));
  
  const isTenantPublicRoute = /^\/[^/]+\/(login|session-expired|register|forgot-password|reset-password)$/.test(pathname);
  const isPublic = isPublicRoute || isTenantPublicRoute;
  
  // API Route Handling
  if (pathname.startsWith('/api/')) {
    if (isPublic) return NextResponse.next();
    
    if (context !== 'SUPER_ADMIN' && !tenantId) {
      console.log(`[Middleware] Blocked API request: No tenant context for ${pathname}`);
      return NextResponse.json({ message: 'Tenant context required' }, { status: 400 });
    }
    
    if (tenantId && isValidUUID(tenantId)) {
      const headers = new Headers(request.headers);
      headers.set('X-Tenant-ID', tenantId);
      return NextResponse.next({ request: { headers } });
    }
    return NextResponse.next();
  }
  
  // Page Route Protected Check
  if (!isPublic) {
    if (!accessToken) {
      console.log(`[Middleware] No token. Redirecting to session-expired.`);
      const target = (tenantId) ? `/${tenantId}/session-expired` : '/session-expired';
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
  matcher: ['/((?!_next|static|public|_vercel).*)'],
};

function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

async function getTenantUUIDByDomain(domain: string): Promise<string | null> {
  try {
    const backendUrl = process.env.BACKEND_API_URL || 'http://localhost:8000/api/v1';
    console.log(`[Middleware] Resolving domain '${domain}' via ${backendUrl}`);
    
    const response = await fetch(`${backendUrl}/tenants?domain=${encodeURIComponent(domain.toLowerCase())}`, {
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
