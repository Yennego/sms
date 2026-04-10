import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useStudentService } from '@/services/api/student-service';
import { StudentCreate, StudentUpdate } from '@/types/student';
import { useTenant } from '@/hooks/use-tenant';

export const studentKeys = {
    all: (tenantKey: string | null) => ['students', tenantKey] as const,
    lists: (tenantKey: string | null) => [...studentKeys.all(tenantKey), 'list'] as const,
    list: (tenantKey: string | null, filters: any) => [...studentKeys.lists(tenantKey), filters] as const,
    details: (tenantKey: string | null) => [...studentKeys.all(tenantKey), 'detail'] as const,
    detail: (tenantKey: string | null, id: string) => [...studentKeys.details(tenantKey), id] as const,
};

export function useStudents(filters?: { grade?: string; section?: string; status?: string; skip?: number; limit?: number }) {
    const service = useStudentService();
    const { tenantKey } = useTenant();

    return useQuery({
        queryKey: studentKeys.list(tenantKey, filters || {}),
        queryFn: () => service.getStudents(filters),
        placeholderData: (previousData) => previousData,
    });
}

export function useStudentsPaged(skip: number = 0, limit: number = 100, filters?: any) {
    const service = useStudentService();
    const { tenantKey } = useTenant();

    return useQuery({
        queryKey: [...studentKeys.lists(tenantKey), 'paged', { skip, limit, ...filters }],
        queryFn: () => service.getStudentsPaged(skip, limit, filters),
        staleTime: 5 * 60 * 1000,
    });
}

export function useStudent(id: string) {
    const service = useStudentService();
    const { tenantKey } = useTenant();

    return useQuery({
        queryKey: studentKeys.detail(tenantKey, id),
        queryFn: () => service.getStudentById(id),
        enabled: !!id,
    });
}

export function useCreateStudent() {
    const service = useStudentService();
    const queryClient = useQueryClient();
    const { tenantKey } = useTenant();

    return useMutation({
        mutationFn: (student: StudentCreate) => service.createStudent(student),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: studentKeys.lists(tenantKey) });
        },
    });
}

export function useUpdateStudent() {
    const service = useStudentService();
    const queryClient = useQueryClient();
    const { tenantKey } = useTenant();

    return useMutation({
        mutationFn: ({ id, student }: { id: string; student: StudentUpdate }) =>
            service.updateStudent(id, student),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: studentKeys.lists(tenantKey) });
            queryClient.invalidateQueries({ queryKey: studentKeys.detail(tenantKey, variables.id) });
        },
    });
}

export function useUpdateStudentStatus() {
    const service = useStudentService();
    const queryClient = useQueryClient();
    const { tenantKey } = useTenant();

    return useMutation({
        mutationFn: ({ id, status, reason }: { id: string; status: string; reason?: string }) =>
            service.updateStudentStatus(id, status, reason),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: studentKeys.lists(tenantKey) });
            queryClient.invalidateQueries({ queryKey: studentKeys.detail(tenantKey, variables.id) });
        },
    });
}

export function useDeleteStudent() {
    const service = useStudentService();
    const queryClient = useQueryClient();
    const { tenantKey } = useTenant();

    return useMutation({
        mutationFn: (id: string) => service.deleteStudent(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: studentKeys.lists(tenantKey) });
        },
    });
}

export function useBulkDeleteStudents() {
    const service = useStudentService();
    const queryClient = useQueryClient();
    const { tenantKey } = useTenant();

    return useMutation({
        mutationFn: (ids: string[]) => service.bulkDeleteStudents(ids),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: studentKeys.lists(tenantKey) });
        },
    });
}

export function useCreateStudentsBulk() {
    const service = useStudentService();
    const queryClient = useQueryClient();
    const { tenantKey } = useTenant();

    return useMutation({
        mutationFn: (students: StudentCreate[]) => service.createStudentsBulk(students),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: studentKeys.lists(tenantKey) });
        },
    });
}

