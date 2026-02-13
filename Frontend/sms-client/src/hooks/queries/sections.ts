import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSectionService } from '@/services/api/section-service';
import { SectionCreate, SectionUpdate } from '@/types/section';

export const sectionKeys = {
    all: ['sections'] as const,
    lists: () => [...sectionKeys.all, 'list'] as const,
    byGrade: (gradeId: string) => [...sectionKeys.lists(), { gradeId }] as const,
};

export function useSections() {
    const service = useSectionService();
    return useQuery({
        queryKey: sectionKeys.lists(),
        queryFn: () => service.getSections(),
    });
}

export function useSectionsByGrade(gradeId: string) {
    const service = useSectionService();
    return useQuery({
        queryKey: sectionKeys.byGrade(gradeId),
        queryFn: () => service.getSectionsByGrade(gradeId),
        enabled: !!gradeId,
    });
}

export function useCreateSection() {
    const service = useSectionService();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: SectionCreate) => service.createSection(data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: sectionKeys.all });
        },
    });
}

export function useUpdateSection() {
    const service = useSectionService();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: SectionUpdate }) =>
            service.updateSection(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: sectionKeys.all });
        },
    });
}

export function useDeleteSection() {
    const service = useSectionService();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => service.deleteSection(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: sectionKeys.all });
        },
    });
}
