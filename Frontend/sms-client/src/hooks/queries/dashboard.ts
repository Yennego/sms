import { useQuery } from '@tanstack/react-query';
import { useAdminDashboardService, DashboardStats } from '@/services/api/admin-dashboard-service';

export const dashboardKeys = {
    all: ['dashboard'] as const,
    stats: () => [...dashboardKeys.all, 'stats'] as const,
};

/**
 * Hook to fetch Admin Dashboard statistics.
 * @param options - Query options including refetchInterval for "real-time" updates.
 */
export function useAdminDashboardStats(options?: { refetchInterval?: number | false }) {
    const service = useAdminDashboardService();

    return useQuery({
        queryKey: dashboardKeys.stats(),
        queryFn: () => service.getDashboardStats(),
        ...options,
    });
}
