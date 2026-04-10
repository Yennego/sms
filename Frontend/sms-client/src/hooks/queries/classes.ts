import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useClassService } from '@/services/api/class-service';
import { ClassCreate, ClassUpdate, ClassFilters } from '@/types/class';
import { useTenant } from '@/hooks/use-tenant';

export const classKeys = {
    all: (tenantKey: string | null) => ['classes', tenantKey] as const,
    lists: (tenantKey: string | null) => [...classKeys.all(tenantKey), 'list'] as const,
    list: (tenantKey: string | null, filters: ClassFilters) => [...classKeys.lists(tenantKey), filters] as const,
    details: (tenantKey: string | null) => [...classKeys.all(tenantKey), 'detail'] as const,
    detail: (tenantKey: string | null, id: string, variant: 'basic' | 'full' = 'basic') => [...classKeys.details(tenantKey), id, variant] as const,
    students: (tenantKey: string | null, id: string) => [...classKeys.detail(tenantKey, id), 'students'] as const,
    enrollments: (tenantKey: string | null, id: string) => [...classKeys.detail(tenantKey, id), 'enrollments'] as const,
};

export function useClasses(filters: ClassFilters = {}) {
    const service = useClassService();
    const { tenantKey } = useTenant();

    return useQuery({
        queryKey: classKeys.list(tenantKey, filters),
        queryFn: () => service.getClasses(filters),
    });
}

export function useClass(id: string, variant: 'basic' | 'full' = 'basic') {
    const service = useClassService();
    const { tenantKey } = useTenant();

    return useQuery({
        queryKey: classKeys.detail(tenantKey, id, variant),
        queryFn: () => variant === 'full' ? service.getClassWithDetails(id) : service.getClassById(id),
        enabled: !!id,
    });
}

export function useClassStudents(classId: string) {
    const service = useClassService();
    const { tenantKey } = useTenant();

    return useQuery({
        queryKey: classKeys.students(tenantKey, classId),
        queryFn: () => service.getClassStudents(classId),
        enabled: !!classId,
    });
}

export function useCreateClass() {
    const service = useClassService();
    const queryClient = useQueryClient();
    const { tenantKey } = useTenant();

    return useMutation({
        mutationFn: (data: ClassCreate) => service.createClass(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: classKeys.lists(tenantKey) });
        },
    });
}

export function useUpdateClass() {
    const service = useClassService();
    const queryClient = useQueryClient();
    const { tenantKey } = useTenant();

    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: ClassUpdate }) =>
            service.updateClass(id, data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: classKeys.lists(tenantKey) });
            queryClient.invalidateQueries({ queryKey: classKeys.details(tenantKey) }); // Invalidate all details as a safer bet
        },
    });
}

export function useDeleteClass() {
    const service = useClassService();
    const queryClient = useQueryClient();
    const { tenantKey } = useTenant();

    return useMutation({
        mutationFn: (id: string) => service.deleteClass(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: classKeys.lists(tenantKey) });
        },
    });
}

export function useEnrollStudents() {
    const service = useClassService();
    const queryClient = useQueryClient();
    const { tenantKey } = useTenant();

    return useMutation({
        mutationFn: (payload: { class_id: string; academic_year_id: string; student_ids: string[] }) =>
            service.bulkCreateClassEnrollments(payload),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: classKeys.students(tenantKey, variables.class_id) });
            queryClient.invalidateQueries({ queryKey: classKeys.enrollments(tenantKey, variables.class_id) });
        },
    });
}
export function useAddSubjectToClass() {
    const service = useClassService();
    const queryClient = useQueryClient();
    const { tenantKey } = useTenant();

    return useMutation({
        mutationFn: ({ classId, subjectData }: { classId: string; subjectData: any }) =>
            service.addSubjectToClass(classId, subjectData),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: classKeys.detail(tenantKey, variables.classId, 'full') });
            queryClient.invalidateQueries({ queryKey: classKeys.lists(tenantKey) });
        },
    });
}

export function useRemoveSubjectFromClass() {
    const service = useClassService();
    const queryClient = useQueryClient();
    const { tenantKey } = useTenant();

    return useMutation({
        mutationFn: ({ classId, subjectId }: { classId: string; subjectId: string }) =>
            service.removeSubjectFromClass(classId, subjectId),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: classKeys.detail(tenantKey, variables.classId, 'full') });
            queryClient.invalidateQueries({ queryKey: classKeys.lists(tenantKey) });
        },
    });
}
