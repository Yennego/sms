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
  
  // Check for tenant-specific paths - expand to include all tenant routes
  if (pathname.match(/^\/[a-zA-Z0-9.-]+\/(dashboard|login|settings|students|teachers|classes|timetable|attendance|exams|grades|communication|users|academics)/)) {
    return 'TENANT';
  }
  
  // Also check for UUID-based tenant paths (when URL changes to tenant ID)
  if (pathname.match(/^\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\//)) {
    return 'TENANT';
  }
  
  return 'DEFAULT';
}

function getNamespacedCookie(request: NextRequest, key: string, namespace: CookieNamespace): string | undefined {
  const cookieName = getNamespacedKey(key, namespace);
  // const cookieName = `${prefix}${key}`;
  const value = request.cookies.get(cookieName)?.value;
  const displayValue = key === 'accessToken' ? maskToken(value) : (value || 'undefined');
  console.log(`[Middleware] Checking cookie: ${cookieName} = ${displayValue}`);
  return value;
}

function extractTenantFromSubdomain(hostname: string): string | null {
  const hostnameWithoutPort = hostname.split(':')[0];
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
  // In the dashboardRoutes array
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
  if (pathSegments.length > 2 && 
      pathSegments[1] && 
      !pathSegments[1].startsWith('_') && 
      !pathSegments[1].startsWith('api') &&
      !pathSegments[1].startsWith('super-admin') &&
      !dashboardRoutes.includes(pathSegments[1])) {
    return pathSegments[1].toLowerCase();
  }
  
  return null;
}

function extractTenantFromToken(accessToken: string): string | null {
  try {
    const payload = JSON.parse(atob(accessToken.split('.')[1]));
    // Fix: Handle "None" string as null
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
  
  // Debug: List all cookies
  const allCookies = request.cookies.getAll();
  console.log(`[Middleware] All cookies:`, allCookies.map(c => {
    const isAccessToken = c.name.includes('accessToken');
    const displayValue = isAccessToken ? maskToken(c.value) : c.value;
    return `${c.name}=${displayValue}`;
  }).join(', '));
  
  // 1. Try context-specific cookies first
  let tenantId: string | null = getNamespacedCookie(request, 'tenantId', context) || null;
  if (tenantId) {
    console.log(`[Middleware] Found tenantId in ${context} context: ${tenantId}`);
    return tenantId;
  }
  
  // 2. For DEFAULT context, also try TENANT context cookies as fallback
  if (context === 'DEFAULT') {
    const directTenantId = request.cookies.get('tenantId')?.value || null;
    if (directTenantId) {
      console.log(`[Middleware] Found direct tenantId cookie: ${directTenantId}`);
      return directTenantId;
    }
  
    // Suggestion: Only use TENANT fallback if it's a valid UUID AND we can confirm it
    const tenantContextId = getNamespacedCookie(request, 'tenantId', 'TENANT');
    if (tenantContextId && isValidUUID(tenantContextId)) {
      console.log(`[Middleware] Found tenantId in TENANT context as fallback: ${tenantContextId}`);
      return tenantContextId;
    }
  }
  
  // 3. For super-admin context, check if they have a selected tenant
  if (context === 'SUPER_ADMIN') {
    const selectedTenant = getNamespacedCookie(request, 'selectedTenantId', 'SUPER_ADMIN');
    if (selectedTenant) {
      console.log(`[Middleware] Found selectedTenantId for super-admin: ${selectedTenant}`);
      return selectedTenant;
    }
    console.log(`[Middleware] No tenant selected for super-admin context`);
    return null;
  }
  
  // 4. Try to extract from query parameter (e.g., ?tenant=top-foundation.com)
  const tenantFromQuery = searchParams.get('tenant');
  if (tenantFromQuery) {
    tenantId = tenantFromQuery;
    console.log(`[Middleware] Found tenantId from query: ${tenantId}`);
    const response = NextResponse.next();
    response.cookies.set('tenantId', tenantId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 30 * 24 * 60 * 60,
    });
    return tenantId;
  }
  
  // 5. Try to extract from subdomain
  tenantId = extractTenantFromSubdomain(hostname);
  if (tenantId) {
    console.log(`[Middleware] Found tenantId from subdomain: ${tenantId}`);
    return tenantId;
  }
  
  // 6. Try to extract from path
  tenantId = extractTenantFromPath(pathname);
  if (tenantId) {
    console.log(`[Middleware] Found tenantId from path: ${tenantId}`);
    return tenantId;
  }
  
  // 7. Try to extract from JWT token
  const jwtAccessToken = getNamespacedCookie(request, 'accessToken', context);
  if (jwtAccessToken) {
    tenantId = extractTenantFromToken(jwtAccessToken);
    if (tenantId) {
      console.log(`[Middleware] Found tenantId from JWT token: ${tenantId}`);
      const response = NextResponse.next();
      response.cookies.set('tenantId', tenantId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
        maxAge: 30 * 24 * 60 * 60,
      });
      return tenantId;
    }
  }
  
  console.log(`[Middleware] No tenantId found for context: ${context}`);
  return null;
}

