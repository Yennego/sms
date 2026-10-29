// Gradebook: assessments and scores (phase4-design.md section 4, /academics/gradebook), plus the
// lookups the gradebook pickers need (current year, the class subjects this user may view,
// semesters and periods). Query strings are built into the URL because the API client's GET cache keys on the
// URL only.
import { useMemo } from 'react';

import { createWaitForApiClientReady, useApiClientWithLoading } from './api-client';

const BASE = '/academics/gradebook';

// ---------------------------------------------------------------------------------------------
// Types (contract: phase4-design.md section 4)
// ---------------------------------------------------------------------------------------------

export type AssessmentKind = 'test' | 'quiz' | 'assignment' | 'project' | 'participation' | 'exam' | 'other';

/** Kinds a teacher can add to a period (the exam belongs to the semester). */
export const PERIOD_KINDS: Exclude<AssessmentKind, 'exam'>[] = [
  'test',
  'quiz',
  'assignment',
  'project',
  'participation',
  'other',
];

export const KIND_LABELS: Record<AssessmentKind, string> = {
  test: 'Test',
  quiz: 'Quiz',
  assignment: 'Assignment',
  project: 'Project',
  participation: 'Participation',
  exam: 'Exam',
  other: 'Other',
};

export type ScoreStatus = 'scored' | 'absent' | 'excused';

export interface GradingCategory {
  id: string;
  name: string;
  weight: number;
}

export interface SheetAssessment {
  id: string;
  title: string;
  kind: AssessmentKind;
  max_score: number;
  grading_category_id: string | null;
  assessment_date: string | null;
  description?: string | null;
  due_date?: string | null;
}

export interface ScoreEntry {
  score: number | null;
  status: ScoreStatus;
  comment: string | null;
}

export interface SheetStudent {
  student_id: string;
  name: string;
  admission_number: string | null;
  /** Keyed by assessment id; missing when nothing was entered yet. */
  scores: Record<string, ScoreEntry | undefined>;
  period_score: number | null;
  complete: boolean;
}

export interface GradebookSheet {
  class_subject_id: string;
  class: { id: string; name?: string | null; [key: string]: unknown };
  subject: { id: string; name?: string | null; [key: string]: unknown };
  teacher: { id: string; name: string | null } | null;
  /** Null for the exam sheet. */
  period: { id: string; name?: string | null; [key: string]: unknown } | null;
  /** The period's semester, or the exam's. */
  semester: { id: string; name?: string | null; number?: number } | null;
  published: boolean;
  /** Weight descending; empty for the exam sheet. */
  categories: GradingCategory[];
  assessments: SheetAssessment[];
  /** For the exam sheet `period_score` is the exam percentage. */
  students: SheetStudent[];
  class_average: number | null;
  /** May change scores and assessments now (false for viewers, and for teachers once published). */
  can_edit: boolean;
  /** Holds manage_academic_data (may correct published results). */
  can_manage: boolean;
}

export interface SheetTarget {
  classSubjectId: string;
  /** Exactly one of periodId / semesterId (semester = the semester exam). */
  periodId?: string;
  semesterId?: string;
}

export interface AssessmentInput {
  kind: AssessmentKind;
  period_id?: string | null;
  semester_id?: string | null;
  grading_category_id: string | null;
  title: string;
  description?: string | null;
  assessment_date?: string | null;
  due_date?: string | null;
  max_score: number;
}

export interface AssessmentCreate extends AssessmentInput {
  class_subject_id: string;
}

export interface ScoreEntryInput {
  student_id: string;
  score: number | null;
  status: ScoreStatus;
  comment?: string | null;
}

// Picker lookups (existing endpoints)

export interface GradebookYear {
  id: string;
  name: string;
  start_date?: string;
  end_date?: string;
}

/** A class subject this user may view (GET /academics/gradebook/class-subjects). */
export interface GradebookClassSubject {
  class_subject_id: string;
  class_id: string;
  class_name: string | null;
  subject_id: string;
  subject_name: string | null;
  teacher_id: string | null;
  teacher_name: string | null;
  can_edit: boolean;
}

export interface GradebookSemester {
  id: string;
  name: string;
  semester_number: number;
  start_date: string;
  end_date: string;
}

export interface GradebookPeriod {
  id: string;
  semester_id: string;
  name: string;
  period_number: number;
  start_date: string;
  end_date: string;
}

export interface GradebookTerms {
  semesters: (GradebookSemester & { periods: GradebookPeriod[] })[];
}

// ---------------------------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------------------------

/** HTTP status of an API error (AppError.statusCode), or undefined for network errors. */
export function errorStatus(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const status = (error as { statusCode?: unknown }).statusCode;
  return typeof status === 'number' ? status : undefined;
}

/** The server's own message when it is readable, otherwise the fallback. */
export function errorText(error: unknown, fallback: string): string {
  const detail = errorDetail(error);
  if (detail && typeof detail === 'object' && typeof (detail as { message?: unknown }).message === 'string') {
    return (detail as { message: string }).message;
  }
  if (error && typeof error === 'object' && 'message' in error) {
    const msg = String((error as { message?: unknown }).message || '');
    if (msg && !msg.startsWith('{') && !msg.startsWith('[') && msg.length < 300) return msg;
  }
  return fallback;
}

