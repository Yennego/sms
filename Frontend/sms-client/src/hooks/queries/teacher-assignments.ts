import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTeacherSubjectAssignmentService } from '@/services/api/teacher-subject-assignment-service';
import {
    TeacherSubjectAssignmentCreate,
    TeacherSubjectAssignmentUpdate,
    ClassSponsor
} from '@/types/teacher-subject-assignment';
import { useTenant } from '@/hooks/use-tenant';

export const teacherAssignmentKeys = {
    all: (tenantKey: string | null) => ['teacherAssignments', tenantKey] as const,
    lists: (tenantKey: string | null) => [...teacherAssignmentKeys.all(tenantKey), 'list'] as const,
    list: (tenantKey: string | null, academicYearId: string) => [...teacherAssignmentKeys.lists(tenantKey), academicYearId] as const,
    byTeacher: (tenantKey: string | null, teacherId: string, academicYearId: string) => [...teacherAssignmentKeys.all(tenantKey), 'teacher', teacherId, academicYearId] as const,
    workload: (tenantKey: string | null, academicYearId: string) => [...teacherAssignmentKeys.all(tenantKey), 'workload', academicYearId] as const,
    unassigned: (tenantKey: string | null, academicYearId: string) => [...teacherAssignmentKeys.all(tenantKey), 'unassigned', academicYearId] as const,
    sponsors: (tenantKey: string | null, academicYearId: string) => [...teacherAssignmentKeys.all(tenantKey), 'sponsors', academicYearId] as const,
};

export function useAllTeacherAssignments(academicYearId: string) {
    const service = useTeacherSubjectAssignmentService();
    const { tenantKey } = useTenant();
    return useQuery({
        queryKey: teacherAssignmentKeys.list(tenantKey, academicYearId),
        queryFn: () => service.getAllAssignments(academicYearId),
        enabled: !!academicYearId,
    });
}

export function useTeacherAssignments(teacherId: string, academicYearId: string) {
    const service = useTeacherSubjectAssignmentService();
    const { tenantKey } = useTenant();
    return useQuery({
        queryKey: teacherAssignmentKeys.byTeacher(tenantKey, teacherId, academicYearId),
        queryFn: () => service.getTeacherAssignments(teacherId, academicYearId),
        enabled: !!teacherId && !!academicYearId,
    });
}

export function useTeacherWorkload(academicYearId: string) {
    const service = useTeacherSubjectAssignmentService();
    const { tenantKey } = useTenant();
    return useQuery({
        queryKey: teacherAssignmentKeys.workload(tenantKey, academicYearId),
        queryFn: () => service.getTeacherWorkload(academicYearId),
        enabled: !!academicYearId,
    });
}

export function useUnassignedSubjects(academicYearId: string) {
    const service = useTeacherSubjectAssignmentService();
    const { tenantKey } = useTenant();
    return useQuery({
        queryKey: teacherAssignmentKeys.unassigned(tenantKey, academicYearId),
        queryFn: () => service.getUnassignedSubjects(academicYearId),
        enabled: !!academicYearId,
    });
}

export function useCreateAssignment() {
    const service = useTeacherSubjectAssignmentService();
    const queryClient = useQueryClient();
    const { tenantKey } = useTenant();

    return useMutation({
        mutationFn: (data: TeacherSubjectAssignmentCreate) => service.createAssignment(data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: teacherAssignmentKeys.all(tenantKey) });
        },
    });
}

export function useUpdateAssignment() {
    const service = useTeacherSubjectAssignmentService();
    const queryClient = useQueryClient();
    const { tenantKey } = useTenant();

    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: TeacherSubjectAssignmentUpdate }) =>
            service.updateAssignment(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: teacherAssignmentKeys.all(tenantKey) });
        },
    });
}

export function useDeleteAssignment() {
    const service = useTeacherSubjectAssignmentService();
    const queryClient = useQueryClient();
    const { tenantKey } = useTenant();

    return useMutation({
        mutationFn: (id: string) => service.deleteAssignment(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: teacherAssignmentKeys.all(tenantKey) });
        },
    });
}

export function useBulkDeleteAssignments() {
    const service = useTeacherSubjectAssignmentService();
    const queryClient = useQueryClient();
    const { tenantKey } = useTenant();

    return useMutation({
        mutationFn: (ids: string[]) => service.bulkDeleteAssignments(ids),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: teacherAssignmentKeys.all(tenantKey) });
        },
    });
}

export function useBulkReassignAssignments() {
    const service = useTeacherSubjectAssignmentService();
    const queryClient = useQueryClient();
    const { tenantKey } = useTenant();

    return useMutation({
        mutationFn: (data: { ids: string[]; newTeacherId: string; newAcademicYearId?: string }) =>
            service.bulkReassignAssignments(data.ids, data.newTeacherId, data.newAcademicYearId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: teacherAssignmentKeys.all(tenantKey) });
        },
    });
}

export function useReassignTeacher() {
    const service = useTeacherSubjectAssignmentService();
    const queryClient = useQueryClient();
    const { tenantKey } = useTenant();

    return useMutation({
        mutationFn: (data: {
            gradeId: string;
            sectionId: string;
            subjectId: string;
            academicYearId: string;
            newTeacherId: string;
        }) => service.reassignTeacher(
            data.gradeId,
            data.sectionId,
            data.subjectId,
            data.academicYearId,
            data.newTeacherId
        ),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: teacherAssignmentKeys.all(tenantKey) });
        },
    });
}

export function useClassSponsors(academicYearId: string) {
    const service = useTeacherSubjectAssignmentService();
    const { tenantKey } = useTenant();
    return useQuery({
        queryKey: teacherAssignmentKeys.sponsors(tenantKey, academicYearId),
        queryFn: () => service.getClassSponsors(academicYearId),
        enabled: !!academicYearId,
    });
}

export function useAssignSponsor() {
    const service = useTeacherSubjectAssignmentService();
    const queryClient = useQueryClient();
    const { tenantKey } = useTenant();

    return useMutation({
        mutationFn: ({ sectionId, teacherId }: { sectionId: string; teacherId: string }) =>
            service.assignClassSponsor(sectionId, teacherId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: teacherAssignmentKeys.all(tenantKey) });
        },
    });
}
