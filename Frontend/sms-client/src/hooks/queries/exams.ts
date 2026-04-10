import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useExamService, type ExamCreate, type ExamUpdate } from '@/services/api/exam-service';
import { useEnrollmentService } from '@/services/api/enrollment-service';
import { useTenant } from '@/hooks/use-tenant';

export const examKeys = {
    all: (tenantKey: string | null) => ['exams', tenantKey] as const,
    lists: (tenantKey: string | null) => [...examKeys.all(tenantKey), 'list'] as const,
    list: (tenantKey: string | null, filters: Record<string, any>) => [...examKeys.lists(tenantKey), filters] as const,
    detail: (tenantKey: string | null, id: string) => [...examKeys.all(tenantKey), 'detail', id] as const,
    currentAcademicYear: (tenantKey: string | null) => ['currentAcademicYear', tenantKey] as const,
};

export function useCurrentAcademicYear() {
    const { getCurrentAcademicYear } = useEnrollmentService();
    const { tenantKey } = useTenant();

    return useQuery({
        queryKey: examKeys.currentAcademicYear(tenantKey),
        queryFn: async () => {
            try {
                return await getCurrentAcademicYear();
            } catch {
                // Return null if no current academic year (404)
                return null;
            }
        },
        retry: false, // Don't retry on 404
        staleTime: 5 * 60 * 1000, // 5 minutes
    });
}

export function useExams(filters: {
    academic_year_id?: string;
    subject_id?: string;
    teacher_id?: string;
    grade_id?: string;
    section_id?: string;
    limit?: number;
} = {}) {
    const service = useExamService();
    const { tenantKey } = useTenant();

    return useQuery({
        queryKey: examKeys.list(tenantKey, filters),
        queryFn: () => service.getExams({
            limit: filters.limit || 100,
            academic_year_id: filters.academic_year_id,
            subject_id: filters.subject_id,
            teacher_id: filters.teacher_id,
            grade_id: filters.grade_id,
            section_id: filters.section_id,
        }),
        enabled: !!filters.academic_year_id, // Only fetch when we have an academic year
    });
}

export function useCreateExam() {
    const service = useExamService();
    const queryClient = useQueryClient();
    const { tenantKey } = useTenant();

    return useMutation({
        mutationFn: (data: ExamCreate) => service.createExam(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: examKeys.all(tenantKey) });
        },
    });
}

export function useUpdateExam() {
    const service = useExamService();
    const queryClient = useQueryClient();
    const { tenantKey } = useTenant();

    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: ExamUpdate }) => service.updateExam(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: examKeys.all(tenantKey) });
        },
    });
}

export function useDeleteExam() {
    const service = useExamService();
    const queryClient = useQueryClient();
    const { tenantKey } = useTenant();

    return useMutation({
        mutationFn: (id: string) => service.deleteExam(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: examKeys.all(tenantKey) });
        },
    });
}

export function usePublishExam() {
    const service = useExamService();
    const queryClient = useQueryClient();
    const { tenantKey } = useTenant();

    return useMutation({
        mutationFn: (id: string) => service.publishExam(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: examKeys.all(tenantKey) });
        },
    });
}

export function useUnpublishExam() {
    const service = useExamService();
    const queryClient = useQueryClient();
    const { tenantKey } = useTenant();

    return useMutation({
        mutationFn: (id: string) => service.unpublishExam(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: examKeys.all(tenantKey) });
        },
    });
}
