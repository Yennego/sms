// TanStack Query hooks for the gradebook. Every key starts with the school, so switching schools
// never shows another school's marks. Mutations invalidate the sheet; the server computes period
// scores, so the browser always refetches instead of patching numbers itself.
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useTenant } from '@/hooks/use-tenant';
import {
  errorStatus,
  useGradebookService,
  type AssessmentCreate,
  type AssessmentInput,
  type GradebookClassSubject,
  type ScoreEntryInput,
  type SheetTarget,
} from '@/services/api/gradebook-service';

export const gradebookKeys = {
  all: (school: string | null) => ['gradebook', school] as const,
  year: (school: string | null) => [...gradebookKeys.all(school), 'current-year'] as const,
  terms: (school: string | null, yearId: string) => [...gradebookKeys.all(school), 'terms', yearId] as const,
  classSubjects: (school: string | null, yearId: string) =>
    [...gradebookKeys.all(school), 'class-subjects', yearId] as const,
  sheets: (school: string | null) => [...gradebookKeys.all(school), 'sheet'] as const,
  sheet: (school: string | null, target: SheetTarget | null) => [...gradebookKeys.sheets(school), target] as const,
};

function useSchool() {
  return useTenant().tenantKey;
}

const noRetryOnClientError = (count: number, error: unknown) => {
  const status = errorStatus(error);
  return !(status && status >= 400 && status < 500) && count < 2;
};

export function classLabel(s: Pick<GradebookClassSubject, 'class_name'>): string {
  return s.class_name || 'Unnamed class';
}

export function subjectLabel(s: GradebookClassSubject): string {
  return s.subject_name || 'Unnamed subject';
}

export function useCurrentYear() {
  const service = useGradebookService();
  const school = useSchool();
  return useQuery({
    queryKey: gradebookKeys.year(school),
    queryFn: async () => {
      try {
        return await service.getCurrentYear();
      } catch (error) {
        if (errorStatus(error) === 404) return null;
        throw error;
      }
    },
    enabled: Boolean(school),
    staleTime: 5 * 60 * 1000,
    retry: noRetryOnClientError,
  });
}

/** Semesters and periods of the year. */
export function useTerms(yearId: string | undefined) {
  const service = useGradebookService();
  const school = useSchool();
  return useQuery({
    queryKey: gradebookKeys.terms(school, yearId ?? ''),
    queryFn: () => service.getTerms(yearId as string),
    enabled: Boolean(school && yearId),
    staleTime: 5 * 60 * 1000,
    retry: noRetryOnClientError,
  });
}

/** The class subjects this user may view this year, sorted by class then subject. */
export function useClassSubjects(yearId: string | undefined) {
  const service = useGradebookService();
  const school = useSchool();
  return useQuery({
    queryKey: gradebookKeys.classSubjects(school, yearId ?? ''),
    queryFn: async () => {
      const subjects = await service.getClassSubjects(yearId as string);
      return subjects.sort(
        (a, b) =>
          classLabel(a).localeCompare(classLabel(b), undefined, { numeric: true }) ||
          subjectLabel(a).localeCompare(subjectLabel(b))
      );
    },
    enabled: Boolean(school && yearId),
    staleTime: 5 * 60 * 1000,
    retry: noRetryOnClientError,
  });
}

export function useSheet(target: SheetTarget | null) {
  const service = useGradebookService();
  const school = useSchool();
  return useQuery({
    queryKey: gradebookKeys.sheet(school, target),
    queryFn: () => service.getSheet(target as SheetTarget),
    enabled: Boolean(school && target),
    placeholderData: (previous, previousQuery) => {
      // Keep the old grid only while refetching the same sheet, never across pickers.
      const prevTarget = previousQuery?.queryKey?.[3] as SheetTarget | null | undefined;
      return prevTarget && target && JSON.stringify(prevTarget) === JSON.stringify(target)
        ? keepPreviousData(previous)
        : undefined;
    },
    staleTime: 15 * 1000,
    retry: noRetryOnClientError,
  });
}

function useInvalidateSheets() {
  const qc = useQueryClient();
  const school = useSchool();
  return () => qc.invalidateQueries({ queryKey: gradebookKeys.sheets(school) });
}

export function useCreateAssessment() {
  const service = useGradebookService();
  const invalidate = useInvalidateSheets();
  return useMutation({
    mutationFn: (payload: AssessmentCreate) => service.createAssessment(payload),
    onSuccess: () => invalidate(),
  });
}

export function useUpdateAssessment() {
  const service = useGradebookService();
  const invalidate = useInvalidateSheets();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: AssessmentInput }) => service.updateAssessment(id, payload),
    onSuccess: () => invalidate(),
  });
}

export function useDeleteAssessment() {
  const service = useGradebookService();
  const invalidate = useInvalidateSheets();
  return useMutation({
    mutationFn: ({ id, force }: { id: string; force: boolean }) => service.deleteAssessment(id, force),
    onSuccess: () => invalidate(),
  });
}

/** Saves one column. The caller invalidates the sheet once after all columns are sent. */
export function useSaveScores() {
  const service = useGradebookService();
  return useMutation({
    mutationFn: ({ assessmentId, entries }: { assessmentId: string; entries: ScoreEntryInput[] }) =>
      service.saveScores(assessmentId, entries),
  });
}

export function useRefreshSheets() {
  return useInvalidateSheets();
}
