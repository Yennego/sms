import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAssessmentService, AssessmentCreate, AssessmentUpdate, AssessmentFilters } from '@/services/api/assessment-service';
import { useTenant } from '@/hooks/use-tenant';

export const assessmentKeys = {
    all: (tenantKey: string | null) => ['assessments', tenantKey] as const,
    lists: (tenantKey: string | null) => [...assessmentKeys.all(tenantKey), 'list'] as const,
    list: (tenantKey: string | null, filters: AssessmentFilters) => [...assessmentKeys.lists(tenantKey), filters] as const,
    details: (tenantKey: string | null) => [...assessmentKeys.all(tenantKey), 'detail'] as const,
    detail: (tenantKey: string | null, id: string) => [...assessmentKeys.details(tenantKey), id] as const,
};

export function useAssessments(filters: AssessmentFilters = {}) {
    const service = useAssessmentService();
    const { tenantKey } = useTenant();

    return useQuery({
        queryKey: assessmentKeys.list(tenantKey, filters),
        queryFn: () => service.getAssessments(filters),
        placeholderData: (previousData) => previousData,
    });
}

export function useAssessment(id: string) {
    const service = useAssessmentService();
    const { tenantKey } = useTenant();

    return useQuery({
        queryKey: assessmentKeys.detail(tenantKey, id),
        queryFn: () => service.getAssessmentById(id),
        enabled: !!id,
    });
}

export function useCreateAssessment() {
    const service = useAssessmentService();
    const queryClient = useQueryClient();
    const { tenantKey } = useTenant();

    return useMutation({
        mutationFn: (data: AssessmentCreate) => service.createAssessment(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: assessmentKeys.lists(tenantKey) });
            // Also invalidate grading category status as marks are now allocated
            queryClient.invalidateQueries({ queryKey: ['grading', tenantKey, 'categories-status'] });
            // Invalidate grading hub activities and performance
            queryClient.invalidateQueries({ queryKey: ['grading-hub', tenantKey] });
        },
    });
}

export function useUpdateAssessment() {
    const service = useAssessmentService();
    const queryClient = useQueryClient();
    const { tenantKey } = useTenant();

    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: AssessmentUpdate }) =>
            service.updateAssessment(id, data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: assessmentKeys.lists(tenantKey) });
            queryClient.invalidateQueries({ queryKey: assessmentKeys.detail(tenantKey, variables.id) });
        },
    });
}

export function useDeleteAssessment() {
    const service = useAssessmentService();
    const queryClient = useQueryClient();
    const { tenantKey } = useTenant();

    return useMutation({
        mutationFn: (id: string) => service.deleteAssessment(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: assessmentKeys.lists(tenantKey) });
        },
    });
}
