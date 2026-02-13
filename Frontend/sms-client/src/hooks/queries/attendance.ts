import { useQuery } from '@tanstack/react-query';
import { useAttendanceService } from '@/services/api/attendance-service';

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

    return useQuery({
        queryKey: attendanceKeys.summary(filters),
        queryFn: () => service.getAttendanceSummary(filters),
        enabled: !!filters,
    });
}