/** The response's `detail` (or the whole body when it has a message), when it is an object. */
function errorDetail(error: unknown): unknown {
  if (!error || typeof error !== 'object') return undefined;
  const err = error as { message?: string; originalError?: unknown };
  const data = (err.originalError as { response?: { data?: unknown } } | undefined)?.response?.data;
  if (data && typeof data === 'object') {
    const detail = (data as { detail?: unknown }).detail;
    if (detail && typeof detail === 'object' && !Array.isArray(detail)) return detail;
  }
  if (err.message?.startsWith('{')) {
    try {
      return JSON.parse(err.message);
    } catch {
      return undefined;
    }
  }
  return undefined;
}

/** Per-student problems of a refused save (422 `{message, problems: [{student_id, error}]}`). */
export function scoreProblems(error: unknown): { student_id: string; error: string }[] {
  const detail = errorDetail(error) as { problems?: unknown } | undefined;
  if (!detail || !Array.isArray(detail.problems)) return [];
  return detail.problems.filter(
    (p): p is { student_id: string; error: string } =>
      Boolean(p) && typeof p.student_id === 'string' && typeof p.error === 'string'
  );
}

// ---------------------------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------------------------

function targetQuery(target: SheetTarget): string {
  const qs = new URLSearchParams({ class_subject_id: target.classSubjectId });
  if (target.semesterId) qs.set('semester_id', target.semesterId);
  else if (target.periodId) qs.set('period_id', target.periodId);
  return qs.toString();
}

function asList<T>(resp: T[] | { items?: T[] } | null | undefined): T[] {
  if (Array.isArray(resp)) return resp;
  return resp?.items ?? [];
}

export function useGradebookService() {
  const { apiClient } = useApiClientWithLoading();
  const waitForApiClientReady = useMemo(() => createWaitForApiClientReady(apiClient), [apiClient]);

  return useMemo(
    () => ({
      // ---- gradebook (phase 4) ----
      getSheet: async (target: SheetTarget): Promise<GradebookSheet> => {
        const client = await waitForApiClientReady();
        return client.get<GradebookSheet>(`${BASE}/sheet?${targetQuery(target)}`);
      },

      createAssessment: async (payload: AssessmentCreate): Promise<SheetAssessment> => {
        const client = await waitForApiClientReady();
        return client.post<SheetAssessment>(`${BASE}/assessments`, payload);
      },

      updateAssessment: async (id: string, payload: AssessmentInput): Promise<SheetAssessment> => {
        const client = await waitForApiClientReady();
        return client.put<SheetAssessment>(`${BASE}/assessments/${encodeURIComponent(id)}`, payload);
      },

      /** `force` deletes the marks too (the server decides who may). */
      deleteAssessment: async (id: string, force = false): Promise<void> => {
        const client = await waitForApiClientReady();
        await client.delete<void>(
          `${BASE}/assessments/${encodeURIComponent(id)}${force ? '?force=true' : ''}`
        );
      },

      /**
       * Upsert one column. All or nothing: any invalid entry means nothing in the column is saved.
       * `{score: null, status: 'scored'}` deletes that student's entry.
       */
      saveScores: async (assessmentId: string, entries: ScoreEntryInput[]): Promise<unknown> => {
        const client = await waitForApiClientReady();
        return client.put<unknown>(`${BASE}/assessments/${encodeURIComponent(assessmentId)}/scores`, {
          entries,
        });
      },

      // ---- picker lookups (existing endpoints) ----
      getCurrentYear: async (): Promise<GradebookYear | null> => {
        const client = await waitForApiClientReady();
        return client.get<GradebookYear | null>('/academics/academic-years/current');
      },

      /** The class subjects this user may view (teachers: what they teach and the classes they sponsor). */
      getClassSubjects: async (academicYearId: string): Promise<GradebookClassSubject[]> => {
        const client = await waitForApiClientReady();
        const resp = await client.get<GradebookClassSubject[] | { items: GradebookClassSubject[] }>(
          `${BASE}/class-subjects?academic_year_id=${encodeURIComponent(academicYearId)}`
        );
        return asList(resp);
      },

      /** Semesters of a year with their periods, both in order. */
      getTerms: async (academicYearId: string): Promise<GradebookTerms> => {
        const client = await waitForApiClientReady();
        const semesters = asList(
          await client.get<GradebookSemester[]>(
            `/academics/semesters?academic_year_id=${encodeURIComponent(academicYearId)}`
          )
        ).sort((a, b) => a.semester_number - b.semester_number);
        const withPeriods = await Promise.all(
          semesters.map(async (semester) => {
            const periods = asList(
              await client.get<GradebookPeriod[]>(`/academics/periods?semester_id=${encodeURIComponent(semester.id)}`)
            ).sort((a, b) => a.period_number - b.period_number || a.start_date.localeCompare(b.start_date));
            return { ...semester, periods };
          })
        );
        return { semesters: withPeriods };
      },
    }),
    [waitForApiClientReady]
  );
}
