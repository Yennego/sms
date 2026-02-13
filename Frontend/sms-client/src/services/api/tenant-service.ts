import { useApiClient } from './api-client';
import { useSuperAdminApiClient } from './super-admin-api-client';
import { Tenant, TenantCreate, TenantUpdate, TenantCreateWithAdmin, TenantCreateResponse } from '@/types/tenant';
import { useTenant } from '@/hooks/use-tenant';

// Add the PaginatedResponse interface
interface PaginatedResponse<T> {
  items: T[];
  total: number;
  skip: number;
  limit: number;
  has_next: boolean;
  has_prev: boolean;
}

// Interface for raw tenant data from API
interface RawTenantData {
  id: string;
  name: string;
  code: string;
  domain: string;
  subdomain: string;
  logo: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Create a module-level cache and debounce tracking
// Update cache structure to support pagination
let lastFetchTimestamp = 0;
let pendingPromise: Promise<Tenant[]> | null = null;
let cachedTenants: { [key: string]: { data: PaginatedResponse<Tenant> | Tenant[], timestamp: number } } | null = null;
const DEBOUNCE_INTERVAL = 2000; // 2 seconds
const CACHE_TTL = 10000; // 10 seconds


export function useTenantService() {
  const { tenantId } = useTenant();
  const superAdminApiClient = useSuperAdminApiClient(tenantId || undefined);
  const apiClient = useApiClient();

  return {
    // Backward compatible method that handles both response formats
    getTenants: async (skip: number = 0, limit: number = 10): Promise<PaginatedResponse<Tenant>> => {
      const cacheKey = `tenants_${skip}_${limit}`;
      const now = Date.now();

      // Check cache
      if (cachedTenants && cachedTenants[cacheKey] && (now - cachedTenants[cacheKey].timestamp < CACHE_TTL)) {
        console.log('Using cached tenant data');
        return cachedTenants[cacheKey].data as PaginatedResponse<Tenant>;
      }

      const endpoint = `/super-admin/tenants?skip=${skip}&limit=${limit}`;
      console.log('Fetching tenants from endpoint:', endpoint);

      try {
        const response = await superAdminApiClient.get<PaginatedResponse<RawTenantData> | RawTenantData[]>(endpoint);

        let result: PaginatedResponse<Tenant>;

        // Check if response is paginated or just an array
        if (Array.isArray(response)) {
          // Handle legacy array response
          const tenants: Tenant[] = response.map((t: RawTenantData) => ({
            id: t.id,
            name: t.name,
            code: t.code,
            domain: t.domain,
            subdomain: t.subdomain,
            logo: t.logo,
            isActive: t.is_active,
            createdAt: t.created_at,
            updatedAt: t.updated_at,
          }));

          // Create paginated response from array
          result = {
            items: tenants.slice(skip, skip + limit),
            total: tenants.length,
            skip: skip,
            limit: limit,
            has_next: skip + limit < tenants.length,
            has_prev: skip > 0
          };
        } else {
          // Handle new paginated response
          const tenants: Tenant[] = response.items.map((t: RawTenantData) => ({
            id: t.id,
            name: t.name,
            code: t.code,
            domain: t.domain,
            subdomain: t.subdomain,
            logo: t.logo,
            isActive: t.is_active,
            createdAt: t.created_at,
            updatedAt: t.updated_at,
          }));

          result = {
            items: tenants,
            total: response.total,
            skip: response.skip,
            limit: response.limit,
            has_next: response.has_next,
            has_prev: response.has_prev
          };
        }

        // Update cache
        if (!cachedTenants) cachedTenants = {};
        cachedTenants[cacheKey] = {
          data: result,
          timestamp: Date.now()
        };

        return result;
      } catch (error) {
        console.error('Error fetching tenants:', error);
        throw error;
      }
    },

    // Keep the original method for backward compatibility
    getAllTenants: async (): Promise<Tenant[]> => {
      const now = Date.now();

      if (cachedTenants && cachedTenants.all && (now - cachedTenants.all.timestamp < CACHE_TTL)) {
        console.log('Using cached tenant data');
        return cachedTenants.all.data as Tenant[];
      }

      if (pendingPromise && (now - lastFetchTimestamp < DEBOUNCE_INTERVAL)) {
        console.log('Reusing pending tenant fetch request');
        return pendingPromise;
      }

      lastFetchTimestamp = now;
      const endpoint = `/super-admin/tenants`;
      console.log('Fetching tenants from endpoint:', endpoint);

      pendingPromise = superAdminApiClient.get<PaginatedResponse<RawTenantData> | RawTenantData[]>(endpoint)
        .then(response => {
          let rawData: RawTenantData[];

          // Handle both response formats
          if (Array.isArray(response)) {
            rawData = response;
          } else {
            rawData = response.items;
          }

          const tenants: Tenant[] = rawData.map((t: RawTenantData) => ({
            id: t.id,
            name: t.name,
            code: t.code,
            domain: t.domain,
            subdomain: t.subdomain,
            logo: t.logo,
            isActive: t.is_active,
            createdAt: t.created_at,
            updatedAt: t.updated_at,
          }));

          if (!cachedTenants) cachedTenants = {};
          cachedTenants.all = {
            data: tenants,
            timestamp: Date.now()
          };

          return tenants;
        })
        .finally(() => {
          setTimeout(() => {
            pendingPromise = null;
          }, DEBOUNCE_INTERVAL);
        });

      return pendingPromise;
    },

    getTenantById: async (id: string) => {
      return apiClient.get<Tenant>(`/super-admin/tenants/${id}`);
    },

    createTenant: async (tenant: TenantCreate) => {
      const result = await superAdminApiClient.post<Tenant>('/super-admin/tenants', tenant);
      // Invalidate cache after mutation
      cachedTenants = null;
      return result;
    },

    createTenantWithAdmin: async (tenantData: TenantCreateWithAdmin) => {
      const result = await superAdminApiClient.post<TenantCreateResponse>('/super-admin/tenants/with-admin', tenantData);
      // Invalidate cache after mutation
      cachedTenants = null;
      return result;
    },

    updateTenant: async (id: string, tenant: TenantUpdate) => {
      const result = await superAdminApiClient.put<Tenant>(`/super-admin/tenants/${id}`, tenant);
      // Invalidate cache after mutation
      cachedTenants = null;
      return result;
    },

    /**
     * Update tenant settings (for tenant admins updating their own tenant)
     * Uses the regular /tenants endpoint which requires admin role, not super-admin
     */
    updateOwnTenant: async (tenant: TenantUpdate) => {
      // Map camelCase to snake_case for API
      const payload = {
        name: tenant.name,
        domain: tenant.domain,
        subdomain: tenant.subdomain,
        logo: tenant.logo,
        primary_color: tenant.primaryColor,
        secondary_color: tenant.secondaryColor,
        is_active: tenant.isActive,
      };
      const result = await apiClient.put<RawTenantData>(`/tenants/self`, payload);
      // Map response back to Tenant type
      return {
        id: result.id,
        name: result.name,
        code: result.code,
        domain: result.domain,
        subdomain: result.subdomain,
        logo: result.logo,
        isActive: result.is_active,
        createdAt: result.created_at,
        updatedAt: result.updated_at,
      } as Tenant;
    },

    activateTenant: async (id: string) => {
      try {
        const result = await superAdminApiClient.put<Tenant>(`/super-admin/tenants/${id}/activate`, {});
        // Only clear cache after successful operation
        cachedTenants = null;
        pendingPromise = null;
        return result;
      } catch (error) {
        console.error('Activation error:', error);
        throw error;
      }
    },

    deactivateTenant: async (id: string) => {
      try {
        const result = await superAdminApiClient.put<Tenant>(`/super-admin/tenants/${id}/deactivate`, {});
        // Only clear cache after successful operation
        cachedTenants = null;
        pendingPromise = null;
        return result;
      } catch (error) {
        console.error('Deactivation error:', error);
        throw error;
      }
    },

    deleteTenant: async (id: string) => {
      const result = await superAdminApiClient.delete<void>(`/super-admin/tenants/${id}`);
      // Invalidate cache after mutation
      cachedTenants = null;
      return result;
    }
  };
}
