import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    useSuperAdminService,
    TenantStats,
    UserStats,
    SystemMetrics,
    RecentTenant,
    UserWithRoles,
    Role,
    RoleStats,
    PaginatedResponse,
    AuditLog,
    UserCreateCrossTenant,
    UserUpdate,
    RevenueStats,
    TenantSubscriptionUpdate,
    TenantSettings,
    TenantSettingsUpdate
} from '@/services/api/super-admin-service';
import { useTenant } from '@/hooks/use-tenant';

export const superAdminKeys = {
    all: (tenantKey: string | null) => ['super-admin', tenantKey] as const,
    stats: (tenantKey: string | null) => [...superAdminKeys.all(tenantKey), 'stats'] as const,
    tenantStats: (tenantKey: string | null) => [...superAdminKeys.stats(tenantKey), 'tenants'] as const,
    userStats: (tenantKey: string | null) => [...superAdminKeys.stats(tenantKey), 'users'] as const,
    systemMetrics: (tenantKey: string | null) => [...superAdminKeys.all(tenantKey), 'system-metrics'] as const,
    tenants: (tenantKey: string | null, params?: any) => [...superAdminKeys.all(tenantKey), 'tenants', params].filter(Boolean) as string[],
    recentTenants: (tenantKey: string | null, limit: number) => [...superAdminKeys.all(tenantKey), 'recent-tenants', limit] as string[],
    users: (tenantKey: string | null, params?: any) => [...superAdminKeys.all(tenantKey), 'users', params].filter(Boolean) as string[],
    roles: (tenantKey: string | null) => [...superAdminKeys.all(tenantKey), 'roles'] as string[],
    roleStats: (tenantKey: string | null) => [...superAdminKeys.all(tenantKey), 'role-stats'] as string[],
    revenueByTenant: (tenantKey: string | null) => [...superAdminKeys.all(tenantKey), 'revenue-by-tenant'] as string[],
    auditLogs: (tenantKey: string | null, params?: any) => [...superAdminKeys.all(tenantKey), 'audit-logs', params].filter(Boolean) as string[],
    settings: (tenantKey: string | null, tenantId: string) => [...superAdminKeys.all(tenantKey), 'tenant-settings', tenantId] as const,
};

// --- Queries ---

export function useSuperAdminTenantStats() {
    const service = useSuperAdminService();
    const { tenantKey } = useTenant();
    return useQuery({
        queryKey: superAdminKeys.tenantStats(tenantKey),
        queryFn: () => service.getTenantStats(),
    });
}

export function useSuperAdminUserStats() {
    const service = useSuperAdminService();
    const { tenantKey } = useTenant();
    return useQuery({
        queryKey: superAdminKeys.userStats(tenantKey),
        queryFn: () => service.getUserStats(),
    });
}

export function useSuperAdminSystemMetrics(options?: { refetchInterval?: number }) {
    const service = useSuperAdminService();
    const { tenantKey } = useTenant();
    return useQuery({
        queryKey: superAdminKeys.systemMetrics(tenantKey),
        queryFn: () => service.getSystemMetrics(),
        refetchInterval: options?.refetchInterval ?? 30000, // Default 30s
    });
}

export function useSuperAdminRecentTenants(limit: number = 5) {
    const service = useSuperAdminService();
    const { tenantKey } = useTenant();
    return useQuery({
        queryKey: superAdminKeys.recentTenants(tenantKey, limit),
        queryFn: () => service.getRecentTenants(limit),
    });
}

export function useSuperAdminTenants(params?: { skip?: number; limit?: number }) {
    const service = useSuperAdminService();
    const { tenantKey } = useTenant();
    return useQuery({
        queryKey: superAdminKeys.tenants(tenantKey, params),
        queryFn: () => service.getTenants(params),
    });
}

export function useSuperAdminUserList(params?: {
    skip?: number;
    limit?: number;
    email?: string;
    is_active?: boolean;
    tenant_id?: string;
    sort_by?: string;
    sort_order?: 'asc' | 'desc';
}) {
    const service = useSuperAdminService();
    const { tenantKey } = useTenant();
    return useQuery({
        queryKey: superAdminKeys.users(tenantKey, params),
        queryFn: () => service.getUserList(params),
    });
}

export function useSuperAdminRoles() {
    const service = useSuperAdminService();
    const { tenantKey } = useTenant();
    return useQuery({
        queryKey: superAdminKeys.roles(tenantKey),
        queryFn: () => service.getRoles(),
    });
}

export function useSuperAdminRoleStatistics() {
    const service = useSuperAdminService();
    const { tenantKey } = useTenant();
    return useQuery({
        queryKey: superAdminKeys.roleStats(tenantKey),
        queryFn: () => service.getRoleStatistics(),
    });
}

export function useSuperAdminRevenueByTenant() {
    const service = useSuperAdminService();
    const { tenantKey } = useTenant();
    return useQuery({
        queryKey: superAdminKeys.revenueByTenant(tenantKey),
        queryFn: () => service.getRevenueByTenant(),
    });
}

export function useSuperAdminTenantSettings(tenantId: string) {
    const service = useSuperAdminService();
    const { tenantKey } = useTenant();
    return useQuery({
        queryKey: superAdminKeys.settings(tenantKey, tenantId),
        queryFn: () => service.getTenantSettings(tenantId),
        enabled: !!tenantId,
    });
}

export function useSuperAdminAuditLogs(params?: {
    skip?: number;
    limit?: number;
    user_id?: string;
    entity_type?: string;
    entity_id?: string;
    action?: string;
    tenant_id?: string;
    start_date?: string;
    end_date?: string;
}) {
    const service = useSuperAdminService();
    const { tenantKey } = useTenant();
    return useQuery({
        queryKey: superAdminKeys.auditLogs(tenantKey, params),
        queryFn: () => service.getAuditLogs(params),
    });
}

// --- Mutations ---

export function useSuperAdminCreateUser() {
    const service = useSuperAdminService();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (userData: UserCreateCrossTenant) => service.createUserCrossTenant(userData),
        onSuccess: () => {
            const tenantKey = null; // We don't have it easily here without a hook, but invalidate all is safer
            queryClient.invalidateQueries({ queryKey: ['super-admin'] }); // Global invalidate
        },
    });
}

export function useSuperAdminUpdateUser() {
    const service = useSuperAdminService();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ userId, userData, tenantId }: { userId: string; userData: UserUpdate; tenantId?: string }) =>
            service.updateUser(userId, userData, tenantId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['super-admin'] });
        },
    });
}

export function useSuperAdminActivateTenant() {
    const service = useSuperAdminService();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (tenantId: string) => {
            return service.activateTenant ? service.activateTenant(tenantId) : Promise.resolve();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['super-admin'] });
        },
    });
}

export function useSuperAdminDeactivateTenant() {
    const service = useSuperAdminService();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (tenantId: string) => {
            return service.deactivateTenant ? service.deactivateTenant(tenantId) : Promise.resolve();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['super-admin'] });
        },
    });
}

export function useSuperAdminUpdateSubscription() {
    const service = useSuperAdminService();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ tenantId, subscriptionData }: { tenantId: string; subscriptionData: TenantSubscriptionUpdate }) =>
            service.updateTenantSubscription(tenantId, subscriptionData),
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: ['super-admin'] });
        },
    });
}

export function useSuperAdminUpdateTenantSettings() {
    const service = useSuperAdminService();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ tenantId, settings }: { tenantId: string; settings: TenantSettingsUpdate }) =>
            service.updateTenantSettings(tenantId, settings),
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: ['super-admin'] }); // Simplest to invalidate all
        },
    });
}
