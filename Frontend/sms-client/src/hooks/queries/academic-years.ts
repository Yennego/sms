import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAcademicYearService } from '@/services/api/academic-year-service';
import { AcademicYearCreate, AcademicYearUpdate } from '@/types/enrollment';
import { useTenant } from '@/hooks/use-tenant';

export const academicYearKeys = {
    all: (tenantKey: string | null) => ['academicYears', tenantKey] as const,
    lists: (tenantKey: string | null) => [...academicYearKeys.all(tenantKey), 'list'] as const,
    list: (tenantKey: string | null, includeArchived: boolean) => [...academicYearKeys.lists(tenantKey), { includeArchived }] as const,
    current: (tenantKey: string | null) => [...academicYearKeys.all(tenantKey), 'current'] as const,
};

export function useAcademicYearsList(includeArchived: boolean = false) {
    const service = useAcademicYearService();
    const { tenantKey } = useTenant();
    return useQuery({
        queryKey: academicYearKeys.list(tenantKey, includeArchived),
        queryFn: () => service.getAcademicYears(includeArchived),
    });
}

export function useCurrentAcademicYearDetail() {
    const service = useAcademicYearService();
    const { tenantKey } = useTenant();
    return useQuery({
        queryKey: academicYearKeys.current(tenantKey),
        queryFn: () => service.getCurrentAcademicYear(),
    });
}

export function useCreateAcademicYear() {
    const service = useAcademicYearService();
    const queryClient = useQueryClient();
    const { tenantKey } = useTenant();

    return useMutation({
        mutationFn: (data: AcademicYearCreate) => service.createAcademicYear(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: academicYearKeys.all(tenantKey) });
        },
    });
}

export function useUpdateAcademicYear() {
    const service = useAcademicYearService();
    const queryClient = useQueryClient();
    const { tenantKey } = useTenant();

    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: AcademicYearUpdate }) =>
            service.updateAcademicYear(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: academicYearKeys.all(tenantKey) });
        },
    });
}

export function useDeleteAcademicYear() {
    const service = useAcademicYearService();
    const queryClient = useQueryClient();
    const { tenantKey } = useTenant();

    return useMutation({
        mutationFn: (id: string) => service.deleteAcademicYear(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: academicYearKeys.all(tenantKey) });
        },
    });
}

export function useSetCurrentAcademicYear() {
    const service = useAcademicYearService();
    const queryClient = useQueryClient();
    const { tenantKey } = useTenant();

    return useMutation({
        mutationFn: (id: string) => service.setCurrentAcademicYear(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: academicYearKeys.all(tenantKey) });
        },
    });
}

export function useArchiveAcademicYear() {
    const service = useAcademicYearService();
    const queryClient = useQueryClient();
    const { tenantKey } = useTenant();

    return useMutation({
        mutationFn: (id: string) => service.archiveAcademicYear(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: academicYearKeys.all(tenantKey) });
        },
    });
}
