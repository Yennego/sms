'use client';

// TanStack Query hooks for the Classes area (classes of a year, sections, subjects, grade levels).
// The lists reuse the keys in src/hooks/queries (they already start with the school), so the other
// pages that read them stay in step; every change here also refreshes the year setup wizard.
import { useMemo } from 'react';
import { useMutation, useQueries, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';

import { useSchoolKey } from '@/components/students/queries';
import { yearSetupKeys } from '@/components/year-setup/use-year-setup';
import { useAuth } from '@/hooks/use-auth';
import { gradeKeys } from '@/hooks/queries/academic-grades';
import { useAcademicYearsList } from '@/hooks/queries/academic-years';
import { classKeys } from '@/hooks/queries/classes';
import { enrollmentKeys } from '@/hooks/queries/enrollments';
import { sectionKeys } from '@/hooks/queries/sections';
import { subjectKeys, useSubjects as useSubjectList } from '@/hooks/queries/subjects';
import { useAcademicGradeService } from '@/services/api/academic-grade-service';
import { useClassService } from '@/services/api/class-service';
import { useSectionService } from '@/services/api/section-service';
import { useStudentRecordsService } from '@/services/api/student-records-service';
import { useSubjectService } from '@/services/api/subject-service';
import type { AcademicGrade, AcademicGradeCreate, AcademicGradeUpdate } from '@/types/academic-grade';
import type { Class, ClassCreate, ClassUpdate } from '@/types/class';
import type { Section, SectionCreate, SectionUpdate } from '@/types/section';
import type { SubjectCreate, SubjectUpdate } from '@/types/subject';

const ADMIN_ROLES = ['admin', 'tenant-admin', 'super-admin', 'superadmin'];

/**
 * What the signed-in person may change in the Classes area (the server decides; this only shapes
 * the screens): admins, anyone with manage_classes (classes, sections, grade levels) and anyone
 * with manage_subjects (subjects).
 */
export function useClassesAccess() {
  const { user, isLoading } = useAuth();
  const roles = (
    [user?.role, ...(user?.roles ?? []).map((r: { name?: string } | string) => (typeof r === 'string' ? r : r?.name))]
      .filter(Boolean) as string[]
  ).map((r) => r.toLowerCase());
  const permissions = new Set(user?.permissions ?? []);
  const isAdmin = roles.some((r) => ADMIN_ROLES.includes(r));
  return {
    isLoading,
    canManageClasses: isAdmin || permissions.has('manage_classes'),
    canManageSubjects: isAdmin || permissions.has('manage_subjects'),
  };
}

/** A mutation that refreshes the given lists and the year setup wizard when it succeeds. */
function useClassesMutation<TVars, TResult>(
  mutationFn: (vars: TVars) => Promise<TResult>,
  keys: (school: string | null) => QueryKey[]
) {
  const qc = useQueryClient();
  const school = useSchoolKey();
  return useMutation({
    mutationFn,
    onSuccess: () =>
      Promise.all(
        [...keys(school), yearSetupKeys.all(school)].map((queryKey) => qc.invalidateQueries({ queryKey }))
      ),
  });
}

// ---- School years ----

/** The school's years, and the current one (or the first) to start with. */
export function useSchoolYears() {
  const query = useAcademicYearsList();
  const years = useMemo(() => query.data ?? [], [query.data]);
  const current = years.find((y) => y.is_current) ?? years[0] ?? null;
  return { ...query, years, current };
}

// ---- Grade levels ----

/** Grade levels in their order (sequence). */
export function useGradeLevels() {
  const service = useAcademicGradeService();
  const school = useSchoolKey();
  return useQuery({
    queryKey: gradeKeys.list(school, false),
    queryFn: () => service.getAllGrades(),
    enabled: Boolean(school),
    select: (list: AcademicGrade[]) => [...(list ?? [])].sort((a, b) => a.sequence - b.sequence),
  });
}

const gradeLevelLists = (school: string | null) => [gradeKeys.all(school), enrollmentKeys.grades(school)];

export function useCreateGradeLevel() {
  const service = useAcademicGradeService();
  return useClassesMutation((data: AcademicGradeCreate) => service.createGrade(data), gradeLevelLists);
}

export function useUpdateGradeLevel() {
  const service = useAcademicGradeService();
  return useClassesMutation(
    ({ id, data }: { id: string; data: AcademicGradeUpdate }) => service.updateGrade(id, data),
    gradeLevelLists
  );
}

export function useDeleteGradeLevel() {
  const service = useAcademicGradeService();
  return useClassesMutation((id: string) => service.deleteGrade(id), gradeLevelLists);
}

// ---- Sections ----

/** Every section of the school (all grade levels). */
export function useSections() {
  const service = useSectionService();
  const school = useSchoolKey();
  return useQuery({
    queryKey: sectionKeys.lists(school),
    queryFn: () => service.getSections(),
    enabled: Boolean(school),
    select: (res): Section[] => res?.sections ?? [],
  });
}

/** The active sections of one grade level. */
export function useGradeSections(gradeId: string) {
  const service = useSectionService();
  const school = useSchoolKey();
  return useQuery({
    queryKey: sectionKeys.byGrade(school, gradeId),
    queryFn: () => service.getSectionsByGrade(gradeId),
    enabled: Boolean(school && gradeId),
  });
}

const sectionLists = (school: string | null) => [sectionKeys.all(school), enrollmentKeys.sections(school)];

export function useCreateSection() {
  const service = useSectionService();
  return useClassesMutation((data: SectionCreate) => service.createSection(data), sectionLists);
}

export function useUpdateSection() {
  const service = useSectionService();
  return useClassesMutation(
    ({ id, data }: { id: string; data: SectionUpdate }) => service.updateSection(id, data),
    sectionLists
  );
}

export function useDeleteSection() {
  const service = useSectionService();
  return useClassesMutation((id: string) => service.deleteSection(id), sectionLists);
}

// ---- Subjects ----

/** Every subject of the school, active or not. */
export function useSubjects() {
  return useSubjectList(false);
}

const subjectLists = (school: string | null) => [subjectKeys.all(school)];

export function useCreateSubject() {
  const service = useSubjectService();
  return useClassesMutation((data: SubjectCreate) => service.createSubject(data), subjectLists);
}

export function useUpdateSubject() {
  const service = useSubjectService();
  return useClassesMutation(
    ({ id, data }: { id: string; data: SubjectUpdate }) => service.updateSubject(id, data),
    subjectLists
  );
}

export function useDeleteSubject() {
  const service = useSubjectService();
  return useClassesMutation((id: string) => service.deleteSubject(id), subjectLists);
}

// ---- Classes of a year ----

/** A class as the list endpoint returns it (with names and its subjects). */
export type YearClassRow = Class & {
  class_teacher_name?: string | null;
  subjects?: unknown[];
};

/** "Grade 1 - A", or the name the school gave the class. */
export function className(c: Pick<Class, 'name' | 'grade_name' | 'section_name'>): string {
  return c.name || [c.grade_name, c.section_name].filter(Boolean).join(' - ') || 'Unnamed class';
}

/** The classes of one school year (the request fails loudly, unlike the class service's list). */
export function useYearClasses(yearId: string) {
  const service = useStudentRecordsService();
  const school = useSchoolKey();
  return useQuery({
    queryKey: classKeys.list(school, { academic_year_id: yearId }),
    queryFn: () => service.getYearClasses(yearId) as Promise<YearClassRow[]>,
    enabled: Boolean(school && yearId),
  });
}

/** Active students in each class for the year, by class id (undefined while loading). */
export function useClassEnrollmentCounts(classIds: string[], yearId: string) {
  const service = useClassService();
  const school = useSchoolKey();
  const results = useQueries({
    queries: classIds.map((id) => ({
      queryKey: [...classKeys.enrollments(school, id), yearId, 'count'],
      queryFn: () => service.getClassEnrollmentCount(id, { academic_year_id: yearId, is_active: true }),
      enabled: Boolean(school && id && yearId),
      staleTime: 30_000,
    })),
  });
  const counts: Record<string, number | undefined> = {};
  classIds.forEach((id, i) => {
    counts[id] = results[i]?.data;
  });
  return counts;
}

const classLists = (school: string | null) => [classKeys.all(school), ['students-area', school]];

export function useCreateClass() {
  const service = useClassService();
  return useClassesMutation((data: ClassCreate) => service.createClass(data), classLists);
}

export function useUpdateClass() {
  const service = useClassService();
  return useClassesMutation(
    ({ id, data }: { id: string; data: ClassUpdate }) => service.updateClass(id, data),
    classLists
  );
}

export function useDeleteClass() {
  const service = useClassService();
  return useClassesMutation((id: string) => service.deleteClass(id), classLists);
}
