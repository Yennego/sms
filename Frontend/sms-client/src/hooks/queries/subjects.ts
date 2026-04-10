import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSubjectService } from '@/services/api/subject-service';
import { SubjectCreate, SubjectUpdate } from '@/types/subject';
import { useTenant } from '@/hooks/use-tenant';

export const subjectKeys = {
    all: (tenantKey: string | null) => ['subjects', tenantKey] as const,
    lists: (tenantKey: string | null) => [...subjectKeys.all(tenantKey), 'list'] as const,
    details: (tenantKey: string | null) => [...subjectKeys.all(tenantKey), 'detail'] as const,
    detail: (tenantKey: string | null, id: string) => [...subjectKeys.details(tenantKey), id] as const,
};

export function useSubjects(activeOnly: boolean = false) {
    const service = useSubjectService();
    const { tenantKey } = useTenant();

    return useQuery({
        queryKey: [...subjectKeys.lists(tenantKey), { activeOnly }],
        queryFn: () => activeOnly ? service.getActiveSubjects() : service.getAllSubjects(),
    });
}

export function useSubject(id: string) {
    const service = useSubjectService();
    const { tenantKey } = useTenant();

    return useQuery({
        queryKey: subjectKeys.detail(tenantKey, id),
        queryFn: () => service.getSubjectById(id),
        enabled: !!id,
    });
}

export function useCreateSubject() {
    const service = useSubjectService();
    const queryClient = useQueryClient();
    const { tenantKey } = useTenant();

    return useMutation({
        mutationFn: (data: SubjectCreate) => service.createSubject(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: subjectKeys.lists(tenantKey) });
        },
    });
}

export function useUpdateSubject() {
    const service = useSubjectService();
    const queryClient = useQueryClient();
    const { tenantKey } = useTenant();

    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: SubjectUpdate }) =>
            service.updateSubject(id, data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: subjectKeys.lists(tenantKey) });
            queryClient.invalidateQueries({ queryKey: subjectKeys.detail(tenantKey, variables.id) });
        },
    });
}

export function useDeleteSubject() {
    const service = useSubjectService();
    const queryClient = useQueryClient();
    const { tenantKey } = useTenant();

    return useMutation({
        mutationFn: (id: string) => service.deleteSubject(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: subjectKeys.lists(tenantKey) });
        },
    });
}
