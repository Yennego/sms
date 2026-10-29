// Queries for Review and publish: the year's results columns (periods and semester exams),
// each class's progress for a column, what is published, and publish / unpublish.
import { useMemo } from 'react';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';

import { structuralKeys, useSemesters } from '@/hooks/queries/semesters-periods';
import { usePeriodService, type Period } from '@/services/api/period-service';
import { useResultsService, type ClassProgress, type ResultScope } from '@/services/api/results-service';
import { resultsKeys, useSchoolKey } from '@/components/report-cards/queries';

/** One choosable results column. */
export interface ResultColumn {
  /** "p:<period id>" or "s:<semester id>" (used as the select value and in the URL). */
  key: string;
  scope: ResultScope;
  label: string;
  semesterId: string;
  semesterName: string;
  semesterNumber: number;
  /** Periods of the semester (for the "publish the periods first" hint). */
  start?: string;
  end?: string;
}

/** Periods and semester exams of a year, in order, grouped by semester. */
export function useResultColumns(yearId: string | undefined) {
  const school = useSchoolKey();
  const periodService = usePeriodService();
  const semestersQuery = useSemesters(yearId ?? null);
  const semesters = useMemo(
    () => [...(semestersQuery.data ?? [])].sort((a, b) => a.semester_number - b.semester_number),
    [semestersQuery.data]
  );

  const periodQueries = useQueries({
    queries: semesters.map((s) => ({
      queryKey: structuralKeys.periods(school, s.id),
      queryFn: () => periodService.getPeriods(s.id),
      enabled: Boolean(school),
      staleTime: 5 * 60 * 1000,
    })),
  });

  const periodsLoading = periodQueries.some((q) => q.isLoading);
  const periodData = periodQueries.map((q) => q.data);

  const columns = useMemo(() => {
    const out: ResultColumn[] = [];
    semesters.forEach((s, i) => {
      const periods = [...((periodData[i] as Period[] | undefined) ?? [])].sort(
        (a, b) => a.period_number - b.period_number
      );
      for (const p of periods) {
        out.push({
          key: `p:${p.id}`,
          scope: { period_id: p.id },
          label: p.name || `Period ${p.period_number}`,
          semesterId: s.id,
          semesterName: s.name || `Semester ${s.semester_number}`,
          semesterNumber: s.semester_number,
          start: p.start_date,
          end: p.end_date,
        });
      }
      out.push({
        key: `s:${s.id}`,
        scope: { semester_id: s.id },
        label: `${s.name || `Semester ${s.semester_number}`} exam and average`,
        semesterId: s.id,
        semesterName: s.name || `Semester ${s.semester_number}`,
        semesterNumber: s.semester_number,
        start: s.start_date,
        end: s.end_date,
      });
    });
    return out;
    // periodData is a new array each render; depend on its contents.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [semesters, ...periodData]);

  return {
    columns,
    isLoading: semestersQuery.isLoading || periodsLoading,
    error: semestersQuery.error ?? periodQueries.find((q) => q.error)?.error ?? null,
  };
}

export function usePublications(yearId: string | undefined) {
  const service = useResultsService();
  const school = useSchoolKey();
  return useQuery({
    queryKey: resultsKeys.publications(school, yearId ?? ''),
    queryFn: () => service.getPublications(yearId as string),
    enabled: Boolean(school && yearId),
    staleTime: 30 * 1000,
  });
}

/** Progress of every class for one column, fetched in parallel. */
export function useClassesProgress(classIds: string[], scope: ResultScope | undefined) {
  const service = useResultsService();
  const school = useSchoolKey();
  return useQueries({
    queries: classIds.map((classId) => ({
      queryKey: scope ? resultsKeys.progress(school, classId, scope) : ['results', school, 'progress', 'none'],
      queryFn: (): Promise<ClassProgress> => service.getClassProgress(classId, scope as ResultScope),
      enabled: Boolean(school && scope),
      staleTime: 30 * 1000,
      retry: (count: number, error: unknown) => {
        const status = (error as { statusCode?: number })?.statusCode;
        return !(status && status >= 400 && status < 500) && count < 2;
      },
    })),
  });
}

export function usePublishResults(yearId: string | undefined) {
  const service = useResultsService();
  const school = useSchoolKey();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ classId, scope, publish }: { classId: string; scope: ResultScope; publish: boolean }) =>
      publish ? service.publish(classId, scope) : service.unpublish(classId, scope),
    onSettled: (_data, _error, { classId, scope }) => {
      qc.invalidateQueries({ queryKey: resultsKeys.publications(school, yearId ?? '') });
      qc.invalidateQueries({ queryKey: resultsKeys.progress(school, classId, scope) });
      qc.invalidateQueries({ queryKey: [...resultsKeys.all(school), 'report-cards'] });
    },
  });
}