export async function middleware(request: NextRequest) {
  // Normalize uppercase tenant segment early to avoid mismatches and loops
  const { pathname } = request.nextUrl;
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
  
  // Convert domain names to UUIDs if necessary
  if (tenantId && !isValidUUID(tenantId)) {
    console.log(`[Middleware] Converting domain '${tenantId}' to UUID`);
    const tenantUUID = await getTenantUUIDByDomain(tenantId);
    if (tenantUUID) {
      tenantId = tenantUUID;
      console.log(`[Middleware] Converted to UUID: ${tenantId}`);
      
      // Create response to store the UUID in cookies for future requests
      cookieResponse = NextResponse.next();
      cookieResponse.cookies.set('tenantId', tenantId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
        maxAge: 30 * 24 * 60 * 60,
      });

      // If current path starts with a non-UUID tenant segment, redirect to the UUID path for consistency
      const segs2 = pathname.split('/');
      const firstSeg = segs2[1] || '';
      const reserved2 = ['api', '_next', 'static', 'super-admin'];
      if (firstSeg && !isValidUUID(firstSeg) && !reserved2.includes(firstSeg.toLowerCase())) {
        segs2[1] = tenantId;
        const redirectUrl = new URL(request.url);
        redirectUrl.pathname = segs2.join('/');
        console.log(`[Middleware] Rewriting tenant segment '${firstSeg}' to UUID '${tenantId}' → ${redirectUrl.pathname}`);
        return NextResponse.redirect(redirectUrl);
      }
    } else {
      console.log(`[Middleware] Failed to convert domain '${tenantId}' to UUID - clearing tenantId`);
      // Clear the invalid tenantId to prevent passing domain strings and stale cookies
      tenantId = null;
      cookieResponse = NextResponse.next();
      cookieResponse.cookies.set('tenantId', '', { path: '/', maxAge: 0 });
      cookieResponse.cookies.set(getNamespacedKey('tenantId', context), '', { path: '/', maxAge: 0 });
    }
  }
  
  // Ensure resolved tenantId is stored in cookies for server-side API routes
  if (tenantId) {
    const existingDefault = request.cookies.get('tenantId')?.value || null;
    const existingNamespaced = request.cookies.get(getNamespacedKey('tenantId', context))?.value || null;
    if (!cookieResponse) cookieResponse = NextResponse.next();
    if (existingDefault !== tenantId) {
      cookieResponse.cookies.set('tenantId', tenantId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
        maxAge: 30 * 24 * 60 * 60,
      });
    }
    if (existingNamespaced !== tenantId) {
      cookieResponse.cookies.set(getNamespacedKey('tenantId', context), tenantId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
        maxAge: 30 * 24 * 60 * 60,
      });
    }
  }
  
  // Define dashboard routes that should be redirected to tenant-specific paths
  const dashboardRoutes = [
    'dashboard', 'students', 'teachers', 'classes', 'timetable', 
    'attendance', 'exams', 'grades', 'communication', 'settings', 'academics'
  ];
  
  // Check if this is a direct dashboard route access (e.g., /teachers)
  // In the middleware function, after line 204:
  // Check if this is a direct dashboard route access (e.g., /teachers, /settings/whatsapp)
  const pathSegments = pathname.split('/');
  if ((pathSegments.length === 2 && dashboardRoutes.includes(pathSegments[1])) ||
  (pathSegments.length === 3 && pathSegments[1] === 'settings')) {
  // If user has a tenant context, redirect to tenant-specific route
  if (tenantId) {
  const tenantSpecificPath = `/${tenantId}${pathname}`;
  console.log(`[Middleware] Redirecting ${pathname} to ${tenantSpecificPath}`);
  return NextResponse.redirect(new URL(tenantSpecificPath, request.url));
  } else {
  // If no tenant context, redirect to login
  console.log(`[Middleware] No tenant context for dashboard route ${pathname}, redirecting to login`);
  return NextResponse.redirect(new URL('/login', request.url));
  }
  }
  
  // Define public routes that don't require authentication or tenant context
  const isPublicRoute = [
    '/login',
    '/session-expired',
    '/super-admin/login',
    '/register',
    '/forgot-password',
    '/reset-password',
    '/_next',
    '/favicon.ico',
    '/api/auth/login',
    '/api/auth/logout',
    '/api/auth/me',
    '/api/auth/register',
    '/api/auth/refresh',
    '/api/tenants/public',
    '/api/tenants',
  ].some(route => pathname.startsWith(route));
  
  // Check for tenant-specific public routes (e.g., /tenantDomain/login)
  const isTenantPublicRoute = /^\/[^/]+\/(login|session-expired|register|forgot-password|reset-password)$/.test(pathname);
  
  // Combine both checks
  const isPublicRouteOrTenantPublic = isPublicRoute || isTenantPublicRoute;
  
  // Handle API routes
  if (pathname.startsWith('/api/')) {
    // For public API routes, no tenant header needed
    if (isPublicRouteOrTenantPublic) {
      return NextResponse.next();
    }
    
    // For protected API routes, tenant context is required (except super-admin)
    if (context !== 'SUPER_ADMIN' && !tenantId) {
      console.log(`[Middleware] No tenant context for API route: ${pathname}`);
      return NextResponse.json(
        { message: 'Tenant context required' },
        { status: 400 }
      );
    }
    
    // Create new request with X-Tenant-ID header if valid UUID
    if (tenantId && isValidUUID(tenantId)) {
      const requestHeaders = new Headers(request.headers);
      requestHeaders.set('X-Tenant-ID', tenantId);
      console.log(`[Middleware] Setting X-Tenant-ID on request: ${tenantId}`);
      
      return NextResponse.next({
        request: {
          headers: requestHeaders,
        },
      });
    } else {
      console.log(`[Middleware] No valid UUID tenant ID available`);
      return NextResponse.next();
    }
  }
  
  // Handle page routes
  if (!isPublicRouteOrTenantPublic) {
    // Check authentication
    if (!accessToken) {
      console.log(`[Middleware] No access token for protected route: ${pathname}`);
      const target = (context === 'TENANT' && tenantId)
        ? `/${tenantId}/session-expired`
        : '/session-expired';
      return NextResponse.redirect(new URL(target, request.url));
    }

    // For tenant routes, ensure tenant context exists
    if (context === 'TENANT' && !tenantId) {
      console.log(`[Middleware] No tenant context for tenant route: ${pathname}`);
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  // If tenant public route is accessed with unknown tenant segment, redirect to default login
  if (isTenantPublicRoute) {
    const seg = pathname.split('/')[1] || '';
    const looksUUID = isValidUUID(seg);
    if (!looksUUID && !tenantId) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  console.log(`[Middleware] Allowing request for: ${pathname}`);
  return cookieResponse || NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next|static|public|_vercel).*)',
  ],
};


