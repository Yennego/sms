import { useQuery } from '@tanstack/react-query';
import { useAcademicDashboardService } from '@/services/api/academic-dashboard-service';
import { useAcademicSetupService } from '@/services/api/academic-setup-service';
import { useTenant } from '@/hooks/use-tenant';

export const academicKeys = {
    all: (tenantKey: string | null) => ['academics', tenantKey] as const,
    stats: (tenantKey: string | null) => [...academicKeys.all(tenantKey), 'stats'] as const,
    setupStatus: (tenantKey: string | null) => [...academicKeys.all(tenantKey), 'setup-status'] as const,
};

export function useAcademicStats() {
    const service = useAcademicDashboardService();
    const { tenantKey } = useTenant();

    return useQuery({
        queryKey: academicKeys.stats(tenantKey),
        queryFn: () => service.getStats(),
        // We can add specific overrides here if needed
    });
}

export function useAcademicSetupStatus() {
    const service = useAcademicSetupService();
    const { tenantKey } = useTenant();

    return useQuery({
        queryKey: academicKeys.setupStatus(tenantKey),
        queryFn: () => service.getSetupStatus(),
    });
}
