import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApiClient } from '@/services/api/api-client';
import { RolePermissionService, Role, Permission, RoleCreate, RoleUpdate } from '@/services/api/role-permission-service';
import { useMemo } from 'react';

export const roleKeys = {
    all: ['roles'] as const,
    lists: () => [...roleKeys.all, 'list'] as const,
    list: () => [...roleKeys.lists()] as const,
    detail: (id: string) => [...roleKeys.all, 'detail', id] as const,
    rolePermissions: (roleId: string) => [...roleKeys.all, 'permissions', roleId] as const,
    userRoles: (userId: string) => ['userRoles', userId] as const,
};

export const permissionKeys = {
    all: ['permissions'] as const,
    lists: () => [...permissionKeys.all, 'list'] as const,
    list: () => [...permissionKeys.lists()] as const,
};

// Hook factory for service initialization
function useRolePermissionService() {
    const apiClient = useApiClient();
    return useMemo(() => apiClient ? new RolePermissionService(apiClient) : null, [apiClient]);
}

// ============== ROLE HOOKS ==============

export function useRoles() {
    const service = useRolePermissionService();

    return useQuery({
        queryKey: roleKeys.list(),
        queryFn: () => service!.getRoles(),
        enabled: !!service,
    });
}

export function useCreateRole() {
    const service = useRolePermissionService();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: RoleCreate) => service!.createRole(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: roleKeys.all });
        },
    });
}

export function useUpdateRole() {
    const service = useRolePermissionService();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: RoleUpdate }) => service!.updateRole(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: roleKeys.all });
        },
    });
}

export function useDeleteRole() {
    const service = useRolePermissionService();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => service!.deleteRole(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: roleKeys.all });
        },
    });
}

export function useRolePermissions(roleId: string | null) {
    const service = useRolePermissionService();

    return useQuery({
        queryKey: roleKeys.rolePermissions(roleId || ''),
        queryFn: () => service!.getRolePermissions(roleId!),
        enabled: !!service && !!roleId,
    });
}

export function useSetRolePermissions() {
    const service = useRolePermissionService();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ roleId, permissionNames }: { roleId: string; permissionNames: string[] }) =>
            service!.setRolePermissions(roleId, permissionNames),
        onSuccess: (_, { roleId }) => {
            queryClient.invalidateQueries({ queryKey: roleKeys.rolePermissions(roleId) });
            queryClient.invalidateQueries({ queryKey: roleKeys.all });
        },
    });
}

// ============== PERMISSION HOOKS ==============

export function usePermissions() {
    const service = useRolePermissionService();

    return useQuery({
        queryKey: permissionKeys.list(),
        queryFn: () => service!.getPermissions(),
        enabled: !!service,
    });
}

export function useCreatePermission() {
    const service = useRolePermissionService();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: { name: string; description?: string }) => service!.createPermission(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: permissionKeys.all });
        },
    });
}

export function useUpdatePermission() {
    const service = useRolePermissionService();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: { name?: string; description?: string } }) =>
            service!.updatePermission(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: permissionKeys.all });
        },
    });
}

export function useDeletePermission() {
    const service = useRolePermissionService();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => service!.deletePermission(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: permissionKeys.all });
        },
    });
}

// ============== USER ROLE ASSIGNMENT HOOKS ==============

export function useUserRoles(userId: string | null) {
    const service = useRolePermissionService();

    return useQuery({
        queryKey: roleKeys.userRoles(userId || ''),
        queryFn: () => service!.getUserRoles(userId!),
        enabled: !!service && !!userId,
    });
}

export function useAssignRolesToUser() {
    const service = useRolePermissionService();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ userId, roleIds }: { userId: string; roleIds: string[] }) =>
            service!.assignRolesToUser(userId, roleIds),
        onSuccess: (_, { userId }) => {
            queryClient.invalidateQueries({ queryKey: roleKeys.userRoles(userId) });
        },
    });
}

export function useRemoveRoleFromUser() {
    const service = useRolePermissionService();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ userId, roleId }: { userId: string; roleId: string }) =>
            service!.removeRoleFromUser(userId, roleId),
        onSuccess: (_, { userId }) => {
            queryClient.invalidateQueries({ queryKey: roleKeys.userRoles(userId) });
        },
    });
}
