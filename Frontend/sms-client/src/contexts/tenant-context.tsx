"use client";

import { createContext, useContext, useState, ReactNode, useEffect, useRef } from 'react';
import { Tenant } from '@/types/tenant';
import { usePathname } from 'next/navigation';
import cookies from 'js-cookie';
import { queryClient } from '@/lib/query-client';
import { contextualCookies, getCurrentContext } from '@/utils/cookie-manager';

type TenantContextType = {
  tenant: Tenant | null;
  tenantId: string | null;
  setTenant: (tenant: Tenant) => void;
  isLoading: boolean;
  refreshTenant: () => Promise<void>;
};

export const TenantContext = createContext<TenantContextType | undefined>(undefined);

export function TenantProvider({ children }: { children: ReactNode }) {
  const [tenant, setTenant] = useState<Tenant | null>(() => {
    if (typeof window === 'undefined') return null;
    
    // PRIORITY 1: URL Path (Internal routing)
    const pathname = window.location.pathname;
    const pathSegments = pathname.split('/').filter(Boolean);
    let urlIdentifier = null;
    
    if (pathSegments.length >= 1) {
      const firstSegment = pathSegments[0];
      const isReserved = ['api', '_next', 'static', 'super-admin', 'login', 'session-expired'].includes(firstSegment);
      if (!isReserved) {
        urlIdentifier = firstSegment;
      }
    }

    // PRIORITY 2: Hostname (Subdomains)
    let subdomainIdentifier = null;
    const hostname = window.location.hostname;
    const subdomain = hostname.split('.')[0];
    if (subdomain !== 'localhost' && subdomain !== 'www' && !hostname.endsWith('.vercel.app') && !hostname.endsWith('.onrender.com')) {
      subdomainIdentifier = subdomain;
    }

    const currentContext = getCurrentContext();
    const identifier = urlIdentifier || subdomainIdentifier || 
                      contextualCookies.get('tenantId', currentContext) || 
                      cookies.get('tn_tenantId') || 
                      cookies.get('tenantId');
    
    if (!identifier) return null;

    // If it's a UUID, return a minimal tenant object
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier)) {
      return { id: identifier, name: 'Loading...', domain: null as any } as Tenant;
    }
    
    // If it's a domain/slug, return a minimal tenant with that domain
    return { id: null as any, name: 'Loading...', domain: identifier } as Tenant;
  });
  
  const [isLoading, setIsLoading] = useState(true);
  const pathname = usePathname();
  const lastResolvedIdentifierRef = useRef<string | null>(null);
  const prevTenantIdRef = useRef<string | null>(tenant?.id || null);
  
  // Prevent data bleed: clear all TanStack Query caches whenever the tenant context actually CHANGES
  useEffect(() => {
    const currentId = tenant?.id || null;
    if (currentId && prevTenantIdRef.current && currentId !== prevTenantIdRef.current) {
      console.log('[Tenant Context] Tenant ID changed from', prevTenantIdRef.current, 'to', currentId, '- Clearing query cache');
      queryClient.clear();
    }
    prevTenantIdRef.current = currentId;
  }, [tenant?.id]);

  useEffect(() => {
    if (!pathname) return;
    
    // Extract tenant identifier from pathname
    const pathSegments = pathname.split('/').filter(Boolean);
    const tenantIdentifierFromPath = pathSegments[0] || null;
    const isReserved = ['api', '_next', 'static', 'super-admin', 'login', 'session-expired'].includes(tenantIdentifierFromPath || '');
    
    const currentContext = getCurrentContext();
    
    // Isolation: Skip tenant resolution for super-admin and reserved routes
    if (currentContext === 'SUPER_ADMIN' || pathname.startsWith('/super-admin') || isReserved) {
      if (lastResolvedIdentifierRef.current !== 'SUPER_ADMIN') {
        console.log('[Tenant Context] Switching to Super Admin context or reserved route');
        setTenant(null);
        setIsLoading(false);
        lastResolvedIdentifierRef.current = 'SUPER_ADMIN';
      }
      return;
    }

    // Determine the actual identifier (Path vs Cookie vs Subdomain)
    const identifier = tenantIdentifierFromPath || 
                      contextualCookies.get('currentTenantDomain', currentContext) || 
                      contextualCookies.get('tenantId', currentContext);

    if (!identifier) {
      setTenant(null);
      setIsLoading(false);
      lastResolvedIdentifierRef.current = null;
      return;
    }

    // Only re-run resolution logic if the identifier actually changed
    if (identifier === lastResolvedIdentifierRef.current && tenant) {
      return;
    }
    
    lastResolvedIdentifierRef.current = identifier;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const isUUID = uuidRegex.test(identifier);

    // Guard against invalid tenant values
    const invalidTenantValues = [
      'system.local', 'system', 'local', 'localhost',
      'undefined', 'null', 'none'
    ];
    if (invalidTenantValues.includes(identifier.toLowerCase())) {
      setIsLoading(false);
      return;
    }

    // Start resolution
    // Only set loading if we don't have a valid tenant yet or its ID is different
    const isNewTenant = isUUID ? (tenant?.id !== identifier) : (tenant?.domain !== identifier);
    if (isNewTenant) {
      setIsLoading(true);
    }

    if (isUUID) {
      // UUID resolution
      console.log('[Tenant Context] UUID detected, fetching full details for:', identifier);
      
      const endpoint = `/api/v1/tenants/${identifier}?_t=${Date.now()}`;
      fetch(endpoint, { 
        cache: 'no-store',
        signal: AbortSignal.timeout(60000) 
      })
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (!data) return;
          const active = data.isActive ?? data.is_active ?? true;
          if (active !== false) {
            const normalized: Tenant = {
              id: data.id,
              name: data.name,
              code: data.code,
              domain: data.domain,
              subdomain: data.subdomain,
              logo: data.logo,
              primaryColor: data.primary_color || data.primaryColor,
              secondaryColor: data.secondary_color || data.secondaryColor,
              isActive: active,
              createdAt: data.created_at || data.createdAt,
              updatedAt: data.updated_at || data.updatedAt
            };
            setTenant(normalized);
            contextualCookies.set('tenantId', data.id, { expires: 30 }, currentContext);
            if (data.domain) contextualCookies.set('currentTenantDomain', data.domain, { expires: 30 }, currentContext);
          }
        })
        .catch(err => console.error('[Tenant Context] Error fetching tenant by UUID:', err))
        .finally(() => setIsLoading(false));
    } else {
      // Domain/Slug resolution
      console.log('[Tenant Context] Domain slug detected:', identifier);
      const endpoint = `/api/tenants?domain=${encodeURIComponent(identifier)}&_t=${Date.now()}`;
      
      fetch(endpoint, { cache: 'no-store' })
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          const raw = Array.isArray(data) ? data.find((t: any) => t?.domain === identifier || t?.subdomain === identifier || t?.code === identifier) : data;
          if (!raw) return;

          const active = raw.isActive ?? raw.is_active ?? true;
          if (active !== false) {
            const normalized: Tenant = {
              id: raw.id || raw.tenant_id,
              name: raw.name,
              code: raw.code,
              domain: raw.domain || identifier,
              subdomain: raw.subdomain,
              logo: raw.logo,
              primaryColor: raw.primary_color || raw.primaryColor,
              secondaryColor: raw.secondary_color || raw.secondaryColor,
              isActive: active,
              createdAt: raw.created_at || raw.createdAt,
              updatedAt: raw.updated_at || raw.updatedAt
            };
            setTenant(normalized);
            contextualCookies.set('tenantId', normalized.id, { expires: 30 }, currentContext);
            contextualCookies.set('currentTenantDomain', identifier, { expires: 30 }, currentContext);
          }
        })
        .catch(err => console.error('[Tenant Context] Error fetching tenant by domain:', err))
        .finally(() => setIsLoading(false));
    }
  }, [pathname, tenant]);

  const refreshTenant = async () => {
    const tid = tenant?.id || contextualCookies.get('tenantId', getCurrentContext());
    if (!tid) return;

    try {
      const res = await fetch(`/api/v1/tenants/${tid}?_t=${Date.now()}`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setTenant(prev => ({ ...prev, ...data }));
      }
    } catch (err) {
      console.error('[Tenant Context] Error refreshing tenant:', err);
    }
  };

  return (
    <TenantContext.Provider value={{
      tenant,
      tenantId: tenant?.id || null,
      setTenant,
      isLoading,
      refreshTenant
    }}>
      {children}
    </TenantContext.Provider>
  );
}

export const useTenant = () => {
  const context = useContext(TenantContext);
  if (context === undefined) throw new Error('useTenant must be used within a TenantProvider');
  return context;
};
