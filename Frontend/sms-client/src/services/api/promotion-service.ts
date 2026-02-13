import { useApiClientWithLoading, createWaitForApiClientReady } from './api-client';
import { useMemo } from 'react';

export interface PromotionCriteria {
  id?: string;
  academic_year_id: string;
  grade_id?: string;
  passing_mark: number;
  min_passed_subjects: number;
  require_core_pass: boolean;
  core_subject_ids?: string[];
  weighting_schema?: Record<string, number>;
  aggregate_method?: 'average' | 'weighted';
}

export type PromotionStatusTag = 'Eligible' | 'Conditional' | 'Repeating';

export interface PromotionEvaluationResult {
  student_id: string;
  enrollment_id: string;
  status: PromotionStatusTag;
  student_name?: string;
  section_id?: string;
  failed_subject_ids?: string[];
  total_score?: number;
  notes?: string;
}

// Types that match backend PromotionService response structure
export type PromotionType = 'semester' | 'grade' | 'graduation';

export interface SemesterPromotionResult {
  student_id: string;
  from_semester: number;
  to_semester: number;
  grade: string;
  academic_year: string;
  type: 'semester_promotion';
}

export interface GradePromotionResult {
  student_id: string;
  from_grade: string;
  to_grade: string;
  from_academic_year: string;
  to_academic_year: string;
  enrollment_id?: string;
  type: 'grade_promotion';
}

export interface GraduationResult {
  student_id: string;
  from_grade: string;
  academic_year: string;
  graduation_date: string; // ISO date
  type: 'graduation';
}

export interface PromotionError {
  student_id?: string;
  error: string;
  type: 'error';
}

export interface BulkPromotionResponse {
  semester_promoted: SemesterPromotionResult[];
  grade_promoted: GradePromotionResult[];
  graduated: GraduationResult[];
  failed: unknown[];
  errors: PromotionError[];
}

