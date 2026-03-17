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

export const superAdminKeys = {
    all: ['super-admin'] as const,
    stats: () => [...superAdminKeys.all, 'stats'] as const,
    tenantStats: () => [...superAdminKeys.stats(), 'tenants'] as const,
    userStats: () => [...superAdminKeys.stats(), 'users'] as const,
    systemMetrics: () => [...superAdminKeys.all, 'system-metrics'] as const,
    tenants: (params?: any) => [...superAdminKeys.all, 'tenants', params].filter(Boolean) as string[],
    recentTenants: (limit: number) => [...superAdminKeys.all, 'recent-tenants', limit] as string[],
    users: (params?: any) => [...superAdminKeys.all, 'users', params].filter(Boolean) as string[],
    roles: () => [...superAdminKeys.all, 'roles'] as string[],
    roleStats: () => [...superAdminKeys.all, 'role-stats'] as string[],
    revenueByTenant: () => [...superAdminKeys.all, 'revenue-by-tenant'] as string[],
    auditLogs: (params?: any) => [...superAdminKeys.all, 'audit-logs', params].filter(Boolean) as string[],
    settings: (tenantId: string) => [...superAdminKeys.all, 'tenant-settings', tenantId] as const,
};

// --- Queries ---

export function useSuperAdminTenantStats() {
    const service = useSuperAdminService();
    return useQuery({
        queryKey: superAdminKeys.tenantStats(),
        queryFn: () => service.getTenantStats(),
    });
}

export function useSuperAdminUserStats() {
    const service = useSuperAdminService();
    return useQuery({
        queryKey: superAdminKeys.userStats(),
        queryFn: () => service.getUserStats(),
    });
}

export function useSuperAdminSystemMetrics(options?: { refetchInterval?: number }) {
    const service = useSuperAdminService();
    return useQuery({
        queryKey: superAdminKeys.systemMetrics(),
        queryFn: () => service.getSystemMetrics(),
        refetchInterval: options?.refetchInterval ?? 30000, // Default 30s
    });
}

export function useSuperAdminRecentTenants(limit: number = 5) {
    const service = useSuperAdminService();
    return useQuery({
        queryKey: superAdminKeys.recentTenants(limit),
        queryFn: () => service.getRecentTenants(limit),
    });
}

export function useSuperAdminTenants(params?: { skip?: number; limit?: number }) {
    const service = useSuperAdminService();
    return useQuery({
        queryKey: superAdminKeys.tenants(params),
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
    return useQuery({
        queryKey: superAdminKeys.users(params),
        queryFn: () => service.getUserList(params),
    });
}

export function useSuperAdminRoles() {
    const service = useSuperAdminService();
    return useQuery({
        queryKey: superAdminKeys.roles(),
        queryFn: () => service.getRoles(),
    });
}

export function useSuperAdminRoleStatistics() {
    const service = useSuperAdminService();
    return useQuery({
        queryKey: superAdminKeys.roleStats(),
        queryFn: () => service.getRoleStatistics(),
    });
}

export function useSuperAdminRevenueByTenant() {
    const service = useSuperAdminService();
    return useQuery({
        queryKey: superAdminKeys.revenueByTenant(),
        queryFn: () => service.getRevenueByTenant(),
    });
}

export function useSuperAdminTenantSettings(tenantId: string) {
    const service = useSuperAdminService();
    return useQuery({
        queryKey: superAdminKeys.settings(tenantId),
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
    return useQuery({
        queryKey: superAdminKeys.auditLogs(params),
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
            queryClient.invalidateQueries({ queryKey: superAdminKeys.users() });
            queryClient.invalidateQueries({ queryKey: superAdminKeys.userStats() });
            queryClient.invalidateQueries({ queryKey: superAdminKeys.roleStats() });
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
            queryClient.invalidateQueries({ queryKey: superAdminKeys.users() });
            queryClient.invalidateQueries({ queryKey: superAdminKeys.userStats() });
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
            queryClient.invalidateQueries({ queryKey: superAdminKeys.tenants() });
            queryClient.invalidateQueries({ queryKey: superAdminKeys.tenantStats() });
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
            queryClient.invalidateQueries({ queryKey: superAdminKeys.tenants() });
            queryClient.invalidateQueries({ queryKey: superAdminKeys.tenantStats() });
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
            queryClient.invalidateQueries({ queryKey: superAdminKeys.tenants() });
            queryClient.invalidateQueries({ queryKey: superAdminKeys.tenantStats() });
            queryClient.invalidateQueries({ queryKey: superAdminKeys.systemMetrics() });
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
            queryClient.invalidateQueries({ queryKey: superAdminKeys.settings(variables.tenantId) });
        },
    });
}
