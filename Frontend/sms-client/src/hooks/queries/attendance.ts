import { useQuery } from '@tanstack/react-query';
import { useAttendanceService } from '@/services/api/attendance-service';
import { useTenant } from '@/hooks/use-tenant';

export const attendanceKeys = {
    all: ['attendance'] as const,
    summary: (filters: any) => [...attendanceKeys.all, 'summary', filters] as const,
    records: (filters: any) => [...attendanceKeys.all, 'records', filters] as const,
};

export function useAttendanceSummary(filters: {
    student_id?: string;
    class_id?: string;
    start_date?: string;
    end_date?: string;
}) {
    const service = useAttendanceService();
    const { tenantKey } = useTenant();

    return useQuery({
        queryKey: [...attendanceKeys.summary(filters), tenantKey],
        queryFn: () => service.getAttendanceSummary(filters),
        enabled: !!filters,
    });
}
