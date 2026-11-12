'use client';

// TanStack Query hooks for Assignments (the Homework area). Every key starts with the school.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useSchoolKey } from '@/components/students/queries';
import { useAcademicGradeService } from '@/services/api/academic-grade-service';
import {
  useAssignmentService,
  type Assignment,
  type AssignmentCreate,
  type AssignmentUpdate,
} from '@/services/api/assignment-service';
import { useSectionService } from '@/services/api/section-service';
import { useSubjectService } from '@/services/api/subject-service';
import { useSubmissionService, type SubmissionCreate } from '@/services/api/submission-service';
import { useTeacherService } from '@/services/api/teacher-service';
import type { Enrollment } from '@/types/enrollment';

export interface AssignmentListFilters {
  subjectId: string;
  teacherId: string;
  gradeId: string;
  sectionId: string;
}

type Item = { id: string; name: string };

export const assignmentKeys = {
  all: (school: string | null) => ['assignments', school] as const,
  list: (school: string | null, filters: AssignmentListFilters, enrollmentId: string) =>
    [...assignmentKeys.all(school), 'list', filters, enrollmentId] as const,
  subjects: (school: string | null) => [...assignmentKeys.all(school), 'subjects'] as const,
  teachers: (school: string | null) => [...assignmentKeys.all(school), 'teachers'] as const,
  grades: (school: string | null) => [...assignmentKeys.all(school), 'grades'] as const,
  sections: (school: string | null, gradeId: string) => [...assignmentKeys.all(school), 'sections', gradeId] as const,
  mySubmissions: (school: string | null) => [...assignmentKeys.all(school), 'my-submissions'] as const,
};

/**
 * The assignments in view. With a student's `enrollment`, only their class's: their grade, and
 * grade-wide or their own section.
 */
export function useAssignmentList(filters: AssignmentListFilters, enrollment?: Enrollment | null) {
  const { getAssignments } = useAssignmentService();
  const school = useSchoolKey();
  return useQuery({
    queryKey: assignmentKeys.list(school, filters, enrollment?.id ?? ''),
    queryFn: async (): Promise<Assignment[]> => {
      const list = await getAssignments({
        limit: 50,
        subject_id: filters.subjectId || undefined,
        teacher_id: filters.teacherId || undefined,
        grade_id: enrollment?.grade_id || filters.gradeId || undefined,
        section_id: enrollment ? undefined : filters.sectionId || undefined,
      });
      const rows = Array.isArray(list) ? list : [];
      return enrollment ? rows.filter((a) => !a.section_id || a.section_id === enrollment.section_id) : rows;
    },
    enabled: Boolean(school),
    placeholderData: (previous) => previous,
  });
}

export function useAssignmentSubjects() {
  const { getActiveSubjects } = useSubjectService();
  const school = useSchoolKey();
  return useQuery({
    queryKey: assignmentKeys.subjects(school),
    queryFn: async (): Promise<Item[]> =>
      ((await getActiveSubjects()) ?? [])
        .map((s) => ({ id: String(s.id), name: s.name }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    enabled: Boolean(school),
    staleTime: 10 * 60 * 1000,
  });
}

/** Staff only: students can't list the school's teachers. */
export function useAssignmentTeachers(enabled: boolean) {
  const { getTeachers } = useTeacherService();
  const school = useSchoolKey();
  return useQuery({
    queryKey: assignmentKeys.teachers(school),
    queryFn: async (): Promise<Item[]> =>
      ((await getTeachers()) ?? [])
        .map((t) => {
          const named = t as typeof t & { name?: string };
          return { id: t.id, name: named.name || [t.first_name, t.last_name].filter(Boolean).join(' ') || 'Teacher' };
        })
        .sort((a, b) => a.name.localeCompare(b.name)),
    enabled: Boolean(school) && enabled,
    staleTime: 10 * 60 * 1000,
  });
}

export function useAssignmentGrades() {
  const { getGrades } = useAcademicGradeService();
  const school = useSchoolKey();
  return useQuery({
    queryKey: assignmentKeys.grades(school),
    queryFn: async (): Promise<Item[]> => ((await getGrades()) ?? []).map((g) => ({ id: String(g.id), name: g.name })),
    enabled: Boolean(school),
    staleTime: 10 * 60 * 1000,
  });
}

export function useAssignmentSections(gradeId: string) {
  const { getSectionsByGrade } = useSectionService();
  const school = useSchoolKey();
  return useQuery({
    queryKey: assignmentKeys.sections(school, gradeId),
    queryFn: async (): Promise<Item[]> =>
      ((await getSectionsByGrade(gradeId)) ?? []).map((s) => ({ id: String(s.id), name: s.name })),
    enabled: Boolean(school && gradeId),
    staleTime: 10 * 60 * 1000,
  });
}

/** The student's own handed-in work; refreshed every 30 seconds so new marks show up. */
export function useMySubmissions(enabled: boolean) {
  const { getMySubmissions } = useSubmissionService();
  const school = useSchoolKey();
  return useQuery({
    queryKey: assignmentKeys.mySubmissions(school),
    queryFn: async () => (await getMySubmissions()) ?? [],
    enabled: Boolean(school) && enabled,
    refetchInterval: 30 * 1000,
  });
}

/** After a change: this area, and the home pages' "due soon" and counts. */
function useInvalidateAssignments() {
  const school = useSchoolKey();
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: assignmentKeys.all(school) }),
      queryClient.invalidateQueries({ queryKey: ['upcoming-assignments'] }),
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] }),
    ]);
}

export function useSaveAssignment() {
  const { createAssignment, updateAssignment } = useAssignmentService();
  const invalidate = useInvalidateAssignments();
  return useMutation({
    mutationFn: (vars: { id?: string; data: AssignmentCreate | AssignmentUpdate }) =>
      vars.id ? updateAssignment(vars.id, vars.data) : createAssignment(vars.data as AssignmentCreate),
    onSettled: invalidate,
  });
}

export function useSetPublished() {
  const { publishAssignment, unpublishAssignment } = useAssignmentService();
  const invalidate = useInvalidateAssignments();
  return useMutation({
    mutationFn: (vars: { id: string; publish: boolean }) =>
      vars.publish ? publishAssignment(vars.id) : unpublishAssignment(vars.id),
    onSettled: invalidate,
  });
}

export function useDeleteAssignment() {
  const { deleteAssignment } = useAssignmentService();
  const invalidate = useInvalidateAssignments();
  return useMutation({
    mutationFn: (id: string) => deleteAssignment(id),
    onSettled: invalidate,
  });
}

export function useSubmitWork() {
  const { submitAssignment } = useSubmissionService();
  const invalidate = useInvalidateAssignments();
  return useMutation({
    mutationFn: (data: SubmissionCreate) => submitAssignment(data),
    onSettled: invalidate,
  });
}
