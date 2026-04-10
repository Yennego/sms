import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApiClient } from '@/services/api/api-client';
import { RolePermissionService, Role, Permission, RoleCreate, RoleUpdate } from '@/services/api/role-permission-service';
import { useMemo } from 'react';
import { useTenant } from '@/hooks/use-tenant';

export const roleKeys = {
    all: (tenantKey: string | null) => ['roles', tenantKey] as const,
    lists: (tenantKey: string | null) => [...roleKeys.all(tenantKey), 'list'] as const,
    list: (tenantKey: string | null) => [...roleKeys.lists(tenantKey)] as const,
    detail: (tenantKey: string | null, id: string) => [...roleKeys.all(tenantKey), 'detail', id] as const,
    rolePermissions: (tenantKey: string | null, roleId: string) => [...roleKeys.all(tenantKey), 'permissions', roleId] as const,
    userRoles: (tenantKey: string | null, userId: string) => ['userRoles', tenantKey, userId] as const,
};

export const permissionKeys = {
    all: (tenantKey: string | null) => ['permissions', tenantKey] as const,
    lists: (tenantKey: string | null) => [...permissionKeys.all(tenantKey), 'list'] as const,
    list: (tenantKey: string | null) => [...permissionKeys.lists(tenantKey)] as const,
};

// Hook factory for service initialization
function useRolePermissionService() {
    const apiClient = useApiClient();
    return useMemo(() => apiClient ? new RolePermissionService(apiClient) : null, [apiClient]);
}

// ============== ROLE HOOKS ==============

export function useRoles() {
    const service = useRolePermissionService();
    const { tenantKey } = useTenant();

    return useQuery({
        queryKey: roleKeys.list(tenantKey),
        queryFn: () => service!.getRoles(),
        enabled: !!service,
    });
}

export function useCreateRole() {
    const service = useRolePermissionService();
    const queryClient = useQueryClient();
    const { tenantKey } = useTenant();

    return useMutation({
        mutationFn: (data: RoleCreate) => service!.createRole(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: roleKeys.all(tenantKey) });
        },
    });
}

export function useUpdateRole() {
    const service = useRolePermissionService();
    const queryClient = useQueryClient();
    const { tenantKey } = useTenant();

    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: RoleUpdate }) => service!.updateRole(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: roleKeys.all(tenantKey) });
        },
    });
}

export function useDeleteRole() {
    const service = useRolePermissionService();
    const queryClient = useQueryClient();
    const { tenantKey } = useTenant();

    return useMutation({
        mutationFn: (id: string) => service!.deleteRole(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: roleKeys.all(tenantKey) });
        },
    });
}

export function useRolePermissions(roleId: string | null) {
    const service = useRolePermissionService();
    const { tenantKey } = useTenant();

    return useQuery({
        queryKey: roleKeys.rolePermissions(tenantKey, roleId || ''),
        queryFn: () => service!.getRolePermissions(roleId!),
        enabled: !!service && !!roleId,
    });
}

export function useSetRolePermissions() {
    const service = useRolePermissionService();
    const queryClient = useQueryClient();
    const { tenantKey } = useTenant();

    return useMutation({
        mutationFn: ({ roleId, permissionNames }: { roleId: string; permissionNames: string[] }) =>
            service!.setRolePermissions(roleId, permissionNames),
        onSuccess: (_, { roleId }) => {
            queryClient.invalidateQueries({ queryKey: roleKeys.rolePermissions(tenantKey, roleId) });
            queryClient.invalidateQueries({ queryKey: roleKeys.all(tenantKey) });
        },
    });
}

// ============== PERMISSION HOOKS ==============

export function usePermissions() {
    const service = useRolePermissionService();
    const { tenantKey } = useTenant();

    return useQuery({
        queryKey: permissionKeys.list(tenantKey),
        queryFn: () => service!.getPermissions(),
        enabled: !!service,
    });
}

export function useCreatePermission() {
    const service = useRolePermissionService();
    const queryClient = useQueryClient();
    const { tenantKey } = useTenant();

    return useMutation({
        mutationFn: (data: { name: string; description?: string }) => service!.createPermission(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: permissionKeys.all(tenantKey) });
        },
    });
}

export function useUpdatePermission() {
    const service = useRolePermissionService();
    const queryClient = useQueryClient();
    const { tenantKey } = useTenant();

    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: { name?: string; description?: string } }) =>
            service!.updatePermission(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: permissionKeys.all(tenantKey) });
        },
    });
}

export function useDeletePermission() {
    const service = useRolePermissionService();
    const queryClient = useQueryClient();
    const { tenantKey } = useTenant();

    return useMutation({
        mutationFn: (id: string) => service!.deletePermission(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: permissionKeys.all(tenantKey) });
        },
    });
}

// ============== USER ROLE ASSIGNMENT HOOKS ==============

export function useUserRoles(userId: string | null) {
    const service = useRolePermissionService();
    const { tenantKey } = useTenant();

    return useQuery({
        queryKey: roleKeys.userRoles(tenantKey, userId || ''),
        queryFn: () => service!.getUserRoles(userId!),
        enabled: !!service && !!userId,
    });
}

export function useAssignRolesToUser() {
    const service = useRolePermissionService();
    const queryClient = useQueryClient();
    const { tenantKey } = useTenant();

    return useMutation({
        mutationFn: ({ userId, roleIds }: { userId: string; roleIds: string[] }) =>
            service!.assignRolesToUser(userId, roleIds),
        onSuccess: (_, { userId }) => {
            queryClient.invalidateQueries({ queryKey: roleKeys.userRoles(tenantKey, userId) });
        },
    });
}

export function useRemoveRoleFromUser() {
    const service = useRolePermissionService();
    const queryClient = useQueryClient();
    const { tenantKey } = useTenant();

    return useMutation({
        mutationFn: ({ userId, roleId }: { userId: string; roleId: string }) =>
            service!.removeRoleFromUser(userId, roleId),
        onSuccess: (_, { userId }) => {
            queryClient.invalidateQueries({ queryKey: roleKeys.userRoles(tenantKey, userId) });
        },
    });
}
