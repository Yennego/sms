import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTeacherService } from '@/services/api/teacher-service';
import { TeacherCreate, TeacherUpdate, TeacherFilters } from '@/types/teacher';
import { useTenant } from '@/hooks/use-tenant';

export const teacherKeys = {
    all: (tenantKey: string | null) => ['teachers', tenantKey] as const,
    lists: (tenantKey: string | null) => [...teacherKeys.all(tenantKey), 'list'] as const,
    list: (tenantKey: string | null, filters: TeacherFilters) => [...teacherKeys.lists(tenantKey), filters] as const,
    details: (tenantKey: string | null) => [...teacherKeys.all(tenantKey), 'detail'] as const,
    detail: (tenantKey: string | null, id: string) => [...teacherKeys.details(tenantKey), id] as const,
    departments: (tenantKey: string | null) => [...teacherKeys.all(tenantKey), 'departments'] as const,
    classTeachers: (tenantKey: string | null) => [...teacherKeys.all(tenantKey), 'class-teachers'] as const,
};

export function useTeachers(filters: TeacherFilters = {}) {
    const service = useTeacherService();
    const { tenantKey } = useTenant();

    return useQuery({
        queryKey: teacherKeys.list(tenantKey, filters),
        queryFn: () => service.getTeachers(filters),
        placeholderData: (previousData) => previousData,
    });
}

export function useTeacher(id: string) {
    const service = useTeacherService();
    const { tenantKey } = useTenant();

    return useQuery({
        queryKey: teacherKeys.detail(tenantKey, id),
        queryFn: () => service.getTeacher(id),
        enabled: !!id,
    });
}

export function useDepartments() {
    const service = useTeacherService();
    const { tenantKey } = useTenant();

    return useQuery({
        queryKey: teacherKeys.departments(tenantKey),
        queryFn: () => service.getDepartments(),
    });
}

export function useCreateTeacher() {
    const service = useTeacherService();
    const queryClient = useQueryClient();
    const { tenantKey } = useTenant();

    return useMutation({
        mutationFn: (teacher: TeacherCreate) => service.createTeacher(teacher),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: teacherKeys.lists(tenantKey) });
            queryClient.invalidateQueries({ queryKey: teacherKeys.departments(tenantKey) });
        },
    });
}

export function useUpdateTeacher() {
    const service = useTeacherService();
    const queryClient = useQueryClient();
    const { tenantKey } = useTenant();

    return useMutation({
        mutationFn: ({ id, teacher }: { id: string; teacher: TeacherUpdate }) =>
            service.updateTeacher(id, teacher),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: teacherKeys.lists(tenantKey) });
            queryClient.invalidateQueries({ queryKey: teacherKeys.detail(tenantKey, variables.id) });
            queryClient.invalidateQueries({ queryKey: teacherKeys.departments(tenantKey) });
        },
    });
}

export function useDeleteTeacher() {
    const service = useTeacherService();
    const queryClient = useQueryClient();
    const { tenantKey } = useTenant();

    return useMutation({
        mutationFn: (id: string) => service.deleteTeacher(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: teacherKeys.lists(tenantKey) });
            queryClient.invalidateQueries({ queryKey: teacherKeys.departments(tenantKey) });
        },
    });
}
