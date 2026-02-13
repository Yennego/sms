import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTeacherService } from '@/services/api/teacher-service';
import { TeacherCreate, TeacherUpdate, TeacherFilters } from '@/types/teacher';

export const teacherKeys = {
    all: ['teachers'] as const,
    lists: () => [...teacherKeys.all, 'list'] as const,
    list: (filters: TeacherFilters) => [...teacherKeys.lists(), filters] as const,
    details: () => [...teacherKeys.all, 'detail'] as const,
    detail: (id: string) => [...teacherKeys.details(), id] as const,
    departments: () => [...teacherKeys.all, 'departments'] as const,
    classTeachers: () => [...teacherKeys.all, 'class-teachers'] as const,
};

export function useTeachers(filters: TeacherFilters = {}) {
    const service = useTeacherService();

    return useQuery({
        queryKey: teacherKeys.list(filters),
        queryFn: () => service.getTeachers(filters),
        placeholderData: (previousData) => previousData,
    });
}

export function useTeacher(id: string) {
    const service = useTeacherService();

    return useQuery({
        queryKey: teacherKeys.detail(id),
        queryFn: () => service.getTeacher(id),
        enabled: !!id,
    });
}

export function useDepartments() {
    const service = useTeacherService();

    return useQuery({
        queryKey: teacherKeys.departments(),
        queryFn: () => service.getDepartments(),
    });
}

export function useCreateTeacher() {
    const service = useTeacherService();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (teacher: TeacherCreate) => service.createTeacher(teacher),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: teacherKeys.lists() });
            queryClient.invalidateQueries({ queryKey: teacherKeys.departments() });
        },
    });
}

export function useUpdateTeacher() {
    const service = useTeacherService();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, teacher }: { id: string; teacher: TeacherUpdate }) =>
            service.updateTeacher(id, teacher),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: teacherKeys.lists() });
            queryClient.invalidateQueries({ queryKey: teacherKeys.detail(variables.id) });
            queryClient.invalidateQueries({ queryKey: teacherKeys.departments() });
        },
    });
}

export function useDeleteTeacher() {
    const service = useTeacherService();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => service.deleteTeacher(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: teacherKeys.lists() });
            queryClient.invalidateQueries({ queryKey: teacherKeys.departments() });
        },
    });
}
