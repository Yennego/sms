import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSectionService } from '@/services/api/section-service';
import { SectionCreate, SectionUpdate } from '@/types/section';
import { useTenant } from '@/hooks/use-tenant';

export const sectionKeys = {
    all: (tenantKey: string | null) => ['sections', tenantKey] as const,
    lists: (tenantKey: string | null) => [...sectionKeys.all(tenantKey), 'list'] as const,
    byGrade: (tenantKey: string | null, gradeId: string) => [...sectionKeys.lists(tenantKey), { gradeId }] as const,
};

export function useSections() {
    const service = useSectionService();
    const { tenantKey } = useTenant();
    return useQuery({
        queryKey: sectionKeys.lists(tenantKey),
        queryFn: () => service.getSections(),
    });
}

export function useSectionsByGrade(gradeId: string) {
    const service = useSectionService();
    const { tenantKey } = useTenant();
    return useQuery({
        queryKey: sectionKeys.byGrade(tenantKey, gradeId),
        queryFn: () => service.getSectionsByGrade(gradeId),
        enabled: !!gradeId,
    });
}

export function useCreateSection() {
    const service = useSectionService();
    const queryClient = useQueryClient();
    const { tenantKey } = useTenant();

    return useMutation({
        mutationFn: (data: SectionCreate) => service.createSection(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: sectionKeys.all(tenantKey) });
        },
    });
}

export function useUpdateSection() {
    const service = useSectionService();
    const queryClient = useQueryClient();
    const { tenantKey } = useTenant();

    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: SectionUpdate }) =>
            service.updateSection(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: sectionKeys.all(tenantKey) });
        },
    });
}

export function useDeleteSection() {
    const service = useSectionService();
    const queryClient = useQueryClient();
    const { tenantKey } = useTenant();

    return useMutation({
        mutationFn: (id: string) => service.deleteSection(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: sectionKeys.all(tenantKey) });
        },
    });
}
