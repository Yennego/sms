import { useContext } from 'react';
import { TenantContext } from '@/contexts/tenant-context';
import { contextualCookies, getCurrentContext } from '@/utils/cookie-manager';

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
  
  const getTenantPath = () => {
    // 1. Try to maintain the current URL segment if it's valid to prevent redirect bouncing
    if (typeof window !== 'undefined') {
      const currentPath = window.location.pathname;
      const pathSegments = currentPath.split('/');
      if (pathSegments.length > 1 && pathSegments[1]) {
        const firstSegment = pathSegments[1];
        const reserved = ['api', '_next', 'static', 'super-admin', 'login', 'register'];
        if (!reserved.includes(firstSegment.toLowerCase())) {
          return firstSegment;
        }
      }
    }

    // 2. Try the tenant object's domain, subdomain, or code
    if (tenant) {
      if (tenant.domain) return tenant.domain.toLowerCase();
      if (tenant.subdomain) return tenant.subdomain.toLowerCase();
      if (tenant.code) return tenant.code.toLowerCase();
    }

    // 3. Fallback to domain from contextual cookies
    const cookieDomain = contextualCookies.get('currentTenantDomain', getCurrentContext());
    if (cookieDomain) return cookieDomain;

    if (typeof window !== 'undefined') {
      const storedDomain = localStorage.getItem('currentTenantDomain');
      if (storedDomain) return storedDomain;
    }

    // 4. Last resort: tenant UUID
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