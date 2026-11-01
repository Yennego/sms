'use client';

// TanStack Query hooks for the year setup wizard. Every key starts with the school (tenantKey),
// so switching schools never shows another school's data.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format, parseISO, isValid } from 'date-fns';

import { useTenant } from '@/hooks/use-tenant';
import { AppError } from '@/utils/error-utils';
import {
  useYearSetupService,
  type ApplySubjectsPayload,
  type CopyFromOptions,
  type YearSetup,
} from '@/services/api/year-setup-service';

export const yearSetupKeys = {
  all: (school: string | null) => ['yearSetup', school] as const,
  year: (school: string | null, yearId: string) => ['yearSetup', school, 'year', yearId] as const,
  teachers: (school: string | null) => ['yearSetup', school, 'teachers'] as const,
  subjects: (school: string | null) => ['yearSetup', school, 'subjects'] as const,
};

/** A plain sentence for a failed request. The API's `detail` already says what to fix. */
export function errorText(error: unknown, fallback: string): string {
  if (error instanceof AppError) {
    if (error.statusCode === 403) return "Your role can't do this. Ask your school administrator.";
    if (error.statusCode === 404) return 'This page could not find what it needs. Reload the page and try again.';
    if (error.statusCode && error.statusCode >= 500) return `${fallback} Try again in a minute.`;
    if (error.message) return error.message;
  }
  return fallback;
}

/** "Mon 20 Oct 2026" (design brief §7). */
export function formatDate(value?: string | null): string {
  if (!value) return '-';
  const d = parseISO(value);
  return isValid(d) ? format(d, 'EEE d MMM yyyy') : value;
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

export function useYearSetup(yearId: string | null) {
  const service = useYearSetupService();
  const { tenantKey } = useTenant();
  return useQuery({
    queryKey: yearSetupKeys.year(tenantKey, yearId ?? 'none'),
    queryFn: () => service.getYearSetup(yearId as string),
    enabled: Boolean(yearId),
    retry: (count, error) => !(error instanceof AppError && error.statusCode && error.statusCode < 500) && count < 2,
  });
}

export function useTeacherOptions() {
  const service = useYearSetupService();
  const { tenantKey } = useTenant();
  return useQuery({
    queryKey: yearSetupKeys.teachers(tenantKey),
    queryFn: () => service.listTeachers(),
    staleTime: 60_000,
  });
}

export function useSubjectOptions() {
  const service = useYearSetupService();
  const { tenantKey } = useTenant();
  return useQuery({
    queryKey: yearSetupKeys.subjects(tenantKey),
    queryFn: () => service.listSubjects(),
    staleTime: 60_000,
  });
}

/**
 * Wraps a mutation for one year: on success it can patch the cached wizard data with what the
 * endpoint returned, then refetches so every step's `complete` flag comes from the server.
 */
function useYearMutation<TVars, TResult>(
  yearId: string,
  mutationFn: (vars: TVars) => Promise<TResult>,
  patch?: (data: YearSetup, result: TResult, vars: TVars) => YearSetup,
) {
  const queryClient = useQueryClient();
  const { tenantKey } = useTenant();
  const key = yearSetupKeys.year(tenantKey, yearId);
  return useMutation({
    mutationFn,
    onSuccess: (result, vars) => {
      if (patch) {
        queryClient.setQueryData<YearSetup>(key, (old) => (old ? patch(old, result, vars) : old));
      }
      return queryClient.invalidateQueries({ queryKey: key });
    },
  });
}

export function useYearSetupMutations(yearId: string) {
  const service = useYearSetupService();

  const createDefaultTerms = useYearMutation(yearId, () => service.createDefaultTerms(yearId),
    (data, terms) => ({ ...data, steps: { ...data.steps, terms } }));

  const copyFrom = useYearMutation(yearId,
    (vars: { sourceYearId: string; options: CopyFromOptions }) => service.copyFrom(yearId, vars.sourceYearId, vars.options));

  const generateClasses = useYearMutation(yearId, (gradeIds?: string[]) => service.generateClasses(yearId, gradeIds),
    (data, classes) => ({ ...data, steps: { ...data.steps, classes } }));

  const setSponsor = useYearMutation(yearId,
    (vars: { classId: string; teacherId: string | null }) => service.setSponsor(vars.classId, vars.teacherId),
    (data, row) => ({
      ...data,
      steps: {
        ...data.steps,
        classes: {
          ...data.steps.classes,
          classes: data.steps.classes.classes.map((c) => (c.id === row.id ? { ...c, ...row } : c)),
        },
      },
    }));

  const applySubjects = useYearMutation(yearId, (payload: ApplySubjectsPayload) => service.applySubjects(yearId, payload),
    (data, subjects) => ({ ...data, steps: { ...data.steps, subjects } }));

  const setSubjectTeacher = useYearMutation(yearId,
    (vars: { classSubjectId: string; teacherId: string | null }) => service.setSubjectTeacher(vars.classSubjectId, vars.teacherId),
    (data, row) => ({
      ...data,
      steps: {
        ...data.steps,
        subjects: {
          ...data.steps.subjects,
          classes: data.steps.subjects.classes.map((c) => ({
            ...c,
            subjects: c.subjects.map((s) => (s.class_subject_id === row.class_subject_id ? { ...s, ...row } : s)),
          })),
        },
      },
    }));

  const updateTermDates = useYearMutation(yearId,
    (vars: { kind: 'semester' | 'period'; id: string; start_date: string; end_date: string }) => {
      const dates = { start_date: vars.start_date, end_date: vars.end_date };
      return vars.kind === 'semester' ? service.updateSemesterDates(vars.id, dates) : service.updatePeriodDates(vars.id, dates);
    });

  const createLevel = useYearMutation(yearId, (vars: { name: string; sequence: number }) => service.createLevel(vars));

  const createSection = useYearMutation(yearId,
    (vars: { grade_id: string; name: string; capacity: number }) => service.createSection(vars));

  return {
    createDefaultTerms,
    copyFrom,
    generateClasses,
    setSponsor,
    applySubjects,
    setSubjectTeacher,
    updateTermDates,
    createLevel,
    createSection,
  };
}

export type YearSetupMutations = ReturnType<typeof useYearSetupMutations>;
