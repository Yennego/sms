import { useQuery } from '@tanstack/react-query';
import { useAcademicDashboardService } from '@/services/api/academic-dashboard-service';
import { useAcademicSetupService } from '@/services/api/academic-setup-service';

export const academicKeys = {
    all: ['academics'] as const,
    stats: () => [...academicKeys.all, 'stats'] as const,
    setupStatus: () => [...academicKeys.all, 'setup-status'] as const,
};

export function useAcademicStats() {
    const service = useAcademicDashboardService();

    return useQuery({
        queryKey: academicKeys.stats(),
        queryFn: () => service.getStats(),
        // We can add specific overrides here if needed
    });
}

export function useAcademicSetupStatus() {
    const service = useAcademicSetupService();

    return useQuery({
        queryKey: academicKeys.setupStatus(),
        queryFn: () => service.getSetupStatus(),
    });
}
