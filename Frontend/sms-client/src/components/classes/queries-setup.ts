'use client';

// TanStack Query hooks for the desk setup screens of the Classes area: class rosters, a class's
// students and periods, enrolling students, the current semester and a subject assignment's
// students. Keys start with the school; class keys hang under `classKeys` so the shared class
// mutations refresh them too.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useSchoolKey } from '@/components/students/queries';
import { classKeys } from '@/hooks/queries/classes';
import { useClassService } from '@/services/api/class-service';
import { useEnrollmentService } from '@/services/api/enrollment-service';
import { usePromotionService } from '@/services/api/promotion-service';
import { useScheduleService } from '@/services/api/schedule-service';
import { useSemesterService } from '@/services/api/semester-service';
import { useStudentService } from '@/services/api/student-service';
import { useTeacherSubjectAssignmentService } from '@/services/api/teacher-subject-assignment-service';
import type { ClassCreate } from '@/types/class';
import type { Student } from '@/types/student';

export const classSetupKeys = {
  all: (school: string | null) => ['classes-setup', school] as const,
  schedules: (school: string | null, classId: string) => [...classSetupKeys.all(school), 'schedules', classId] as const,
  candidates: (school: string | null, classId: string, grade: string, section: string) =>
    [...classSetupKeys.all(school), 'candidates', classId, grade, section] as const,
  currentSemester: (school: string | null) => [...classSetupKeys.all(school), 'current-semester'] as const,
  assignmentStudents: (school: string | null, assignmentId: string) =>
    [...classSetupKeys.all(school), 'assignment-students', assignmentId] as const,
};

/** One student on a class's roster (the backend's ClassEnrollmentWithDetails). */
export type RosterEntry = {
  id?: string;
  student_id?: string;
  student?: { id?: string; full_name?: string };
  student_name?: string;
  student_full_name?: string;
  admission_number?: string;
  enrollment_date?: string;
};

export function rosterStudentId(e: RosterEntry): string | undefined {
  return e.student_id ?? e.student?.id;
}

export function rosterStudentName(e: RosterEntry): string {
  return e.student_name || e.student_full_name || e.student?.full_name || 'Unnamed student';
}

/** The class's active students and how many there are. */
export function useClassRoster(classId: string) {
  const service = useClassService();
  const school = useSchoolKey();
  return useQuery({
    queryKey: classKeys.enrollments(school, classId),
    queryFn: async () => {
      const [count, roster] = await Promise.all([
        service.getClassEnrollmentCount(classId, { is_active: true }),
        service.getClassEnrollments(classId, { is_active: true }),
      ]);
      return { count, entries: (roster || []) as RosterEntry[] };
    },
    enabled: Boolean(school && classId),
  });
}

export function useClassSchedules(classId: string) {
  const service = useScheduleService();
  const school = useSchoolKey();
  return useQuery({
    queryKey: classSetupKeys.schedules(school, classId),
    queryFn: async () => (await service.getSchedules({ class_id: classId })) || [],
    enabled: Boolean(school && classId),
  });
}

/**
 * Active students of a grade (and section) who could join the class: the server filters by name,
 * then their current enrollments confirm grade and section; students already on the roster are left out.
 */
export function useEnrollCandidates(classId: string, gradeName: string, sectionName: string, rosterIds: Set<string>) {
  const studentService = useStudentService();
  const enrollmentService = useEnrollmentService();
  const school = useSchoolKey();
  const query = useQuery({
    queryKey: classSetupKeys.candidates(school, classId, gradeName, sectionName),
    queryFn: async () => {
      const res = await studentService.getStudents({ grade: gradeName, section: sectionName || undefined, status: 'active' });
      const list: Student[] = res.items ?? [];
      if (!list.length) return list;
      const current = await enrollmentService.getBulkCurrentEnrollments(list.map((s) => s.id));
      return list.filter((s) => {
        const enr = current.get(s.id);
        return (enr?.grade || '') === gradeName && (!sectionName || (enr?.section || '') === sectionName);
      });
    },
    enabled: Boolean(school && classId && gradeName),
  });
  return { ...query, data: (query.data ?? []).filter((s) => !rosterIds.has(s.id)) };
}

/** Enroll one or more students in the class for a year (today, active). */
export function useEnrollInClass(classId: string) {
  const service = useClassService();
  const school = useSchoolKey();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ studentIds, academicYearId }: { studentIds: string[]; academicYearId: string }) => {
      const base = {
        class_id: classId,
        academic_year_id: academicYearId,
        enrollment_date: new Date().toISOString().split('T')[0],
        status: 'active',
      };
      if (studentIds.length === 1) {
        await service.createClassEnrollment({ ...base, student_id: studentIds[0] });
      } else {
        await service.bulkCreateClassEnrollments({ ...base, student_ids: studentIds });
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: classKeys.detail(school, classId) });
      queryClient.invalidateQueries({ queryKey: [...classSetupKeys.all(school), 'candidates', classId] });
    },
  });
}

/** Create a class and, when a subject is chosen, add the subject with its teacher. */
export function useBuildClass() {
  const service = useClassService();
  const school = useSchoolKey();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: ClassCreate) => service.buildClass(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: classKeys.all(school) }),
  });
}

export function useEvaluatePromotion() {
  const { evaluatePromotion } = usePromotionService();
  return useMutation({
    mutationFn: ({ yearId, gradeId }: { yearId: string; gradeId: string }) => evaluatePromotion(yearId, gradeId),
  });
}

/** The current semester number of the current year (null when the server has none). */
export function useCurrentSemester() {
  const { getCurrentSemester } = useSemesterService();
  const school = useSchoolKey();
  return useQuery({
    queryKey: classSetupKeys.currentSemester(school),
    queryFn: async () => {
      const info = (await getCurrentSemester()) as { current_semester?: number; semester?: number } | null;
      return info?.current_semester ?? info?.semester ?? null;
    },
    enabled: Boolean(school),
    retry: false,
  });
}

export type AssignmentStudent = {
  id: string;
  first_name?: string;
  last_name?: string;
  admission_number?: string;
  gender?: string;
};

/** Students of the class a subject assignment belongs to. */
export function useAssignmentStudents(assignmentId: string | null) {
  const service = useTeacherSubjectAssignmentService();
  const school = useSchoolKey();
  return useQuery({
    queryKey: classSetupKeys.assignmentStudents(school, assignmentId ?? ''),
    queryFn: async () => ((await service.getClassStudents(assignmentId as string)) || []) as AssignmentStudent[],
    enabled: Boolean(school && assignmentId),
  });
}
