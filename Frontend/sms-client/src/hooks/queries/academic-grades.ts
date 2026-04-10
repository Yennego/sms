import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAcademicGradeService } from '@/services/api/academic-grade-service';
import { AcademicGradeCreate, AcademicGradeUpdate } from '@/types/academic-grade';
import { useTenant } from '@/hooks/use-tenant';

export const gradeKeys = {
    all: (tenantKey: string | null) => ['academicGrades', tenantKey] as const,
    lists: (tenantKey: string | null) => [...gradeKeys.all(tenantKey), 'list'] as const,
    list: (tenantKey: string | null, activeOnly: boolean) => [...gradeKeys.lists(tenantKey), { activeOnly }] as const,
    detail: (tenantKey: string | null, id: string) => [...gradeKeys.all(tenantKey), 'detail', id] as const,
};

export function useGrades(activeOnly: boolean = false) {
    const service = useAcademicGradeService();
    const { tenantKey } = useTenant();

    return useQuery({
        queryKey: gradeKeys.list(tenantKey, activeOnly),
        queryFn: () => activeOnly ? service.getActiveGrades() : service.getAllGrades(),
        placeholderData: (previousData) => previousData,
    });
}

export function useGrade(id: string) {
    const service = useAcademicGradeService();
    const { tenantKey } = useTenant();

    return useQuery({
        queryKey: gradeKeys.detail(tenantKey, id),
        queryFn: () => service.getGrades().then(grades => grades.find(g => g.id === id)),
        enabled: !!id,
    });
}

export function useCreateGrade() {
    const service = useAcademicGradeService();
    const queryClient = useQueryClient();
    const { tenantKey } = useTenant();

    return useMutation({
        mutationFn: (data: AcademicGradeCreate) => service.createGrade(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: gradeKeys.all(tenantKey) });
        },
    });
}

export function useUpdateGrade() {
    const service = useAcademicGradeService();
    const queryClient = useQueryClient();
    const { tenantKey } = useTenant();

    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: AcademicGradeUpdate }) =>
            service.updateGrade(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: gradeKeys.all(tenantKey) });
        },
    });
}

export function useDeleteGrade() {
    const service = useAcademicGradeService();
    const queryClient = useQueryClient();
    const { tenantKey } = useTenant();

    return useMutation({
        mutationFn: (id: string) => service.deleteGrade(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: gradeKeys.all(tenantKey) });
        },
    });
}
