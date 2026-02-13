import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSubjectService } from '@/services/api/subject-service';
import { SubjectCreate, SubjectUpdate } from '@/types/subject';

export const subjectKeys = {
    all: ['subjects'] as const,
    lists: () => [...subjectKeys.all, 'list'] as const,
    details: () => [...subjectKeys.all, 'detail'] as const,
    detail: (id: string) => [...subjectKeys.details(), id] as const,
};

export function useSubjects(activeOnly: boolean = false) {
    const service = useSubjectService();

    return useQuery({
        queryKey: [...subjectKeys.lists(), { activeOnly }],
        queryFn: () => activeOnly ? service.getActiveSubjects() : service.getAllSubjects(),
    });
}

export function useSubject(id: string) {
    const service = useSubjectService();

    return useQuery({
        queryKey: subjectKeys.detail(id),
        queryFn: () => service.getSubjectById(id),
        enabled: !!id,
    });
}

export function useCreateSubject() {
    const service = useSubjectService();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: SubjectCreate) => service.createSubject(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: subjectKeys.lists() });
        },
    });
}

export function useUpdateSubject() {
    const service = useSubjectService();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: SubjectUpdate }) =>
            service.updateSubject(id, data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: subjectKeys.lists() });
            queryClient.invalidateQueries({ queryKey: subjectKeys.detail(variables.id) });
        },
    });
}

export function useDeleteSubject() {
    const service = useSubjectService();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => service.deleteSubject(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: subjectKeys.lists() });
        },
    });
}
