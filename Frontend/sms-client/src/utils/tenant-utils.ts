import cookies from 'js-cookie';
import { contextualCookies, getCurrentContext } from './cookie-manager';

/**
 * Utility interface for tenant data
 */
export interface TenantData {
  id: string | null;
  domain: string | null;
  subdomain?: string | null;
  name?: string | null;
}

/**
 * Extract tenant ID from various sources in priority order:
 * 1. URL path segments (UUID format)
 * 2. Contextual Cookies (tn_tenantId, tenantId)
 * 3. localStorage (fallback)
 */
export function extractTenantId(): string | null {
  // Check URL path for tenant UUID
  if (typeof window !== 'undefined') {
    const pathname = window.location.pathname;
    const pathSegments = pathname?.split('/') || [];
    
    if (pathSegments.length > 1 && pathSegments[1] && 
        !pathSegments[1].startsWith('_') && 
        !pathSegments[1].startsWith('api') &&
        pathSegments[1] !== 'super-admin') {
      
      const tenantIdentifier = pathSegments[1];
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tenantIdentifier) || 
                     /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tenantIdentifier);
      
      if (isUUID) {
        return tenantIdentifier;
      }
    }
    
    // Fallback to contextual cookies
    const currentContext = getCurrentContext();
    const storedTenantId = contextualCookies.get('tenantId', currentContext) || 
                          contextualCookies.get('tenantId', 'DEFAULT') ||
                          localStorage.getItem('tenantId');
    
    if (storedTenantId) {
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(storedTenantId);
      if (isUUID) {
        return storedTenantId;
      }
    }
  }
  
  return null;
}

/**
 * Extract tenant subdomain from URL path (represents tenant subdomain, not domain)
 */
export function extractTenantSubdomain(): string | null {
  if (typeof window !== 'undefined') {
    const pathname = window.location.pathname;
    const pathSegments = pathname?.split('/') || [];
    
    if (pathSegments.length > 1 && pathSegments[1] && 
        !pathSegments[1].startsWith('_') && 
        !pathSegments[1].startsWith('api') &&
        pathSegments[1] !== 'super-admin') {
      
      const knownRoutes = [
        'dashboard', 'login', 'register', 'forgot-password', 'reset-password', 
        'change-password', 'admin-dashboard', 'settings',
        'students', 'teachers', 'classes', 'timetable', 'attendance', 
        'exams', 'grades', 'communication'
      ];
      
      // If it's not a known route, it should be a tenant subdomain
      if (!knownRoutes.includes(pathSegments[1])) {
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(pathSegments[1]);
        if (!isUUID) {
          return pathSegments[1]; // Return subdomain from URL path
        }
      }
    }
    
    // Fallback to contextual cookies then localStorage
    const currentContext = getCurrentContext();
    return contextualCookies.get('currentTenantDomain', currentContext) || 
           localStorage.getItem('currentTenantSubdomain') ||
           localStorage.getItem('currentTenantDomain');
  }
  
  return null;
}

/**
 * Extract tenant domain from URL path (legacy function - now use extractTenantSubdomain)
 * @deprecated Use extractTenantSubdomain() instead
 */
export function extractTenantDomain(): string | null {
  // For backward compatibility, return subdomain
  return extractTenantSubdomain();
}

/**
 * Get comprehensive tenant data from current session
 */
export function getCurrentTenantData(): TenantData {
  const tenantId = extractTenantId();
  const tenantSubdomain = extractTenantSubdomain();
  const currentContext = getCurrentContext();
  
  let tenantName: string | null = null;
  let tenantDomain: string | null = null;
  
  if (typeof window !== 'undefined') {
    tenantName = contextualCookies.get('currentTenantName', currentContext) || localStorage.getItem('currentTenantName');
    tenantDomain = contextualCookies.get('currentTenantDomain', currentContext) || localStorage.getItem('currentTenantDomain');
  }
  
  return {
    id: tenantId,
    domain: tenantDomain,
    subdomain: tenantSubdomain,
    name: tenantName
  };
}

/**
 * Check if current session has valid tenant context
 */
export function hasValidTenantContext(): boolean {
  const tenantData = getCurrentTenantData();
  return !!(tenantData.id || tenantData.subdomain);
}

/**
 * Get tenant ID for API headers with subdomain context
 */
export function getTenantIdForAPI(): string | null {
  return extractTenantId();
}

/**
 * Store tenant data in localStorage and cookies (updated to include subdomain)
 */
export function storeTenantData(tenantId: string, domain?: string, subdomain?: string, name?: string): void {
  if (typeof window !== 'undefined') {
    const currentContext = getCurrentContext();
    const expiry = { expires: 30 }; // 30 days
    
    // Store in contextual cookies (Priority)
    contextualCookies.set('tenantId', tenantId, expiry, currentContext);
    if (domain) contextualCookies.set('currentTenantDomain', domain, expiry, currentContext);
    if (name) contextualCookies.set('currentTenantName', name, expiry, currentContext);
    
    // Legacy support / Redundancy
    localStorage.setItem('tenantId', tenantId);
    if (domain) localStorage.setItem('currentTenantDomain', domain);
    if (subdomain) localStorage.setItem('currentTenantSubdomain', subdomain);
    if (name) localStorage.setItem('currentTenantName', name);
    
    // Direct cookie access for middleware (non-namespaced)
    cookies.set('tenantId', tenantId, expiry);
    if (domain) cookies.set('currentTenantDomain', domain, expiry);
  }
}

/**
 * Clear all tenant data from storage
 */
export function clearTenantData(): void {
  if (typeof window !== 'undefined') {
    const currentContext = getCurrentContext();
    
    // Clear contextual cookies
    contextualCookies.remove('tenantId', currentContext);
    contextualCookies.remove('currentTenantDomain', currentContext);
    contextualCookies.remove('currentTenantName', currentContext);
    contextualCookies.clearContext('TENANT');
    
    // Clear general cookies
    cookies.remove('tenantId');
    cookies.remove('tn_tenantId');
    cookies.remove('tenantSubdomain');
    cookies.remove('currentTenantDomain');
    
    // Clear localStorage
    localStorage.removeItem('tenantId');
    localStorage.removeItem('currentTenantDomain');
    localStorage.removeItem('currentTenantSubdomain');
    localStorage.removeItem('currentTenantName');
  }
}
