import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useExamService, type ExamCreate, type ExamUpdate } from '@/services/api/exam-service';
import { useEnrollmentService } from '@/services/api/enrollment-service';

export const examKeys = {
    all: ['exams'] as const,
    lists: () => [...examKeys.all, 'list'] as const,
    list: (filters: Record<string, any>) => [...examKeys.lists(), filters] as const,
    detail: (id: string) => [...examKeys.all, 'detail', id] as const,
    currentAcademicYear: ['currentAcademicYear'] as const,
};

export function useCurrentAcademicYear() {
    const { getCurrentAcademicYear } = useEnrollmentService();

    return useQuery({
        queryKey: examKeys.currentAcademicYear,
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

    return useQuery({
        queryKey: examKeys.list(filters),
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

    return useMutation({
        mutationFn: (data: ExamCreate) => service.createExam(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: examKeys.all });
        },
    });
}

export function useUpdateExam() {
    const service = useExamService();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: ExamUpdate }) => service.updateExam(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: examKeys.all });
        },
    });
}

export function useDeleteExam() {
    const service = useExamService();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => service.deleteExam(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: examKeys.all });
        },
    });
}

export function usePublishExam() {
    const service = useExamService();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => service.publishExam(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: examKeys.all });
        },
    });
}

export function useUnpublishExam() {
    const service = useExamService();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => service.unpublishExam(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: examKeys.all });
        },
    });
}