export function usePromotionService() {
  const { apiClient, isLoading } = useApiClientWithLoading();
  const waitForApiClientReady = createWaitForApiClientReady(apiClient);

  return useMemo(() => ({
    // Fetch criteria (returns first match or null)
    getCriteria: async (academic_year_id: string, grade_id?: string): Promise<PromotionCriteria | null> => {
      const client = await waitForApiClientReady();
      const qs = grade_id ? `academic_year_id=${academic_year_id}&grade_id=${grade_id}` : `academic_year_id=${academic_year_id}`;
      const res = await client.get<PromotionCriteria[] | null>(
        `/academics/promotions/criteria?${qs}`
      );
      return Array.isArray(res) && res.length > 0 ? res[0] : null;
    },

    // Create criteria explicitly
    createCriteria: async (criteria: PromotionCriteria): Promise<PromotionCriteria> => {
      const client = await waitForApiClientReady();
      return client.post<PromotionCriteria>(`/academics/promotions/criteria`, criteria);
    },

    // Update criteria explicitly
    updateCriteria: async (id: string, criteria: Partial<PromotionCriteria>): Promise<PromotionCriteria> => {
      const client = await waitForApiClientReady();
      return client.put<PromotionCriteria>(`/academics/promotions/criteria/${id}`, criteria);
    },

    // Upsert criteria: create if missing; update if exists
    setCriteria: async (criteria: PromotionCriteria): Promise<PromotionCriteria> => {
      const client = await waitForApiClientReady();
      const qs = criteria.grade_id ? `academic_year_id=${criteria.academic_year_id}&grade_id=${criteria.grade_id}` : `academic_year_id=${criteria.academic_year_id}`;
      const existingList = await client.get<PromotionCriteria[]>(
        `/academics/promotions/criteria?${qs}`, { timeout: 60000 }
      );
      const existing = Array.isArray(existingList) && existingList.length > 0 ? existingList[0] : null;
      if (existing?.id) {
        return client.put<PromotionCriteria>(`/academics/promotions/criteria/${existing.id}`, criteria, { timeout: 60000 });
      }
      return client.post<PromotionCriteria>(`/academics/promotions/criteria`, criteria, { timeout: 60000 });
    },

    setCriteriaBulk: async (items: PromotionCriteria[]): Promise<{ created: number; updated: number; errors: unknown[] }> => {
      const client = await waitForApiClientReady();
      return client.post<{ created: number; updated: number; errors: unknown[] }>(`/academics/promotions/criteria`, items, { timeout: 60000 });
    },

    // Delete criteria helper
    deleteCriteria: async (id: string): Promise<{ deleted: boolean }> => {
      const client = await waitForApiClientReady();
      return client.delete<{ deleted: boolean }>(`/academics/promotions/criteria/${id}`);
    },

    evaluatePromotion: async (academic_year_id: string, grade_id?: string, section_id?: string): Promise<PromotionEvaluationResult[]> => {
      const client = await waitForApiClientReady();
      const payload: any = { academic_year_id };
      if (grade_id) payload.grade_id = grade_id;
      if (section_id && section_id !== 'all') payload.section_id = section_id;
      return client.post<PromotionEvaluationResult[]>(`/academics/promotions/evaluate`, payload, { timeout: 60000 });
    },

    applyPromotion: async (academic_year_id: string, from_grade_id: string, to_grade_id: string, student_ids: string[]): Promise<void> => {
      const client = await waitForApiClientReady();
      await client.post<void>(`/academics/promotions/apply`, {
        academic_year_id, from_grade_id, to_grade_id, student_ids
      });
    },

    assignRemedial: async (academic_year_id: string, student_id: string, subject_ids: string[]): Promise<void> => {
      const client = await waitForApiClientReady();
      await client.post<void>(`/academics/remedial/assign`, {
        academic_year_id, student_id, subject_ids
      });
    },
    // New: find students whose weighted grades are below passing
    identifyAtRisk: async (academic_year_id: string, grade_id?: string): Promise<any[]> => {
      const client = await waitForApiClientReady();
      const payload: any = { academic_year_id };
      if (grade_id) payload.grade_id = grade_id;
      return client.post<any[]>(`/academics/remedial/identify`, payload);
    },
    // Bulk promotion for arbitrary student lists
    bulkPromoteStudents: async (payload: {
      student_ids: string[];
      promotion_type: PromotionType;
      target_academic_year?: string;
      target_semester?: number; // 1 or 2 (only relevant for semester promotions)
      promotion_rules?: Record<string, string>; // optional section mapping per student_id
    }): Promise<BulkPromotionResponse> => {
      const client = await waitForApiClientReady();
      return client.post<BulkPromotionResponse>('/academics/enrollments/bulk-promote', payload);
    },

    // Promote entire grade/section to the next semester
    promoteSemesterForGrade: async (payload: {
      grade: string;
      section?: string;
      target_semester?: number; // default 2
    }): Promise<BulkPromotionResponse> => {
      const client = await waitForApiClientReady();
      return client.post<BulkPromotionResponse>('/academics/enrollments/promote-semester', {
        grade: payload.grade,
        section: payload.section,
        target_semester: payload.target_semester ?? 2,
      });
    },

    // Promote entire grade/section to the next grade for a new academic year
    promoteGradeLevel: async (payload: {
      from_grade: string;
      from_section?: string;
      target_academic_year: string;
      target_section_mapping?: Record<string, string>; // map from student_id -> target section name
    }): Promise<BulkPromotionResponse> => {
      const client = await waitForApiClientReady();
      return client.post<BulkPromotionResponse>('/academics/enrollments/promote-grade', payload);
    },

    // Promote a single enrollment (student) by enrollment ID
    promoteEnrollment: async (
      enrollmentId: string,
      payload?: {
        promotion_type?: PromotionType;
        target_academic_year?: string;
        target_semester?: number;
      }
    ): Promise<BulkPromotionResponse> => {
      const client = await waitForApiClientReady();
      return client.post<BulkPromotionResponse>(`/academics/enrollments/${enrollmentId}/promote`, {
        promotion_type: payload?.promotion_type ?? 'semester',
        target_academic_year: payload?.target_academic_year,
        target_semester: payload?.target_semester ?? 2,
      });
    },

    // Add/ensure this method exists
    getPromotionStatusByEnrollment: async (enrollmentId: string): Promise<PromotionEvaluationResult | null> => {
      const client = await waitForApiClientReady();
      type PromotionStatusResponse = {
        student_id: string;
        enrollment_id: string;
        status: PromotionStatusTag | string;
        failed_subject_ids?: string[];
        total_score?: number | string;
        student_name?: string;
        section_id?: string;
      };
      const res = await client.get<PromotionStatusResponse>(`/academics/promotions/status/${enrollmentId}`);
      if (!res) return null;
      return {
        student_id: res.student_id,
        enrollment_id: res.enrollment_id,
        status: (res.status as PromotionStatusTag),
        failed_subject_ids: res.failed_subject_ids ?? [],
        total_score: typeof res.total_score === 'number' ? res.total_score : parseFloat(res.total_score ?? '0'),
        student_name: res.student_name,
        section_id: res.section_id
      };
    },

    // New: query promotion status by student + academic year
    getPromotionStatus: async (student_id: string, academic_year_id: string): Promise<PromotionEvaluationResult | null> => {
      const client = await waitForApiClientReady();
      type PromotionStatusResponse = {
        student_id: string;
        enrollment_id: string;
        status: PromotionStatusTag | string;
        failed_subject_ids?: string[];
        total_score?: number | string;
        student_name?: string;
        section_id?: string;
      };
      const res = await client.get<PromotionStatusResponse>(`/academics/promotions/status?student_id=${student_id}&academic_year_id=${academic_year_id}`);
      if (!res) return null;
      return {
        student_id: res.student_id,
        enrollment_id: res.enrollment_id,
        status: (res.status as PromotionStatusTag),
        failed_subject_ids: res.failed_subject_ids ?? [],
        total_score: typeof res.total_score === 'number' ? res.total_score : parseFloat(res.total_score ?? '0'),
        student_name: res.student_name,
        section_id: res.section_id
      };
    },

    // New: re-evaluate a single enrollment
    reEvaluateEnrollment: async (enrollmentId: string): Promise<PromotionEvaluationResult[]> => {
      const client = await waitForApiClientReady();
      return client.post<PromotionEvaluationResult[]>(`/academics/promotions/evaluate`, {
        enrollment_ids: [enrollmentId]
      });
    },

    // New: create remedial sessions for a given enrollment
    createRemedialSessions: async (enrollment_id: string, subject_ids: string[], scheduled_date?: string): Promise<{ created: number }> => {
      const client = await waitForApiClientReady();
      return client.post<{ created: number }>(`/academics/remedial/sessions`, {
        enrollment_id, subject_ids, scheduled_date
      });
    },

    // New: record remedial result and trigger re-evaluation
    recordRemedialResult: async (session_id: string, payload: { status?: 'scheduled' | 'completed'; new_score?: number; passed?: boolean }): Promise<unknown> => {
      const client = await waitForApiClientReady();
      return client.put<unknown>(`/academics/remedial/sessions/${session_id}`, payload);
    },
    getRemedialSessions: async (enrollment_id: string): Promise<unknown[]> => {
      const client = await waitForApiClientReady();
      return client.get<unknown[]>(`/academics/remedial/sessions?enrollment_id=${enrollment_id}`);
    },
    getAllRemedialSessions: async (skip: number = 0, limit: number = 100): Promise<unknown[]> => {
      const client = await waitForApiClientReady();
      return client.get<unknown[]>(`/academics/remedial/sessions?skip=${skip}&limit=${limit}`);
    },

    startTransition: async (currentYearId: string, targetYearName: string): Promise<any> => {
      const client = await waitForApiClientReady();
      return client.post(`/academics/promotions/transition`, null, {
        params: { current_year_id: currentYearId, target_year_name: targetYearName }
      });
    },

    applyScaling: async (enrollmentId: string, scalingPoints: number, notes?: string): Promise<any> => {
      const client = await waitForApiClientReady();
      return client.post(`/academics/promotions/scaling`, null, {
        params: { enrollment_id: enrollmentId, scaling_points: scalingPoints, notes }
      });
    },
  }), [waitForApiClientReady]);
}
