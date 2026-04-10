import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useGradingService, GradingSchemaCreate } from '@/services/api/grading-service';
import { useTenant } from '@/hooks/use-tenant';

export const gradingKeys = {
    all: (tenantKey: string | null) => ['grading', tenantKey] as const,
    schemas: (tenantKey: string | null) => [...gradingKeys.all(tenantKey), 'schemas'] as const,
    schema: (tenantKey: string | null, id: string) => [...gradingKeys.schemas(tenantKey), id] as const,
    categoriesStatus: (tenantKey: string | null, classId: string, subjectId: string, periodId?: string, semesterId?: string) =>
        [...gradingKeys.all(tenantKey), 'categories-status', classId, subjectId, periodId, semesterId] as const,
};

export function useCategoriesStatus(classId: string, subjectId: string, periodId?: string, semesterId?: string) {
    const service = useGradingService();
    const { tenantKey } = useTenant();

    return useQuery({
        queryKey: gradingKeys.categoriesStatus(tenantKey, classId, subjectId, periodId, semesterId),
        queryFn: () => service.getCategoriesStatus(classId, subjectId, periodId, semesterId),
        enabled: !!classId && !!subjectId,
    });
}

export function useGradingSchemas() {
    const service = useGradingService();
    const { tenantKey } = useTenant();

    return useQuery({
        queryKey: gradingKeys.schemas(tenantKey),
        queryFn: () => service.getGradingSchemas(),
    });
}

export function useGradingSchema(id: string) {
    const service = useGradingService();
    const { tenantKey } = useTenant();

    return useQuery({
        queryKey: gradingKeys.schema(tenantKey, id),
        queryFn: () => service.getGradingSchema(id),
        enabled: !!id,
    });
}

export function useCreateGradingSchema() {
    const service = useGradingService();
    const queryClient = useQueryClient();
    const { tenantKey } = useTenant();

    return useMutation({
        mutationFn: (data: GradingSchemaCreate) => service.createGradingSchema(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: gradingKeys.schemas(tenantKey) });
        },
    });
}

export function useUpdateGradingSchema() {
    const service = useGradingService();
    const queryClient = useQueryClient();
    const { tenantKey } = useTenant();

    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: Partial<GradingSchemaCreate> }) =>
            service.updateGradingSchema({ id, data }),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: gradingKeys.schemas(tenantKey) });
            queryClient.invalidateQueries({ queryKey: gradingKeys.schema(tenantKey, variables.id) });
        },
    });
}

export function useDeleteGradingSchema() {
    const service = useGradingService();
    const queryClient = useQueryClient();
    const { tenantKey } = useTenant();

    return useMutation({
        mutationFn: (id: string) => service.deleteGradingSchema(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: gradingKeys.schemas(tenantKey) });
        },
    });
}
