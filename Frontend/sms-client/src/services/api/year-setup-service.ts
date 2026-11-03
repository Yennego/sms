// Year setup wizard API (docs/remodel/phase3-api.md §1) plus the few existing endpoints the
// wizard uses inline (levels, sections, semester and period dates, teachers, subjects).
import { useMemo } from 'react';
import { useApiClientWithLoading, createWaitForApiClientReady } from './api-client';

export interface YearSetupYear {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
}

export interface YearSetupPeriod {
  id: string;
  name: string;
  number: number;
  start_date: string;
  end_date: string;
}

export interface YearSetupSemester extends YearSetupPeriod {
  periods: YearSetupPeriod[];
}

export interface TermsStep {
  complete: boolean;
  semesters: YearSetupSemester[];
}

export interface YearSetupSection {
  id: string;
  name: string;
}

export interface YearSetupLevel {
  id: string;
  name: string;
  sequence: number;
  sections: YearSetupSection[];
}

export interface LevelsStep {
  complete: boolean;
  levels: YearSetupLevel[];
}

export interface YearSetupClass {
  id: string;
  name: string;
  grade_id: string;
  grade_name: string;
  section_id: string;
  section_name: string;
  sponsor_id: string | null;
  sponsor_name: string | null;
  enrolled: number;
  capacity: number;
}

export interface MissingClass {
  grade_id: string;
  grade_name: string;
  section_id: string;
  section_name: string;
}

export interface ClassesStep {
  complete: boolean;
  classes: YearSetupClass[];
  missing: MissingClass[];
}

export interface YearSetupClassSubject {
  class_subject_id: string;
  subject_id: string;
  subject_name: string;
  teacher_id: string | null;
  teacher_name: string | null;
}

export interface SubjectsStep {
  complete: boolean;
  unassigned_teachers: number;
  classes: { class_id: string; class_name: string; subjects: YearSetupClassSubject[] }[];
}

export interface EnrollmentStep {
  complete: boolean;
  total: number;
  per_class: { class_id: string; class_name: string; count: number; capacity: number }[];
}

export interface YearSetup {
  year: YearSetupYear;
  previous_year: { id: string; name: string } | null;
  steps: {
    terms: TermsStep;
    levels: LevelsStep;
    classes: ClassesStep;
    subjects: SubjectsStep;
    enrollment: EnrollmentStep;
  };
}

export interface CopyFromOptions {
  terms: boolean;
  classes: boolean;
  sponsors: boolean;
  subjects: boolean;
}

export interface CopyFromResult {
  semesters: number;
  periods: number;
  classes: number;
  sponsors: number;
  class_subjects: number;
}

export interface ApplySubjectsPayload {
  grade_id: string;
  subject_ids: string[];
  teachers: Record<string, string>;
}

/** Just the fields the wizard needs from GET /people/teachers. */
export interface TeacherOption {
  id: string;
  first_name: string;
  last_name: string;
  is_active?: boolean;
}

/** Just the fields the wizard needs from GET /academics/subjects. */
export interface SubjectOption {
  id: string;
  name: string;
  code?: string;
  is_active?: boolean;
}

const BASE = '/academics/year-setup';

export function useYearSetupService() {
  const { apiClient } = useApiClientWithLoading();
  const ready = useMemo(() => createWaitForApiClientReady(apiClient), [apiClient]);

  return useMemo(() => ({
    getYearSetup: async (yearId: string) =>
      (await ready()).get<YearSetup>(`${BASE}/${yearId}`),

    createDefaultTerms: async (yearId: string) =>
      (await ready()).post<TermsStep>(`${BASE}/${yearId}/terms/default`, {}),

    copyFrom: async (yearId: string, sourceYearId: string, options: CopyFromOptions) =>
      (await ready()).post<CopyFromResult>(`${BASE}/${yearId}/copy-from/${sourceYearId}`, options),

    generateClasses: async (yearId: string, capacity: number) =>
      (await ready()).post<ClassesStep>(`${BASE}/${yearId}/classes/generate`, { capacity }),

    setSponsor: async (classId: string, teacherId: string | null) =>
      (await ready()).put<YearSetupClass>(`${BASE}/classes/${classId}/sponsor`, { teacher_id: teacherId }),

    applySubjects: async (yearId: string, payload: ApplySubjectsPayload) =>
      (await ready()).post<SubjectsStep>(`${BASE}/${yearId}/subjects`, payload),

    setSubjectTeacher: async (classSubjectId: string, teacherId: string | null) =>
      (await ready()).put<YearSetupClassSubject>(`${BASE}/class-subjects/${classSubjectId}/teacher`, { teacher_id: teacherId }),

    // Existing endpoints used inline by the wizard
    updateSemesterDates: async (id: string, dates: { start_date: string; end_date: string }) =>
      (await ready()).put<unknown>(`/academics/semesters/${id}`, dates),

    updatePeriodDates: async (id: string, dates: { start_date: string; end_date: string }) =>
      (await ready()).put<unknown>(`/academics/periods/${id}`, dates),

    createLevel: async (payload: { name: string; sequence: number }) =>
      (await ready()).post<unknown>('/academics/academic-grades', { ...payload, is_active: true }),

    createSection: async (payload: { grade_id: string; name: string }) =>
      (await ready()).post<unknown>('/academics/sections', { ...payload, is_active: true }),

    listTeachers: async (): Promise<TeacherOption[]> => {
      const res = await (await ready()).get<TeacherOption[] | { data: TeacherOption[] }>('/people/teachers?skip=0&limit=500');
      const list = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];
      return list.filter((t) => t.is_active !== false);
    },

    listSubjects: async (): Promise<SubjectOption[]> => {
      const res = await (await ready()).get<SubjectOption[]>('/academics/subjects?is_active=true&limit=500');
      return Array.isArray(res) ? res : [];
    },
  }), [ready]);
}
