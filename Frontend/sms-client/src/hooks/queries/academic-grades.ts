import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAcademicGradeService } from '@/services/api/academic-grade-service';
import { AcademicGradeCreate, AcademicGradeUpdate } from '@/types/academic-grade';

export const gradeKeys = {
    all: ['academicGrades'] as const,
    lists: () => [...gradeKeys.all, 'list'] as const,
    list: (activeOnly: boolean) => [...gradeKeys.lists(), { activeOnly }] as const,
    detail: (id: string) => [...gradeKeys.all, 'detail', id] as const,
};

export function useGrades(activeOnly: boolean = false) {
    const service = useAcademicGradeService();

    return useQuery({
        queryKey: gradeKeys.list(activeOnly),
        queryFn: () => activeOnly ? service.getActiveGrades() : service.getAllGrades(),
        placeholderData: (previousData) => previousData,
    });
}

export function useGrade(id: string) {
    const service = useAcademicGradeService();

    return useQuery({
        queryKey: gradeKeys.detail(id),
        queryFn: () => service.getGrades().then(grades => grades.find(g => g.id === id)),
        enabled: !!id,
    });
}

export function useCreateGrade() {
    const service = useAcademicGradeService();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: AcademicGradeCreate) => service.createGrade(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: gradeKeys.all });
        },
    });
}

export function useUpdateGrade() {
    const service = useAcademicGradeService();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: AcademicGradeUpdate }) =>
            service.updateGrade(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: gradeKeys.all });
        },
    });
}

export function useDeleteGrade() {
    const service = useAcademicGradeService();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => service.deleteGrade(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: gradeKeys.all });
        },
    });
}
