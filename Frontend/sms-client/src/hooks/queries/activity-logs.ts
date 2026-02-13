import { useQuery } from '@tanstack/react-query';
import { useActivityLogService } from '@/services/api/activity-log-service';

export function useActivityLogs(params?: {
    page?: number;
    limit?: number;
    user_id?: string;
    entity_type?: string;
    action?: string;
    start_date?: string;
    end_date?: string;
}) {
    const activityLogService = useActivityLogService();
    const skip = params?.page && params?.limit ? (params.page - 1) * params.limit : 0;

    return useQuery({
        queryKey: ['activity-logs', { ...params, skip }],
        queryFn: () => activityLogService.getActivityLogs({
            ...params,
            skip,
        }),
        placeholderData: (previousData) => previousData,
    });
}

export function useSuperAdminActivityLogs(params?: {
    page?: number;
    limit?: number;
    user_id?: string;
    action?: string;
    entity_type?: string;
    target_tenant_id?: string;
    start_date?: string;
    end_date?: string;
}) {
    const activityLogService = useActivityLogService();
    const skip = params?.page && params?.limit ? (params.page - 1) * params.limit : 0;

    return useQuery({
        queryKey: ['activity-logs', 'super-admin', { ...params, skip }],
        queryFn: () => activityLogService.getSuperAdminLogs({
            ...params,
            skip,
        }),
        placeholderData: (previousData) => previousData,
    });
}

export function useUserActivityLogs(userId: string) {
    const activityLogService = useActivityLogService();

    return useQuery({
        queryKey: ['activity-logs', 'user', userId],
        queryFn: () => activityLogService.getUserLogs(userId),
        enabled: !!userId,
    });
}

export function useEntityActivityLogs(entityType: string, entityId: string) {
    const activityLogService = useActivityLogService();

    return useQuery({
        queryKey: ['activity-logs', 'entity', entityType, entityId],
        queryFn: () => activityLogService.getEntityLogs(entityType, entityId),
        enabled: !!entityType && !!entityId,
    });
}
