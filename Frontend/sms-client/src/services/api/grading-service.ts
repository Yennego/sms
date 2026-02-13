import { useMemo } from 'react';
import { useApiClient } from './api-client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface GradingCategory {
    id: string;
    name: string;
    weight: number;
    description?: string;
    schema_id: string;
}

export interface GradingSchema {
    id: string;
    name: string;
    description?: string;
    is_active: boolean;
    categories: GradingCategory[];
}

export interface GradingSchemaCreate {
    name: string;
    description?: string;
    is_active?: boolean;
    categories: {
        name: string;
        weight: number;
        description?: string;
    }[];
}

export function useGradingService() {
    const apiClient = useApiClient();
    const queryClient = useQueryClient();

    // Direct getters for manual fetching
    // ApiClient already returns response.data
    const getGradingSchemas = async () => {
        return await apiClient.get<GradingSchema[]>('/academics/grading-schemas');
    };

    const getGradingSchema = async (id: string) => {
        return await apiClient.get<GradingSchema>(`/academics/grading-schemas/${id}`);
    };

    const createGradingSchema = async (data: GradingSchemaCreate) => {
        return await apiClient.post<GradingSchema>('/academics/grading-schemas', data);
    };

    const updateGradingSchema = async ({ id, data }: { id: string; data: Partial<GradingSchemaCreate> }) => {
        return await apiClient.put<GradingSchema>(`/academics/grading-schemas/${id}`, data);
    };

    const deleteGradingSchema = async (id: string) => {
        return await apiClient.delete<any>(`/academics/grading-schemas/${id}`);
    };

    return {
        // Direct methods
        getGradingSchemas,
        getGradingSchema,
        createGradingSchema,
        updateGradingSchema,
        deleteGradingSchema,

        // React Query Hooks
        useSchemas: () => useQuery({
            queryKey: ['grading-schemas'],
            queryFn: getGradingSchemas,
        }),

        useCreateSchema: () => useMutation({
            mutationFn: createGradingSchema,
            onSuccess: () => {
                queryClient.invalidateQueries({ queryKey: ['grading-schemas'] });
            },
        }),

        useUpdateSchema: () => useMutation({
            mutationFn: updateGradingSchema,
            onSuccess: () => {
                queryClient.invalidateQueries({ queryKey: ['grading-schemas'] });
            },
        }),

        useDeleteSchema: () => useMutation({
            mutationFn: deleteGradingSchema,
            onSuccess: () => {
                queryClient.invalidateQueries({ queryKey: ['grading-schemas'] });
            },
        }),
    };
}
