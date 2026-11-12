'use client';

// TanStack Query hooks for the year-end tools: enrollments, promotion and remedial work. Every key
// starts with the school. Enrollment, student and section lists share their keys with the older
// hooks in `@/hooks/queries`, so a change made here refreshes those screens too.
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { classPlacementKeys } from '@/components/class-placement/queries';
import { studentAreaKeys, useSchoolKey } from '@/components/students/queries';
import { enrollmentKeys } from '@/hooks/queries/enrollments';
import { sectionKeys } from '@/hooks/queries/sections';
import { studentKeys } from '@/hooks/queries/students';
import { useClassService } from '@/services/api/class-service';
import { useEnrollmentService } from '@/services/api/enrollment-service';
import { usePromotionService } from '@/services/api/promotion-service';
import { useSectionService } from '@/services/api/section-service';
import { useStudentService } from '@/services/api/student-service';
import type { BulkEnrollmentCreate, EnrollmentCreate, EnrollmentFilters, EnrollmentUpdate } from '@/types/enrollment';
import type { StudentCreate } from '@/types/student';

export const yearEndKeys = {
  all: (school: string | null) => ['year-end', school] as const,
  evaluation: (school: string | null, yearId: string, gradeId: string, sectionId: string) =>
    [...yearEndKeys.all(school), 'evaluation', yearId, gradeId, sectionId] as const,
  remedial: (school: string | null) => [...yearEndKeys.all(school), 'remedial'] as const,
  remedialSessions: (school: string | null) => [...yearEndKeys.remedial(school), 'sessions'] as const,
  atRisk: (school: string | null, yearId: string) => [...yearEndKeys.remedial(school), 'at-risk', yearId] as const,
  capacity: (school: string | null, yearId: string, gradeId: string, sectionId: string) =>
    [...yearEndKeys.all(school), 'capacity', yearId, gradeId, sectionId] as const,
};

/** A student whose subject grade is below the pass mark and who has no remedial session yet. */
export interface AtRiskItem {
  student_id: string;
  student_name?: string;
  subject_id: string;
  subject_name?: string;
  current_grade: number;
  passing_mark: number;
  enrollment_id: string;
}

export interface RemedialSessionRow {
  id: string;
  student_id?: string;
  enrollment_id?: string;
  student_name?: string | null;
  subject_name?: string | null;
  scheduled_date: string;
  status: string;
  new_score?: number | null;
  passed?: boolean | null;
}

/** Refresh everything a change of enrollment, promotion or remedial work can show up in. */
export function useRefreshYearEnd() {
  const school = useSchoolKey();
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: enrollmentKeys.all(school) });
    qc.invalidateQueries({ queryKey: studentAreaKeys.all(school) });
    qc.invalidateQueries({ queryKey: classPlacementKeys.all(school) });
    qc.invalidateQueries({ queryKey: yearEndKeys.all(school) });
  };
}

// --- Enrollments ---------------------------------------------------------------------------------

export function useEnrollmentList(skip: number, limit: number, filters: EnrollmentFilters) {
  const service = useEnrollmentService();
  const school = useSchoolKey();
  return useQuery({
    queryKey: enrollmentKeys.list(school, skip, limit, filters),
    queryFn: () => service.getEnrollments(skip, limit, filters),
    enabled: Boolean(school),
    placeholderData: keepPreviousData,
  });
}

export function useSchoolYears() {
  const service = useEnrollmentService();
  const school = useSchoolKey();
  return useQuery({
    queryKey: enrollmentKeys.academicYears(school),
    queryFn: () => service.getAcademicYears(),
    enabled: Boolean(school),
    staleTime: 60 * 60 * 1000,
  });
}

export function useCurrentSchoolYear() {
  const service = useEnrollmentService();
  const school = useSchoolKey();
  return useQuery({
    queryKey: [...enrollmentKeys.all(school), 'current-year'],
    queryFn: () => service.getCurrentAcademicYear(),
    enabled: Boolean(school),
    staleTime: 60 * 60 * 1000,
  });
}

export function useGradeLevels() {
  const service = useEnrollmentService();
  const school = useSchoolKey();
  return useQuery({
    queryKey: enrollmentKeys.grades(school),
    queryFn: () => service.getGrades(),
    enabled: Boolean(school),
    staleTime: 30 * 60 * 1000,
  });
}

export function useAllSections() {
  const service = useEnrollmentService();
  const school = useSchoolKey();
  return useQuery({
    queryKey: enrollmentKeys.sections(school),
    queryFn: () => service.getSections(),
    enabled: Boolean(school),
    staleTime: 30 * 60 * 1000,
  });
}

export function useSectionsOfGrade(gradeId: string) {
  const service = useSectionService();
  const school = useSchoolKey();
  return useQuery({
    queryKey: sectionKeys.byGrade(school, gradeId),
    queryFn: () => service.getSectionsByGrade(gradeId),
    enabled: Boolean(school && gradeId),
  });
}

/** Students to pick from when enrolling (the first 1000). */
export function useStudentChoices() {
  const service = useStudentService();
  const school = useSchoolKey();
  return useQuery({
    queryKey: [...studentKeys.lists(school), 'paged', { skip: 0, limit: 1000 }],
    queryFn: () => service.getStudentsPaged(0, 1000),
    enabled: Boolean(school),
    staleTime: 5 * 60 * 1000,
  });
}

