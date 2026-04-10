import { useQuery } from '@tanstack/react-query';
import { useAdminDashboardService, DashboardStats } from '@/services/api/admin-dashboard-service';
import { useTenant } from '@/hooks/use-tenant';

export const dashboardKeys = {
    all: ['dashboard'] as const,
    stats: (tenantId: string | null) => [...dashboardKeys.all, 'stats', tenantId] as const,
};

/**
 * Hook to fetch Admin Dashboard statistics.
 * @param options - Query options including refetchInterval for "real-time" updates.
 */
export function useAdminDashboardStats(options?: { refetchInterval?: number | false }) {
    const service = useAdminDashboardService();
    const { tenantKey } = useTenant();

    return useQuery({
        queryKey: dashboardKeys.stats(tenantKey),
        queryFn: () => service.getDashboardStats(),
        ...options,
    });
}
