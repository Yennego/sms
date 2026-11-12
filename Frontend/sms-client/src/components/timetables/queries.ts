'use client';

// TanStack Query hooks for the Timetable area. Every key starts with the school.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useSchoolKey } from '@/components/students/queries';
import { useAcademicGradeService } from '@/services/api/academic-grade-service';
import { useClassService } from '@/services/api/class-service';
import { useSectionService } from '@/services/api/section-service';
import {
  useTimetableService,
  type TimeSlot,
  type Timetable,
  type TimetableCreate,
  type TimetableFilters,
} from '@/services/api/timetable-service';
import type { ClassWithDetails } from '@/types/class';
import type { Enrollment } from '@/types/enrollment';

export const timetableKeys = {
  all: (school: string | null) => ['timetables', school] as const,
  list: (school: string | null, filters: TimetableFilters) => [...timetableKeys.all(school), 'list', filters] as const,
  mySchedule: (school: string | null) => [...timetableKeys.all(school), 'my-schedule'] as const,
  student: (school: string | null, enrollmentId: string) => [...timetableKeys.all(school), 'student', enrollmentId] as const,
  grades: (school: string | null) => [...timetableKeys.all(school), 'grades'] as const,
  sections: (school: string | null, gradeId: string) => [...timetableKeys.all(school), 'sections', gradeId] as const,
  subjects: (school: string | null, yearId: string, gradeId: string, sectionId: string) =>
    [...timetableKeys.all(school), 'subjects', yearId, gradeId, sectionId] as const,
};

export function useTimetables(filters: TimetableFilters, enabled = true) {
  const { getTimetables } = useTimetableService();
  const school = useSchoolKey();
  return useQuery({
    queryKey: timetableKeys.list(school, filters),
    queryFn: () => getTimetables(filters),
    enabled: Boolean(school && filters.academic_year_id) && enabled,
    placeholderData: (previous) => previous,
  });
}

/** The signed-in teacher's own lessons across every timetable. */
export function useMySchedule(enabled = true) {
  const { getMySchedule } = useTimetableService();
  const school = useSchoolKey();
  return useQuery({
    queryKey: timetableKeys.mySchedule(school),
    queryFn: () => getMySchedule(),
    enabled: Boolean(school) && enabled,
  });
}

/**
 * A student's week: the slots of every active timetable of their grade for their year, grade-wide
 * or for their section (falling back to the grade's active timetables when none match the year).
 */
export function useStudentTimetable(enrollment: Enrollment | null | undefined) {
  const { getTimetables } = useTimetableService();
  const school = useSchoolKey();
  return useQuery({
    queryKey: timetableKeys.student(school, enrollment?.id ?? ''),
    queryFn: async (): Promise<TimeSlot[]> => {
      const e = enrollment as Enrollment;
      const timetables = await getTimetables({ grade_id: e.grade_id });
      const matches = timetables.filter(
        (t) => t.is_active && t.academic_year_id === e.academic_year_id && (!t.section_id || t.section_id === e.section_id)
      );
      const used = matches.length > 0 ? matches : timetables.filter((t) => t.is_active);
      return used.flatMap((t) => t.time_slots ?? []);
    },
    enabled: Boolean(school && enrollment?.id),
  });
}

export function useTimetableGrades() {
  const { getAllGrades } = useAcademicGradeService();
  const school = useSchoolKey();
  return useQuery({
    queryKey: timetableKeys.grades(school),
    queryFn: async () => {
      const grades = await getAllGrades();
      return (Array.isArray(grades) ? grades : []).map((g) => ({ id: String(g.id), name: g.name }));
    },
    enabled: Boolean(school),
    staleTime: 10 * 60 * 1000,
  });
}

/** The sections of a grade, or every section when no grade is given. */
export function useTimetableSections(gradeId: string) {
  const { getSections, getSectionsByGrade } = useSectionService();
  const school = useSchoolKey();
  return useQuery({
    queryKey: timetableKeys.sections(school, gradeId),
    queryFn: async () => {
      const list = gradeId ? await getSectionsByGrade(gradeId) : (await getSections()).sections;
      return (Array.isArray(list) ? list : []).map((s) => ({ id: String(s.id), name: s.name }));
    },
    enabled: Boolean(school),
    staleTime: 10 * 60 * 1000,
  });
}

export interface SubjectChoice {
  /** The subject assignment a slot points at (its `class_id`) */
  id: string;
  label: string;
}

/** The subjects (with their teachers) of the classes a timetable covers. */
export function useTimetableSubjects(yearId: string, gradeId: string, sectionId: string) {
  const { getClasses } = useClassService();
  const school = useSchoolKey();
  return useQuery({
    queryKey: timetableKeys.subjects(school, yearId, gradeId, sectionId),
    queryFn: async (): Promise<SubjectChoice[]> => {
      // The class list carries each class's subjects
      const classes = (await getClasses({
        academic_year_id: yearId,
        grade_id: gradeId,
        section_id: sectionId || undefined,
        is_active: true,
      })) as unknown as ClassWithDetails[];
      return classes.flatMap((c) =>
        (Array.isArray(c.subjects) ? c.subjects : []).map((s) => ({
          id: s.id,
          label: `${s.subject_name || 'Subject'} (${s.teacher_name || 'no teacher yet'})`,
        }))
      );
    },
    enabled: Boolean(school && yearId && gradeId),
  });
}

export function useSaveTimetable() {
  const { createTimetable, updateTimetable } = useTimetableService();
  const school = useSchoolKey();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id?: string; data: TimetableCreate }): Promise<Timetable> =>
      vars.id ? updateTimetable(vars.id, vars.data) : createTimetable(vars.data),
    onSettled: () => queryClient.invalidateQueries({ queryKey: timetableKeys.all(school) }),
  });
}

export function useDeleteTimetable() {
  const { deleteTimetable } = useTimetableService();
  const school = useSchoolKey();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteTimetable(id),
    onSettled: () => queryClient.invalidateQueries({ queryKey: timetableKeys.all(school) }),
  });
}
