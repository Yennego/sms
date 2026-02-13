import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useGradingService, GradingSchemaCreate } from '@/services/api/grading-service';

export const gradingKeys = {
    all: ['grading'] as const,
    schemas: () => [...gradingKeys.all, 'schemas'] as const,
    schema: (id: string) => [...gradingKeys.schemas(), id] as const,
};

export function useGradingSchemas() {
    const service = useGradingService();

    return useQuery({
        queryKey: gradingKeys.schemas(),
        queryFn: () => service.getGradingSchemas(),
    });
}

export function useGradingSchema(id: string) {
    const service = useGradingService();

    return useQuery({
        queryKey: gradingKeys.schema(id),
        queryFn: () => service.getGradingSchema(id),
        enabled: !!id,
    });
}

export function useCreateGradingSchema() {
    const service = useGradingService();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: GradingSchemaCreate) => service.createGradingSchema(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: gradingKeys.schemas() });
        },
    });
}

export function useUpdateGradingSchema() {
    const service = useGradingService();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: Partial<GradingSchemaCreate> }) =>
            service.updateGradingSchema({ id, data }),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: gradingKeys.schemas() });
            queryClient.invalidateQueries({ queryKey: gradingKeys.schema(variables.id) });
        },
    });
}

export function useDeleteGradingSchema() {
    const service = useGradingService();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => service.deleteGradingSchema(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: gradingKeys.schemas() });
        },
    });
}
