import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useClassService } from '@/services/api/class-service';
import { ClassCreate, ClassUpdate, ClassFilters } from '@/types/class';

export const classKeys = {
    all: ['classes'] as const,
    lists: () => [...classKeys.all, 'list'] as const,
    list: (filters: ClassFilters) => [...classKeys.lists(), filters] as const,
    details: () => [...classKeys.all, 'detail'] as const,
    detail: (id: string, variant: 'basic' | 'full' = 'basic') => [...classKeys.details(), id, variant] as const,
    students: (id: string) => [...classKeys.detail(id), 'students'] as const,
    enrollments: (id: string) => [...classKeys.detail(id), 'enrollments'] as const,
};

export function useClasses(filters: ClassFilters = {}) {
    const service = useClassService();

    return useQuery({
        queryKey: classKeys.list(filters),
        queryFn: () => service.getClasses(filters),
    });
}

export function useClass(id: string, variant: 'basic' | 'full' = 'basic') {
    const service = useClassService();

    return useQuery({
        queryKey: classKeys.detail(id, variant),
        queryFn: () => variant === 'full' ? service.getClassWithDetails(id) : service.getClassById(id),
        enabled: !!id,
    });
}

export function useClassStudents(classId: string) {
    const service = useClassService();

    return useQuery({
        queryKey: classKeys.students(classId),
        queryFn: () => service.getClassStudents(classId),
        enabled: !!classId,
    });
}

export function useCreateClass() {
    const service = useClassService();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: ClassCreate) => service.createClass(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: classKeys.lists() });
        },
    });
}

export function useUpdateClass() {
    const service = useClassService();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: ClassUpdate }) =>
            service.updateClass(id, data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: classKeys.lists() });
            queryClient.invalidateQueries({ queryKey: classKeys.details() }); // Invalidate all details as a safer bet
        },
    });
}

export function useDeleteClass() {
    const service = useClassService();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => service.deleteClass(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: classKeys.lists() });
        },
    });
}

export function useEnrollStudents() {
    const service = useClassService();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (payload: { class_id: string; academic_year_id: string; student_ids: string[] }) =>
            service.bulkCreateClassEnrollments(payload),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: classKeys.students(variables.class_id) });
            queryClient.invalidateQueries({ queryKey: classKeys.enrollments(variables.class_id) });
        },
    });
}
export function useAddSubjectToClass() {
    const service = useClassService();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ classId, subjectData }: { classId: string; subjectData: any }) =>
            service.addSubjectToClass(classId, subjectData),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: classKeys.detail(variables.classId, 'full') });
            queryClient.invalidateQueries({ queryKey: classKeys.lists() });
        },
    });
}

export function useRemoveSubjectFromClass() {
    const service = useClassService();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ classId, subjectId }: { classId: string; subjectId: string }) =>
            service.removeSubjectFromClass(classId, subjectId),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: classKeys.detail(variables.classId, 'full') });
            queryClient.invalidateQueries({ queryKey: classKeys.lists() });
        },
    });
}
