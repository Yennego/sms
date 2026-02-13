import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTeacherSubjectAssignmentService } from '@/services/api/teacher-subject-assignment-service';
import {
    TeacherSubjectAssignmentCreate,
    TeacherSubjectAssignmentUpdate,
    ClassSponsor
} from '@/types/teacher-subject-assignment';

export const teacherAssignmentKeys = {
    all: ['teacherAssignments'] as const,
    lists: () => [...teacherAssignmentKeys.all, 'list'] as const,
    list: (academicYearId: string) => [...teacherAssignmentKeys.lists(), academicYearId] as const,
    byTeacher: (teacherId: string, academicYearId: string) => [...teacherAssignmentKeys.all, 'teacher', teacherId, academicYearId] as const,
    workload: (academicYearId: string) => [...teacherAssignmentKeys.all, 'workload', academicYearId] as const,
    unassigned: (academicYearId: string) => [...teacherAssignmentKeys.all, 'unassigned', academicYearId] as const,
    sponsors: (academicYearId: string) => [...teacherAssignmentKeys.all, 'sponsors', academicYearId] as const,
};

export function useAllTeacherAssignments(academicYearId: string) {
    const service = useTeacherSubjectAssignmentService();
    return useQuery({
        queryKey: teacherAssignmentKeys.list(academicYearId),
        queryFn: () => service.getAllAssignments(academicYearId),
        enabled: !!academicYearId,
    });
}

export function useTeacherAssignments(teacherId: string, academicYearId: string) {
    const service = useTeacherSubjectAssignmentService();
    return useQuery({
        queryKey: teacherAssignmentKeys.byTeacher(teacherId, academicYearId),
        queryFn: () => service.getTeacherAssignments(teacherId, academicYearId),
        enabled: !!teacherId && !!academicYearId,
    });
}

export function useTeacherWorkload(academicYearId: string) {
    const service = useTeacherSubjectAssignmentService();
    return useQuery({
        queryKey: teacherAssignmentKeys.workload(academicYearId),
        queryFn: () => service.getTeacherWorkload(academicYearId),
        enabled: !!academicYearId,
    });
}

export function useUnassignedSubjects(academicYearId: string) {
    const service = useTeacherSubjectAssignmentService();
    return useQuery({
        queryKey: teacherAssignmentKeys.unassigned(academicYearId),
        queryFn: () => service.getUnassignedSubjects(academicYearId),
        enabled: !!academicYearId,
    });
}

export function useCreateAssignment() {
    const service = useTeacherSubjectAssignmentService();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: TeacherSubjectAssignmentCreate) => service.createAssignment(data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: teacherAssignmentKeys.all });
        },
    });
}

export function useUpdateAssignment() {
    const service = useTeacherSubjectAssignmentService();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: TeacherSubjectAssignmentUpdate }) =>
            service.updateAssignment(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: teacherAssignmentKeys.all });
        },
    });
}

export function useDeleteAssignment() {
    const service = useTeacherSubjectAssignmentService();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => service.deleteAssignment(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: teacherAssignmentKeys.all });
        },
    });
}

export function useBulkDeleteAssignments() {
    const service = useTeacherSubjectAssignmentService();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (ids: string[]) => service.bulkDeleteAssignments(ids),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: teacherAssignmentKeys.all });
        },
    });
}

export function useBulkReassignAssignments() {
    const service = useTeacherSubjectAssignmentService();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: { ids: string[]; newTeacherId: string; newAcademicYearId?: string }) =>
            service.bulkReassignAssignments(data.ids, data.newTeacherId, data.newAcademicYearId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: teacherAssignmentKeys.all });
        },
    });
}

export function useReassignTeacher() {
    const service = useTeacherSubjectAssignmentService();
    const queryClient = useQueryClient();

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
            queryClient.invalidateQueries({ queryKey: teacherAssignmentKeys.all });
        },
    });
}

export function useClassSponsors(academicYearId: string) {
    const service = useTeacherSubjectAssignmentService();
    return useQuery({
        queryKey: teacherAssignmentKeys.sponsors(academicYearId),
        queryFn: () => service.getClassSponsors(academicYearId),
        enabled: !!academicYearId,
    });
}

export function useAssignSponsor() {
    const service = useTeacherSubjectAssignmentService();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ sectionId, teacherId }: { sectionId: string; teacherId: string }) =>
            service.assignClassSponsor(sectionId, teacherId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: teacherAssignmentKeys.all });
        },
    });
}