// Helper function to validate UUID format
function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

// Helper function to get tenant UUID by domain
async function getTenantUUIDByDomain(domain: string): Promise<string | null> {
  try {
    // Check if BACKEND_API_URL is configured
    const backendUrl = process.env.BACKEND_API_URL;
    if (!backendUrl) {
      console.error('[getTenantUUIDByDomain] BACKEND_API_URL environment variable is not set');
      return null;
    }

    console.log(`[getTenantUUIDByDomain] Fetching UUID for domain: ${domain}`);
    // Fix: Use the correct endpoint path
    const response = await fetch(`${backendUrl}/tenants?domain=${encodeURIComponent(domain.toLowerCase())}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      console.error(`[getTenantUUIDByDomain] Failed to fetch tenant by domain ${domain}:`, response.status, response.statusText);
      return null;
    }

    const data = await response.json();
    console.log(`[getTenantUUIDByDomain] Response data:`, data);
    
    const tenants = Array.isArray(data) ? data : [data];
    const tenantUUID = tenants.length > 0 && tenants[0].id ? tenants[0].id : null;
    
    if (tenantUUID) {
      console.log(`[getTenantUUIDByDomain] Found UUID ${tenantUUID} for domain ${domain}`);
    } else {
      console.log(`[getTenantUUIDByDomain] No UUID found for domain ${domain}`);
    }
    
    return tenantUUID;
  } catch (error) {
    console.error(`[getTenantUUIDByDomain] Error fetching tenant by domain ${domain}:`, error);
    return null;
  }
}
