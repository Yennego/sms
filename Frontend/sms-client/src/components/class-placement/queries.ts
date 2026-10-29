// TanStack Query hooks for the roster and class placement. Every key starts with the school,
// so switching schools never shows another school's students.
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useTenant } from '@/hooks/use-tenant';
import {
  useClassPlacementService,
  type PlacementClass,
  type RosterParams,
} from '@/services/api/class-placement-service';

export const classPlacementKeys = {
  all: (school: string | null) => ['class-placement', school] as const,
  roster: (school: string | null, params: RosterParams) =>
    [...classPlacementKeys.all(school), 'roster', params] as const,
  yearClasses: (school: string | null, yearId: string) =>
    [...classPlacementKeys.all(school), 'year-classes', yearId] as const,
};

export function useSchool() {
  const { tenantKey } = useTenant();
  return tenantKey;
}

/** One page of the roster. Keeps the previous page on screen while the next one loads. */
export function useRoster(params: RosterParams) {
  const service = useClassPlacementService();
  const school = useSchool();
  return useQuery({
    queryKey: classPlacementKeys.roster(school, params),
    queryFn: () => service.getRoster(params),
    enabled: Boolean(school),
    placeholderData: keepPreviousData,
    staleTime: 30 * 1000,
    retry: (count, error) => {
      const status = (error as { statusCode?: number })?.statusCode;
      return status !== 404 && status !== 403 && status !== 422 && count < 2;
    },
  });
}

/** Classes of a school year, sorted by name ("Grade 2 - A" before "Grade 10 - A"). */
export function useYearClasses(yearId: string | undefined) {
  const service = useClassPlacementService();
  const school = useSchool();
  return useQuery({
    queryKey: classPlacementKeys.yearClasses(school, yearId ?? ''),
    queryFn: async () => {
      const classes = await service.getYearClasses(yearId as string);
      return classes
        .filter((c) => c.is_active !== false)
        .sort((a, b) => className(a).localeCompare(className(b), undefined, { numeric: true }));
    },
    enabled: Boolean(school && yearId),
    staleTime: 5 * 60 * 1000,
  });
}

export function usePlaceStudents() {
  const service = useClassPlacementService();
  const school = useSchool();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ classId, studentIds }: { classId: string; studentIds: string[] }) =>
      service.place(classId, studentIds),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: classPlacementKeys.all(school) });
      // Student profiles and the older Students-area caches show enrollments too.
      qc.invalidateQueries({ queryKey: ['students-area', school] });
    },
  });
}

export function className(c: Pick<PlacementClass, 'name' | 'grade_name' | 'section_name'>): string {
  if (c.name) return c.name;
  return [c.grade_name, c.section_name].filter(Boolean).join(' - ') || 'Unnamed class';
}
