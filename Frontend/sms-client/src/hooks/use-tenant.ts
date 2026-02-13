import { useContext } from 'react';
import { TenantContext } from '@/contexts/tenant-context';

export function useTenant() {
  const context = useContext(TenantContext);
  if (context === undefined) {
    throw new Error('useTenant must be used within a TenantProvider');
  }
  return context;
}

export function useTenantNavigation() {
  const { tenant, tenantId } = useTenant();
  
  const getTenantPath = () => {
    if (tenantId) {
      return tenantId; 
    }
    
    // Fallback: try to get from localStorage
    const storedTenantId = localStorage.getItem('tenantId');
    if (storedTenantId) {
      return storedTenantId;
    }
    
    // Last resort: extract from current URL (UUID or domain), normalize to lowercase for domains
    const currentPath = window.location.pathname;
    const pathSegments = currentPath.split('/');
    if (pathSegments.length > 1) {
      const firstSegment = pathSegments[1];
      const reserved = ['api', '_next', 'static', 'super-admin'];
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(firstSegment);
      if (!reserved.includes(firstSegment.toLowerCase())) {
        return isUUID ? firstSegment : firstSegment.toLowerCase();
      }
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