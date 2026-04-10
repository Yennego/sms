import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEnrollmentService } from '@/services/api/enrollment-service';
import { EnrollmentFilters, EnrollmentCreate } from '@/types/enrollment';
import { useTenant } from '@/hooks/use-tenant';

export const enrollmentKeys = {
    all: (tenantKey: string | null) => ['enrollments', tenantKey] as const,
    lists: (tenantKey: string | null) => [...enrollmentKeys.all(tenantKey), 'list'] as const,
    list: (tenantKey: string | null, skip: number, limit: number, filters: EnrollmentFilters) => [...enrollmentKeys.lists(tenantKey), { skip, limit, ...filters }] as const,
    details: (tenantKey: string | null) => [...enrollmentKeys.all(tenantKey), 'detail'] as const,
    detail: (tenantKey: string | null, id: string) => [...enrollmentKeys.details(tenantKey), id] as const,
    current: (tenantKey: string | null, studentId: string) => [...enrollmentKeys.all(tenantKey), 'current', studentId] as const,
    bulkCurrent: (tenantKey: string | null, studentIds: string[]) => [...enrollmentKeys.all(tenantKey), 'bulk-current', studentIds] as const,
    academicYears: (tenantKey: string | null) => [...enrollmentKeys.all(tenantKey), 'academic-years'] as const,
    grades: (tenantKey: string | null) => [...enrollmentKeys.all(tenantKey), 'grades'] as const,
    sections: (tenantKey: string | null) => [...enrollmentKeys.all(tenantKey), 'sections'] as const,
};

export function useEnrollments(skip: number = 0, limit: number = 10, filters?: EnrollmentFilters) {
    const service = useEnrollmentService();
    const { tenantKey } = useTenant();

    return useQuery({
        queryKey: enrollmentKeys.list(tenantKey, skip, limit, filters || {}),
        queryFn: () => service.getEnrollments(skip, limit, filters),
    });
}

export function useCurrentEnrollment(studentId: string) {
    const service = useEnrollmentService();
    const { tenantKey } = useTenant();

    return useQuery({
        queryKey: enrollmentKeys.current(tenantKey, studentId),
        queryFn: () => service.getCurrentEnrollment(studentId),
        enabled: !!studentId,
    });
}

export function useBulkCurrentEnrollments(studentIds: string[]) {
    const service = useEnrollmentService();
    const { tenantKey } = useTenant();

    return useQuery({
        queryKey: enrollmentKeys.bulkCurrent(tenantKey, studentIds),
        queryFn: () => service.getBulkCurrentEnrollments(studentIds),
        enabled: studentIds.length > 0,
    });
}

export function useEnrollmentGrades() {
    const service = useEnrollmentService();
    const { tenantKey } = useTenant();

    return useQuery({
        queryKey: enrollmentKeys.grades(tenantKey),
        queryFn: () => service.getGrades(),
        staleTime: 30 * 60 * 1000, // Grades are fairly static
    });
}

export function useEnrollmentSections() {
    const service = useEnrollmentService();
    const { tenantKey } = useTenant();

    return useQuery({
        queryKey: enrollmentKeys.sections(tenantKey),
        queryFn: () => service.getSections(),
        staleTime: 30 * 60 * 1000, // Sections are fairly static
    });
}

export function useAcademicYears() {
    const service = useEnrollmentService();
    const { tenantKey } = useTenant();

    return useQuery({
        queryKey: enrollmentKeys.academicYears(tenantKey),
        queryFn: () => service.getAcademicYears(),
        staleTime: 60 * 60 * 1000, // Academic years change once a year
    });
}

export function useCurrentAcademicYear() {
    const service = useEnrollmentService();
    const { tenantKey } = useTenant();

    return useQuery({
        queryKey: [...enrollmentKeys.all(tenantKey), 'current-year'],
        queryFn: () => service.getCurrentAcademicYear(),
        staleTime: 60 * 60 * 1000,
    });
}

export function useDeleteEnrollment() {
    const service = useEnrollmentService();
    const queryClient = useQueryClient();
    const { tenantKey } = useTenant();

    return useMutation({
        mutationFn: (id: string) => service.deleteEnrollment(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: enrollmentKeys.lists(tenantKey) });
        },
    });
}

export function useCreateEnrollment() {
    const service = useEnrollmentService();
    const queryClient = useQueryClient();
    const { tenantKey } = useTenant();

    return useMutation({
        mutationFn: (data: EnrollmentCreate) => service.createEnrollment(data),
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: enrollmentKeys.lists(tenantKey) });
            if (data.student_id) {
                queryClient.invalidateQueries({ queryKey: enrollmentKeys.current(tenantKey, data.student_id) });
            }
        },
    });
}

export function useBulkCreateEnrollments() {
    const service = useEnrollmentService();
    const queryClient = useQueryClient();
    const { tenantKey } = useTenant();

    return useMutation({
        mutationFn: (data: any) => service.bulkCreateEnrollments(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: enrollmentKeys.lists(tenantKey) });
        },
    });
}

export function useUpdateEnrollment() {
    const service = useEnrollmentService();
    const queryClient = useQueryClient();
    const { tenantKey } = useTenant();

    return useMutation({
        mutationFn: ({ id, data }: { id: string, data: any }) => service.updateEnrollment(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: enrollmentKeys.lists(tenantKey) });
        },
    });
}
