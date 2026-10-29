// Roster (server-paged) and class placement: /academics/class-placement (phase3-api.md section 3).
// The server filters, searches, sorts and pages; the browser only ever holds one page.
import { useMemo } from 'react';

import { createWaitForApiClientReady, useApiClientWithLoading } from './api-client';

export type RosterPlacement = 'all' | 'placed' | 'unplaced';
export type RosterSort = 'name' | 'admission_number' | 'class';

export interface RosterParams {
  academicYearId?: string;
  placement?: RosterPlacement;
  classId?: string;
  /** Omit for the server default (active). Empty string = every status. */
  studentStatus?: string;
  q?: string;
  sort?: RosterSort;
  page?: number;
  pageSize?: number;
}

export interface RosterEnrollment {
  id: string;
  class_id: string | null;
  class_name: string | null;
  grade_id: string | null;
  grade_name: string | null;
  section_id: string | null;
  section_name: string | null;
  status: string;
}

export interface RosterStudent {
  student_id: string;
  name: string;
  first_name: string;
  last_name: string;
  username: string | null;
  email: string | null;
  admission_number: string | null;
  student_status: string | null;
  /** null when the student has no class this year. */
  enrollment: RosterEnrollment | null;
}

export interface RosterPage {
  /** Null when the school has no current year: everyone is listed as not placed */
  academic_year: { id: string; name: string } | null;
  items: RosterStudent[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
  counts: { all: number; placed: number; unplaced: number };
}

export interface PlacementClass {
  id: string;
  name?: string | null;
  academic_year_id: string;
  grade_id: string;
  section_id: string;
  grade_name?: string | null;
  section_name?: string | null;
  capacity?: number | null;
  is_active?: boolean;
}

export interface PlacementResult {
  placed: number;
  moved: number;
  unchanged: number;
  class_id: string;
  class_name: string;
  enrolled: number;
  capacity: number | null;
  over_capacity: boolean;
}

export interface PlacementProblem {
  student_id: string;
  name?: string | null;
  detail: string;
}

/** Most students one placement request may carry. */
export const MAX_PLACEMENT_BATCH = 200;

export function rosterQueryString(params: RosterParams): string {
  const qs = new URLSearchParams();
  if (params.academicYearId) qs.set('academic_year_id', params.academicYearId);
  if (params.placement && params.placement !== 'all') qs.set('placement', params.placement);
  if (params.classId) qs.set('class_id', params.classId);
  // Empty string is meaningful (everyone), so only skip undefined.
  if (params.studentStatus !== undefined) qs.set('student_status', params.studentStatus);
  const q = params.q?.trim();
  if (q) qs.set('q', q.slice(0, 100));
  if (params.sort) qs.set('sort', params.sort);
  qs.set('page', String(params.page ?? 1));
  qs.set('page_size', String(params.pageSize ?? 25));
  return qs.toString();
}

/** The 409 answer of a placement ("nothing was saved"), or null for any other error. */
export function placementConflict(error: unknown): { message: string; problems: PlacementProblem[] } | null {
  if (!error || typeof error !== 'object') return null;
  const err = error as { statusCode?: number; message?: string; originalError?: unknown };
  if (err.statusCode !== 409) return null;
  const response = (err.originalError as { response?: { data?: unknown } } | undefined)?.response;
  let detail = (response?.data as { detail?: unknown } | undefined)?.detail;
  if (!detail && err.message?.startsWith('{')) {
    try {
      detail = JSON.parse(err.message);
    } catch {
      detail = undefined;
    }
  }
  if (detail && typeof detail === 'object') {
    const d = detail as { message?: string; problems?: PlacementProblem[] };
    return {
      message: d.message || 'No one was placed. Fix these students first.',
      problems: Array.isArray(d.problems) ? d.problems : [],
    };
  }
  return { message: typeof detail === 'string' ? detail : 'No one was placed. Fix these students first.', problems: [] };
}

export function useClassPlacementService() {
  const { apiClient } = useApiClientWithLoading();
  const waitForApiClientReady = useMemo(() => createWaitForApiClientReady(apiClient), [apiClient]);

  return useMemo(
    () => ({
      getRoster: async (params: RosterParams): Promise<RosterPage> => {
        const client = await waitForApiClientReady();
        return client.get<RosterPage>(`/academics/class-placement/roster?${rosterQueryString(params)}`);
      },

      /** Classes of one school year. */
      getYearClasses: async (academicYearId: string): Promise<PlacementClass[]> => {
        const client = await waitForApiClientReady();
        const resp = await client.get<PlacementClass[] | { items: PlacementClass[] }>(
          `/academics/classes?academic_year_id=${encodeURIComponent(academicYearId)}&skip=0&limit=500`
        );
        return Array.isArray(resp) ? resp : resp?.items ?? [];
      },

      /** All or nothing: a 409 means no one was placed (see placementConflict). */
      place: async (classId: string, studentIds: string[]): Promise<PlacementResult> => {
        const client = await waitForApiClientReady();
        return client.post<PlacementResult>('/academics/class-placement', {
          class_id: classId,
          student_ids: studentIds,
        });
      },
    }),
    [waitForApiClientReady]
  );
}
