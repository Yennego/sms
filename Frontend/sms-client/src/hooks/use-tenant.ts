import { useContext } from 'react';
import { TenantContext } from '@/contexts/tenant-context';
import { contextualCookies, getCurrentContext } from '@/utils/cookie-manager';
import { isReservedSlug } from '@/config/reserved-slugs';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function useTenant() {
  const context = useContext(TenantContext);
  if (context === undefined) {
    throw new Error('useTenant must be used within a TenantProvider');
  }
  
  // Create a robust identifier that is unique even during loading
  const tenantKey = context.tenant?.id || context.tenant?.domain || null;
  
  return { ...context, tenantKey };
}

export function useTenantNavigation() {
  const { tenant, tenantId } = useTenant();
  
  // Links use the school's slug (/foundation/...), never its id
  const getTenantPath = () => {
    // 1. The current URL's school slug (keeps the address the user is on; no redirect bounce)
    if (typeof window !== 'undefined') {
      const firstSegment = window.location.pathname.split('/')[1];
      if (firstSegment && !isReservedSlug(firstSegment) && !UUID_RE.test(firstSegment)) {
        return firstSegment.toLowerCase();
      }
    }

    // 2. The loaded school's domain (its slug), then subdomain or code
    if (tenant) {
      if (tenant.domain) return tenant.domain.toLowerCase();
      if (tenant.subdomain) return tenant.subdomain.toLowerCase();
      if (tenant.code) return tenant.code.toLowerCase();
    }

    // 3. The remembered domain (cookie, then localStorage)
    const cookieDomain = contextualCookies.get('currentTenantDomain', getCurrentContext());
    if (cookieDomain) return cookieDomain.toLowerCase();

    if (typeof window !== 'undefined') {
      const storedDomain = localStorage.getItem('currentTenantDomain');
      if (storedDomain) return storedDomain.toLowerCase();
    }

    // 4. Last resort, no slug known at all: the id in the URL or the loaded school's id
    //    (the school layout swaps an id address for the slug once the school loads)
    if (typeof window !== 'undefined') {
      const firstSegment = window.location.pathname.split('/')[1];
      if (firstSegment && UUID_RE.test(firstSegment)) return firstSegment;
    }
    if (tenantId) return tenantId;
    
    // 5. Try the tenant ID from contextual cookies
    const cookieTenantId = contextualCookies.get('tenantId', getCurrentContext());
    if (cookieTenantId) return cookieTenantId;

    if (typeof window !== 'undefined') {
      const storedTenantId = localStorage.getItem('tenantId');
      if (storedTenantId) return storedTenantId;
    }
    
    return null;
  };

  return {
    tenant,
    tenantId,
    getTenantPath,
    createTenantPath: (path: string) => {
      const tenantPath = getTenantPath();
      if (!tenantPath) {
        return path; // Return the path as-is if no tenant context
      }
      const normalizedPath = path.startsWith('/') ? path : `/${path}`;
      return `/${tenantPath}${normalizedPath}`;
    }
  };
}