import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSemesterService, Semester } from '@/services/api/semester-service';
import { usePeriodService, Period } from '@/services/api/period-service';
import { useTenant } from '@/hooks/use-tenant';

export const structuralKeys = {
    all: (tenantKey: string | null) => ['school-structure', tenantKey] as const,
    semesters: (tenantKey: string | null, academicYearId: string) => [...structuralKeys.all(tenantKey), 'semesters', academicYearId] as const,
    periods: (tenantKey: string | null, semesterId: string) => [...structuralKeys.all(tenantKey), 'periods', semesterId] as const,
};

// --- Semester Hooks ---

export function useSemesters(academicYearId: string | null) {
    const service = useSemesterService();
    const { tenantKey } = useTenant();
    return useQuery({
        queryKey: structuralKeys.semesters(tenantKey, academicYearId || ''),
        queryFn: () => service.getSemesters(academicYearId!),
        enabled: !!academicYearId,
    });
}

export function useCreateSemester() {
    const service = useSemesterService();
    const queryClient = useQueryClient();
    const { tenantKey } = useTenant();

    return useMutation({
        mutationFn: (data: Omit<Semester, 'id' | 'is_published' | 'is_active'>) =>
            service.createSemester(data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: structuralKeys.semesters(tenantKey, variables.academic_year_id) });
        },
    });
}

export function useUpdateSemester() {
    const service = useSemesterService();
    const queryClient = useQueryClient();
    const { tenantKey } = useTenant();

    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: Partial<Semester> }) =>
            service.updateSemester(id, data),
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: structuralKeys.semesters(tenantKey, data.academic_year_id) });
        },
    });
}

export function useDeleteSemester(academicYearId: string) {
    const service = useSemesterService();
    const queryClient = useQueryClient();
    const { tenantKey } = useTenant();

    return useMutation({
        mutationFn: (id: string) => service.removeSemester(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: structuralKeys.semesters(tenantKey, academicYearId) });
        },
    });
}

export function useToggleSemesterPublication() {
    const service = useSemesterService();
    const queryClient = useQueryClient();
    const { tenantKey } = useTenant();

    return useMutation({
        mutationFn: (id: string) => service.togglePublication(id),
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: structuralKeys.semesters(tenantKey, data.academic_year_id) });
        },
    });
}

// --- Period Hooks ---

export function usePeriods(semesterId: string) {
    const service = usePeriodService();
    const { tenantKey } = useTenant();
    return useQuery({
        queryKey: structuralKeys.periods(tenantKey, semesterId),
        queryFn: () => service.getPeriods(semesterId),
        enabled: !!semesterId,
    });
}

export function useCreatePeriod() {
    const service = usePeriodService();
    const queryClient = useQueryClient();
    const { tenantKey } = useTenant();

    return useMutation({
        mutationFn: (data: Omit<Period, 'id' | 'is_published' | 'is_active'>) =>
            service.createPeriod(data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: structuralKeys.periods(tenantKey, variables.semester_id) });
        },
    });
}

export function useUpdatePeriod() {
    const service = usePeriodService();
    const queryClient = useQueryClient();
    const { tenantKey } = useTenant();

    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: Partial<Period> }) =>
            service.updatePeriod(id, data),
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: structuralKeys.periods(tenantKey, data.semester_id) });
        },
    });
}

export function useDeletePeriod(semesterId: string) {
    const service = usePeriodService();
    const queryClient = useQueryClient();
    const { tenantKey } = useTenant();

    return useMutation({
        mutationFn: (id: string) => service.removePeriod(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: structuralKeys.periods(tenantKey, semesterId) });
        },
    });
}

export function useTogglePeriodPublication(semesterId: string) {
    const service = usePeriodService();
    const queryClient = useQueryClient();
    const { tenantKey } = useTenant();

    return useMutation({
        mutationFn: (id: string) => service.togglePublication(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: structuralKeys.periods(tenantKey, semesterId) });
        },
    });
}
