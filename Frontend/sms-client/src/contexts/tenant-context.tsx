"use client";

import { createContext, useContext, useState, ReactNode, useEffect, useRef } from 'react';
import { Tenant } from '@/types/tenant';
import { usePathname } from 'next/navigation';
import cookies from 'js-cookie';

type TenantContextType = {
  tenant: Tenant | null;
  tenantId: string | null;
  setTenant: (tenant: Tenant) => void;
  isLoading: boolean;
  refreshTenant: () => Promise<void>;
};

export const TenantContext = createContext<TenantContextType | undefined>(undefined);

export function TenantProvider({ children }: { children: ReactNode }) {
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const pathname = usePathname();
  const lastPathnameRef = useRef<string | null>(null);
  const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

  useEffect(() => {
    if (!pathname) return;
    if (lastPathnameRef.current === pathname) return;
    lastPathnameRef.current = pathname;

    // Extract tenant from subdomain, path, or localStorage
    function extractTenantFromDomain() {
      // First, try to extract tenant ID from URL path
      const pathSegments = pathname?.split('/') || [];
      if (pathSegments.length >= 2 && pathSegments[1]) {
        const firstSegment = pathSegments[1];
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(firstSegment);
        if (isUUID) {
          console.log('[Tenant Context] Extracted tenant ID from URL path:', firstSegment);
          return firstSegment;
        }

        const isDomain = /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(firstSegment);
        if (isDomain) {
          console.log('[Tenant Context] Extracted domain from URL path:', firstSegment);
          return firstSegment.toLowerCase();
        }

        const isSimpleTenant = /^[a-zA-Z0-9-]+$/.test(firstSegment) &&
          firstSegment !== 'api' &&
          firstSegment !== '_next' &&
          firstSegment !== 'static' &&
          firstSegment !== 'super-admin' &&
          firstSegment !== 'login';
        if (isSimpleTenant) {
          console.log('[Tenant Context] Extracted tenant name from URL path:', firstSegment);
          return firstSegment.toLowerCase();
        }
      }

      const hostname = window.location.hostname;
      const hostnameWithoutPort = hostname.split(':')[0];
      const subdomain = hostnameWithoutPort.split('.')[0];

      console.log('[Tenant Context] Debug - hostname:', hostname, 'subdomain:', subdomain);

      // Skip subdomain extraction for deployment platforms and non-tenant domains
      const isDeploymentPlatform = hostnameWithoutPort.endsWith('.vercel.app') ||
        hostnameWithoutPort.endsWith('.netlify.app') ||
        hostnameWithoutPort.endsWith('.onrender.com');

      if (!isDeploymentPlatform && subdomain !== 'localhost' && subdomain !== 'www') {
        console.log('[Tenant Context] Using subdomain as tenant:', subdomain);
        return subdomain.toLowerCase();
      }

      // If we already have a tenant and we're on a dashboard route, persist it
      if (tenant && pathSegments.length >= 2) {
        const dashboardRoutes = [
          'dashboard', 'students', 'teachers', 'classes', 'timetable', 'timetables', 'academics',
          'attendance', 'exams', 'grades', 'communication', 'settings'
        ];
        if (dashboardRoutes.includes(pathSegments[1]) ||
          (pathSegments.length >= 3 && dashboardRoutes.includes(pathSegments[2]))) {
          console.log('[Tenant Context] Persisting tenant for dashboard route');
          const persistedTenant = tenant.domain || localStorage.getItem('currentTenantDomain');
          console.log('[Tenant Context] Persisted tenant value:', persistedTenant);
          return persistedTenant;
        }
      }

      // Fallback to stored subdomain
      const storedSubdomain = localStorage.getItem('currentTenantDomain');
      console.log('[Tenant Context] Stored subdomain from localStorage:', storedSubdomain);

      // Clear invalid stored subdomains
      const invalidTenantValues = [
        'system.local', 'system', 'local', 'localhost',
        'session-expired', 'undefined', 'null', 'none',
        'login', 'api', '_next', 'static', 'super-admin',
      ];
      if (storedSubdomain && invalidTenantValues.includes(storedSubdomain.toLowerCase())) {
        console.log('[Tenant Context] Clearing invalid stored subdomain:', storedSubdomain);
        localStorage.removeItem('currentTenantDomain');
        localStorage.removeItem('tenantId');
        try { cookies.remove('tn_tenantId', { path: '/' }); } catch { }
        try { cookies.remove('tenantId', { path: '/' }); } catch { }
        return null;
      }

      return storedSubdomain;
    };

    const tenantId = extractTenantFromDomain();
    const cookieTenantId = cookies.get('tn_tenantId') || cookies.get('tenantId') || null;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const cookieIsUUID = typeof cookieTenantId === 'string' && uuidRegex.test(cookieTenantId);
    console.log('[Tenant Context] Extracted tenant ID:', tenantId);

    // Validate tenant ID - reject invalid values
    const invalidTenantValues = [
      'system.local', 'system', 'local', 'localhost',
      'session-expired', 'undefined', 'null', 'none',
      'login', 'api', '_next', 'static', 'super-admin',
    ];
    if (tenantId && invalidTenantValues.includes(tenantId.toLowerCase())) {
      console.log('[Tenant Context] Invalid tenant ID detected, clearing data:', tenantId);
      localStorage.removeItem('currentTenantDomain');
      localStorage.removeItem('tenantId');
      try { cookies.remove('tn_tenantId', { path: '/' }); } catch { }
      try { cookies.remove('tenantId', { path: '/' }); } catch { }
      setTenant(null);
      setIsLoading(false);
      return;
    }

    if (tenantId || cookieIsUUID) {
      // For development, create a mock tenant if using default UUID
      if (tenantId === '00000000-0000-0000-0000-000000000001') {
        const mockTenant = {
          id: tenantId,
          name: 'Development Tenant',
          domain: 'localhost'
        };
        setTenant(mockTenant);
        localStorage.setItem('tenantId', tenantId);
        setIsLoading(false);
      } else {
        // Check if tenantId is a UUID or a domain name
        const isUUID = uuidRegex.test(tenantId || '') || cookieIsUUID;

        // For valid UUIDs, create a minimal tenant object to allow API calls to work
        if (isUUID) {
          const id = cookieIsUUID ? (cookieTenantId as string) : (tenantId as string);
          console.log('[Tenant Context] UUID detected, fetching full details for:', id);

          // Set minimal tenant first to allow API calls to pass auth/tenant checks
          const minimalTenant = { id, name: 'Loading...', domain: null as any } as Tenant;
          setTenant(minimalTenant);
          localStorage.setItem('tenantId', id);
          try { cookies.set('tn_tenantId', id, { path: '/' }); } catch { }

          // Fetch full details
          const endpoint = `/api/v1/tenants/${id}`;
          fetch(endpoint, { signal: AbortSignal.timeout(60000) })
            .then(res => {
              if (!res.ok) {
                console.warn(`[Tenant Context] Failed to fetch tenant details (${res.status}), keeping minimal tenant`);
                return null;
              }
              return res.json();
            })
            .then(data => {
              if (!data) {
                console.log('[Tenant Context] No data returned, keeping minimal tenant');
                return;
              }
              console.log('[Tenant Context] Fetched tenant details for UUID:', data);
              const active = data.isActive ?? data.is_active ?? true;

              if (active !== false) {
                const cleanVal = (val: any) => (val === '[null]' || val === 'null' ? null : val);
                const normalized: Tenant = {
                  id: data.id,
                  name: data.name,
                  code: data.code,
                  domain: data.domain,
                  subdomain: data.subdomain,
                  logo: cleanVal(data.logo),
                  primaryColor: cleanVal(data.primary_color || data.primaryColor),
                  secondaryColor: cleanVal(data.secondary_color || data.secondaryColor),
                  isActive: active,
                  createdAt: data.created_at || data.createdAt,
                  updatedAt: data.updated_at || data.updatedAt
                };
                setTenant(normalized);
                if (data.domain) localStorage.setItem('currentTenantDomain', data.domain);
              }
            })
            .catch(err => {
              console.error('[Tenant Context] Error fetching tenant details for UUID:', err);
              // Keep minimal tenant on error so at least ID is available
            })
            .finally(() => {
              setIsLoading(false);
            });
          return;
        }

        // Optimistically set minimal tenant using domain, then fetch details to hydrate id/name
        const domainCandidate = tenantId as string;
        const minimalDomainTenant = { id: localStorage.getItem('tenantId') || null, name: 'Loading...', domain: domainCandidate } as Tenant;
        setTenant(minimalDomainTenant);
        localStorage.setItem('currentTenantDomain', domainCandidate);
        const endpoint = `/api/tenants?domain=${encodeURIComponent(domainCandidate)}`;
        console.log('[Tenant Context] Fetching tenant details from:', endpoint);
        fetch(endpoint)
          .then(res => {
            console.log('[Tenant Context] API response status:', res.status);
            const contentType = res.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
              console.warn('Non-JSON response received, skipping JSON parse');
              return [] as any;
            }
            return res.json();
          })
          .then(data => {
            console.log('[Tenant Context] API response data:', data);
            const raw = Array.isArray(data) ? data.find((t: any) => (t?.domain === domainCandidate || t?.subdomain === domainCandidate || t?.code === domainCandidate)) || null : data;

            if (!raw) {
              console.error('[Tenant Context] No tenant found for domain:', domainCandidate);
              return;
            }

            const id = raw.id || raw.tenant_id || localStorage.getItem('tenantId');
            const domain = raw.domain || raw.subdomain || localStorage.getItem('currentTenantDomain');
            const active = raw.isActive ?? raw.is_active ?? true;
            if (id && active !== false) {
              const cleanVal = (val: any) => (val === '[null]' || val === 'null' ? null : val);

              const normalized: Tenant = {
                id,
                name: raw.name,
                code: raw.code,
                domain,
                subdomain: raw.subdomain,
                logo: cleanVal(raw.logo),
                primaryColor: cleanVal(raw.primary_color || (raw as any).primaryColor),
                secondaryColor: cleanVal(raw.secondary_color || (raw as any).secondaryColor),
                isActive: active,
                createdAt: raw.created_at || (raw as any).createdAt,
                updatedAt: raw.updated_at || (raw as any).updatedAt
              };
              console.log('[Tenant Context] Setting tenant data:', normalized);
              setTenant(normalized);
              localStorage.setItem('tenantId', id);
              if (domain) localStorage.setItem('currentTenantDomain', domain);
              try { cookies.set('tn_tenantId', id, { path: '/' }); } catch { }
            } else {
              console.error('Tenant is inactive or not found, but keeping minimal tenant for API calls');
              // Keep the minimal tenant object so API calls can still work
              if (isUUID) {
                console.log('[Tenant Context] Keeping minimal tenant for UUID:', tenantId);
              } else {
                // Keep minimal domain tenant so UI can render
                setTenant(minimalDomainTenant);
                localStorage.removeItem('tenantId');
              }
            }
          })
          .catch(err => {
            console.error('Error fetching tenant details:', err);
            // For UUIDs, keep the minimal tenant so API calls can work
            if (isUUID) {
              console.log('[Tenant Context] API failed but keeping minimal tenant for UUID:', tenantId);
              // Tenant is already set above, just log the error
            } else {
              // Clear tenant data on error for domain-based lookups
              setTenant(minimalDomainTenant);
              localStorage.removeItem('tenantId');
              try { cookies.remove('tn_tenantId', { path: '/' }); } catch { }
              try { cookies.remove('tenantId', { path: '/' }); } catch { }
            }
          })
          .finally(() => {
            console.log('[Tenant Context] Finished loading tenant');
            setIsLoading(false);
          });
      }
    } else {
      console.log('[Tenant Context] No tenant ID found');
      // If no tenantId is found, stop loading and set tenant to null
      setTenant(null);
      setIsLoading(false);
    }
  }, [pathname]);

  const refreshTenant = async () => {
    const tid = tenant?.id || localStorage.getItem('tenantId');
    if (!tid) return;

    try {
      const endpoint = `/api/v1/tenants/${tid}`;
      const res = await fetch(endpoint);
      if (res.ok) {
        const data = await res.json();
        const active = data.isActive ?? data.is_active ?? true;
        const cleanVal = (val: any) => (val === '[null]' || val === 'null' ? null : val);
        const normalized: Tenant = {
          id: data.id,
          name: data.name,
          code: data.code,
          domain: data.domain,
          subdomain: data.subdomain,
          logo: cleanVal(data.logo),
          primaryColor: cleanVal(data.primary_color || data.primaryColor),
          secondaryColor: cleanVal(data.secondary_color || data.secondaryColor),
          isActive: active,
          createdAt: data.created_at || data.createdAt,
          updatedAt: data.updated_at || data.updatedAt
        };
        setTenant(normalized);
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
  if (context === undefined) {
    throw new Error('useTenant must be used within a TenantProvider');
  }
  return context;
};
