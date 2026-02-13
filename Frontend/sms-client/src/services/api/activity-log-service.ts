import { useApiClientWithLoading, createWaitForApiClientReady } from './api-client';
import { useMemo } from 'react';

export interface ActivityLog {
    id: string;
    user_id: string | null;
    action: string;
    entity_type: string;
    entity_id: string | null;
    old_values: Record<string, any> | null;
    new_values: Record<string, any> | null;
    ip_address: string | null;
    user_agent: string | null;
    created_at: string;
    updated_at: string;
    user?: {
        id: string;
        first_name: string;
        last_name: string;
        email: string;
    };
}

export interface ActivityLogPaginated {
    items: ActivityLog[];
    total: number;
    skip: number;
    limit: number;
    has_next: boolean;
    has_prev: boolean;
}

export function useActivityLogService() {
    const { apiClient, isLoading: apiLoading } = useApiClientWithLoading();
    const waitForApiClientReady = createWaitForApiClientReady(apiClient);

    const service = useMemo(() => ({
        getActivityLogs: async (params?: {
            skip?: number;
            limit?: number;
            user_id?: string;
            entity_type?: string;
            action?: string;
            start_date?: string;
            end_date?: string;
        }) => {
            const client = await waitForApiClientReady();
            const queryParams = new URLSearchParams();

            if (params?.skip !== undefined) queryParams.append('skip', params.skip.toString());
            if (params?.limit !== undefined) queryParams.append('limit', params.limit.toString());
            if (params?.user_id) queryParams.append('user_id', params.user_id);
            if (params?.entity_type) queryParams.append('entity_type', params.entity_type);
            if (params?.action) queryParams.append('action', params.action);
            if (params?.start_date) queryParams.append('start_date', params.start_date);
            if (params?.end_date) queryParams.append('end_date', params.end_date);

            const queryString = queryParams.toString();
            return client.get<ActivityLogPaginated>(`/logging/audit-logs${queryString ? `?${queryString}` : ''}`);
        },

        getSuperAdminLogs: async (params?: {
            skip?: number;
            limit?: number;
            user_id?: string;
            action?: string;
            entity_type?: string;
            target_tenant_id?: string;
            start_date?: string;
            end_date?: string;
        }) => {
            const client = await waitForApiClientReady();
            const queryParams = new URLSearchParams();

            if (params?.skip !== undefined) queryParams.append('skip', params.skip.toString());
            if (params?.limit !== undefined) queryParams.append('limit', params.limit.toString());
            if (params?.user_id) queryParams.append('user_id', params.user_id);
            if (params?.action) queryParams.append('action', params.action);
            if (params?.entity_type) queryParams.append('entity_type', params.entity_type);
            if (params?.target_tenant_id) queryParams.append('target_tenant_id', params.target_tenant_id);
            if (params?.start_date) queryParams.append('start_date', params.start_date);
            if (params?.end_date) queryParams.append('end_date', params.end_date);

            const queryString = queryParams.toString();
            return client.get<ActivityLogPaginated>(`/logging/super-admin/audit-logs${queryString ? `?${queryString}` : ''}`);
        },

        getUserLogs: async (userId: string) => {
            const client = await waitForApiClientReady();
            return client.get<ActivityLog[]>(`/logging/audit-logs/user/${userId}`);
        },

        getEntityLogs: async (entityType: string, entityId: string) => {
            const client = await waitForApiClientReady();
            return client.get<ActivityLog[]>(`/logging/audit-logs/entity/${entityType}/${entityId}`);
        }
    }), [waitForApiClientReady]);

    return service;
}
