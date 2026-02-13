import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAcademicYearService } from '@/services/api/academic-year-service';
import { AcademicYearCreate, AcademicYearUpdate } from '@/types/enrollment';

export const academicYearKeys = {
    all: ['academicYears'] as const,
    lists: () => [...academicYearKeys.all, 'list'] as const,
    list: (includeArchived: boolean) => [...academicYearKeys.lists(), { includeArchived }] as const,
    current: () => [...academicYearKeys.all, 'current'] as const,
};

export function useAcademicYearsList(includeArchived: boolean = false) {
    const service = useAcademicYearService();
    return useQuery({
        queryKey: academicYearKeys.list(includeArchived),
        queryFn: () => service.getAcademicYears(includeArchived),
    });
}

export function useCurrentAcademicYearDetail() {
    const service = useAcademicYearService();
    return useQuery({
        queryKey: academicYearKeys.current(),
        queryFn: () => service.getCurrentAcademicYear(),
    });
}

export function useCreateAcademicYear() {
    const service = useAcademicYearService();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: AcademicYearCreate) => service.createAcademicYear(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: academicYearKeys.all });
        },
    });
}

export function useUpdateAcademicYear() {
    const service = useAcademicYearService();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: AcademicYearUpdate }) =>
            service.updateAcademicYear(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: academicYearKeys.all });
        },
    });
}

export function useDeleteAcademicYear() {
    const service = useAcademicYearService();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => service.deleteAcademicYear(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: academicYearKeys.all });
        },
    });
}

export function useSetCurrentAcademicYear() {
    const service = useAcademicYearService();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => service.setCurrentAcademicYear(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: academicYearKeys.all });
        },
    });
}

export function useArchiveAcademicYear() {
    const service = useAcademicYearService();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => service.archiveAcademicYear(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: academicYearKeys.all });
        },
    });
}