/** The class for a year, grade and section, and how many students are in it. */
export function useClassCapacity(yearId: string, gradeId: string, sectionId: string) {
  const classService = useClassService();
  const school = useSchoolKey();
  return useQuery({
    queryKey: yearEndKeys.capacity(school, yearId, gradeId, sectionId),
    queryFn: async () => {
      const classes = await classService.getClasses({
        academic_year_id: yearId,
        grade_id: gradeId,
        section_id: sectionId,
        is_active: true,
      });
      if (classes.length === 0) return null;
      const cls = classes[0];
      const count = await classService.getClassEnrollmentCount(cls.id, { academic_year_id: yearId, is_active: true });
      return { capacity: cls.capacity || 30, count };
    },
    enabled: Boolean(school && yearId && gradeId && sectionId),
  });
}

export function useCreateEnrollment() {
  const service = useEnrollmentService();
  const refresh = useRefreshYearEnd();
  return useMutation({ mutationFn: (data: EnrollmentCreate) => service.createEnrollment(data), onSuccess: refresh });
}

export function useUpdateEnrollment() {
  const service = useEnrollmentService();
  const refresh = useRefreshYearEnd();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: EnrollmentUpdate }) => service.updateEnrollment(id, data),
    onSuccess: refresh,
  });
}

export function useDeleteEnrollment() {
  const service = useEnrollmentService();
  const refresh = useRefreshYearEnd();
  return useMutation({ mutationFn: (id: string) => service.deleteEnrollment(id), onSuccess: refresh });
}

export function useBulkCreateEnrollments() {
  const service = useEnrollmentService();
  const refresh = useRefreshYearEnd();
  return useMutation({
    mutationFn: (data: BulkEnrollmentCreate) => service.bulkCreateEnrollments(data),
    onSuccess: refresh,
  });
}

/** Mark an enrollment transferred (the student leaves for another school). */
export function useTransferEnrollment() {
  const service = useEnrollmentService();
  const refresh = useRefreshYearEnd();
  return useMutation({
    mutationFn: (vars: { id: string; date: string; reason?: string; school?: string }) =>
      service.updateEnrollmentStatus(vars.id, 'transferred', vars.date, vars.reason, vars.school),
    onSuccess: refresh,
  });
}

/** Promote one enrollment to the next grade in the given school year. */
export function usePromoteEnrollment() {
  const service = usePromotionService();
  const refresh = useRefreshYearEnd();
  return useMutation({
    mutationFn: (vars: { id: string; targetYearName: string }) =>
      service.promoteEnrollment(vars.id, { promotion_type: 'grade', target_academic_year: vars.targetYearName }),
    onSuccess: refresh,
  });
}

/**
 * Create a student, then look for the enrollment the server may have made for them already
 * (the student is then enrolled and nothing else is created).
 */
export function useCreateStudentForEnrollment() {
  const students = useStudentService();
  const enrollments = useEnrollmentService();
  const school = useSchoolKey();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: StudentCreate) => {
      const student = await students.createStudent(data);
      const autoEnrollment = await enrollments.getCurrentEnrollment(student.id);
      return { student, autoEnrollment };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: studentKeys.lists(school) });
      qc.invalidateQueries({ queryKey: enrollmentKeys.all(school) });
    },
  });
}

export function useCreateStudentsBulk() {
  const service = useStudentService();
  const school = useSchoolKey();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: StudentCreate[]) => service.createStudentsBulk(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: studentKeys.lists(school) }),
  });
}

// --- Promotion -----------------------------------------------------------------------------------

export interface EvaluationParams {
  yearId: string;
  gradeId: string;
  /** "all" or a section id */
  sectionId: string;
}

/** Who passed, who is conditional and who repeats, for a year and grade. Runs once `params` is set. */
export function usePromotionEvaluation(params: EvaluationParams | null) {
  const service = usePromotionService();
  const school = useSchoolKey();
  return useQuery({
    queryKey: yearEndKeys.evaluation(school, params?.yearId ?? '', params?.gradeId ?? '', params?.sectionId ?? ''),
    queryFn: async () => (await service.evaluatePromotion(params!.yearId, params!.gradeId, params!.sectionId)) || [],
    enabled: Boolean(school && params),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    retry: false,
  });
}

export function useApplyScaling() {
  const service = usePromotionService();
  const school = useSchoolKey();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { enrollmentId: string; points: number }) =>
      service.applyScaling(vars.enrollmentId, vars.points, 'Manual adjustment via dashboard'),
    onSuccess: () => qc.invalidateQueries({ queryKey: [...yearEndKeys.all(school), 'evaluation'] }),
  });
}

/** Year-end transition: passed students move up, failed ones repeat with remedial work. */
export function useStartTransition() {
  const service = usePromotionService();
  const refresh = useRefreshYearEnd();
  return useMutation({
    mutationFn: (vars: { yearId: string; targetYearName: string; gradeId: string }) =>
      service.startTransition(vars.yearId, vars.targetYearName, vars.gradeId),
    onSuccess: refresh,
  });
}

// --- Remedial ------------------------------------------------------------------------------------

export function useRemedialSessions() {
  const service = usePromotionService();
  const school = useSchoolKey();
  return useQuery({
    queryKey: yearEndKeys.remedialSessions(school),
    queryFn: async () => ((await service.getAllRemedialSessions(0, 50)) || []) as RemedialSessionRow[],
    enabled: Boolean(school),
  });
}

export function useAtRiskStudents(yearId: string) {
  const service = usePromotionService();
  const school = useSchoolKey();
  return useQuery({
    queryKey: yearEndKeys.atRisk(school, yearId),
    queryFn: async () => ((await service.identifyAtRisk(yearId)) || []) as AtRiskItem[],
    enabled: Boolean(school && yearId),
  });
}

export function useScheduleRemedial() {
  const service = usePromotionService();
  const school = useSchoolKey();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { enrollmentId: string; subjectId: string }) =>
      service.createRemedialSessions(vars.enrollmentId, [vars.subjectId]),
    onSuccess: () => qc.invalidateQueries({ queryKey: yearEndKeys.remedial(school) }),
  });
}

