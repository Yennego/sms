import cookies from 'js-cookie';

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
 * 2. Cookies (tn_tenantId, tenantId)
 * 3. localStorage
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
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tenantIdentifier);
      
      if (isUUID) {
        return tenantIdentifier;
      }
    }
    
    // Fallback to stored tenant ID
    const storedTenantId = cookies.get('tn_tenantId') || 
                          cookies.get('tenantId') || 
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
    
    // Fallback to stored subdomain
    return localStorage.getItem('currentTenantSubdomain');
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
  
  let tenantName: string | null = null;
  let tenantDomain: string | null = null;
  
  if (typeof window !== 'undefined') {
    tenantName = localStorage.getItem('currentTenantName');
    tenantDomain = localStorage.getItem('currentTenantDomain');
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
  const tenantId = extractTenantId();
  
  if (tenantId) {
    return tenantId;
  }
  
  // For development, use the Top Foundation tenant ID
  if (process.env.NODE_ENV === 'development') {
    return '34624041-c24a-4400-a9b7-f692c3f3fba7'; // Top Foundation tenant ID
  }
  
  return null;
}

/**
 * Store tenant data in localStorage and cookies (updated to include subdomain)
 */
export function storeTenantData(tenantId: string, domain?: string, subdomain?: string, name?: string): void {
  if (typeof window !== 'undefined') {
    // Store in localStorage
    localStorage.setItem('tenantId', tenantId);
    
    if (domain) {
      localStorage.setItem('currentTenantDomain', domain);
    }
    
    if (subdomain) {
      localStorage.setItem('currentTenantSubdomain', subdomain);
    }
    
    if (name) {
      localStorage.setItem('currentTenantName', name);
    }
    
    // Store in cookies
    cookies.set('tenantId', tenantId, { expires: 30 }); // 30 days
    cookies.set('tn_tenantId', tenantId, { expires: 30 });
    
    if (subdomain) {
      cookies.set('tenantSubdomain', subdomain, { expires: 30 });
    }
  }
}

/**
 * Clear all tenant data from storage
 */
export function clearTenantData(): void {
  if (typeof window !== 'undefined') {
    // Clear localStorage
    localStorage.removeItem('tenantId');
    localStorage.removeItem('currentTenantDomain');
    localStorage.removeItem('currentTenantSubdomain');
    localStorage.removeItem('currentTenantName');
    
    // Clear cookies
    cookies.remove('tenantId');
    cookies.remove('tn_tenantId');
    cookies.remove('tenantSubdomain');
  }
}
