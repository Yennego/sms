// TanStack Query hooks for results, report cards and grading settings. Every key starts with the
// school, so switching schools never shows another school's results.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useTenant } from '@/hooks/use-tenant';
import { useResultsService, type ResultScope } from '@/services/api/results-service';

export const resultsKeys = {
  all: (school: string | null) => ['results', school] as const,
  settings: (school: string | null) => [...resultsKeys.all(school), 'settings'] as const,
  classCards: (school: string | null, classId: string, yearId: string) =>
    [...resultsKeys.all(school), 'report-cards', 'class', classId, yearId] as const,
  studentCard: (school: string | null, studentId: string, yearId: string) =>
    [...resultsKeys.all(school), 'report-cards', 'student', studentId, yearId] as const,
  publications: (school: string | null, yearId: string) =>
    [...resultsKeys.all(school), 'publications', yearId] as const,
  progressAll: (school: string | null) => [...resultsKeys.all(school), 'progress'] as const,
  progress: (school: string | null, classId: string, scope: ResultScope) =>
    [...resultsKeys.progressAll(school), classId, scope.period_id ?? null, scope.semester_id ?? null] as const,
};

export function useSchoolKey() {
  return useTenant().tenantKey;
}

const noRetryOnClientErrors = (count: number, error: unknown) => {
  const status = (error as { statusCode?: number })?.statusCode;
  return !(status && status >= 400 && status < 500) && count < 2;
};

export function useGradingSettings() {
  const service = useResultsService();
  const school = useSchoolKey();
  return useQuery({
    queryKey: resultsKeys.settings(school),
    queryFn: () => service.getSettings(),
    enabled: Boolean(school),
    retry: noRetryOnClientErrors,
  });
}

export function useSaveGradingSettings() {
  const service = useResultsService();
  const school = useSchoolKey();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (passMark: number) => service.updateSettings({ pass_mark: passMark }),
    onSuccess: (data) => {
      qc.setQueryData(resultsKeys.settings(school), data);
      // Report cards show the pass mark and highlight failing grades with it.
      qc.invalidateQueries({ queryKey: [...resultsKeys.all(school), 'report-cards'] });
    },
  });
}

export function useClassReportCards(classId: string | undefined, yearId: string | undefined) {
  const service = useResultsService();
  const school = useSchoolKey();
  return useQuery({
    queryKey: resultsKeys.classCards(school, classId ?? '', yearId ?? ''),
    queryFn: () => service.getClassReportCards(classId as string, yearId as string),
    enabled: Boolean(school && classId && yearId),
    staleTime: 60 * 1000,
    retry: noRetryOnClientErrors,
  });
}

export function useStudentReportCard(studentId: string | undefined, yearId: string | undefined) {
  const service = useResultsService();
  const school = useSchoolKey();
  return useQuery({
    queryKey: resultsKeys.studentCard(school, studentId ?? '', yearId ?? ''),
    queryFn: () => service.getStudentReportCard(studentId as string, yearId as string),
    enabled: Boolean(school && studentId && yearId),
    staleTime: 60 * 1000,
    retry: noRetryOnClientErrors,
  });
}
