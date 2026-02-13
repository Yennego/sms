
import { useApiClientWithLoading, createWaitForApiClientReady } from './api-client';
import { Class, ClassCreate, ClassUpdate, ClassWithDetails, ClassFilters, ClassSubject } from '@/types/class';
import { useMemo } from 'react';

export function useClassService() {
  const { apiClient, isLoading: apiLoading } = useApiClientWithLoading();
  const waitForApiClientReady = useMemo(() => createWaitForApiClientReady(apiClient), [apiClient]);

  const service = useMemo(() => ({
    getClasses: async (filters?: ClassFilters): Promise<Class[]> => {
      const client = await waitForApiClientReady();
      try {
        const queryParams = new URLSearchParams();
        if (filters?.academic_year_id) queryParams.append('academic_year_id', filters.academic_year_id);
        if (filters?.grade_id) queryParams.append('grade_id', filters.grade_id);
        if (filters?.section_id) queryParams.append('section_id', filters.section_id);
        if (filters?.subject_id) queryParams.append('subject_id', filters.subject_id);
        if (filters?.teacher_id) queryParams.append('teacher_id', filters.teacher_id);
        if (filters?.is_active !== undefined) queryParams.append('is_active', filters.is_active.toString());
        if (filters?.search) queryParams.append('search', filters.search);
        queryParams.append('skip', '0');
        queryParams.append('limit', '100');

        const endpoint = `/academics/classes${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
        const response = await client.get<Class[]>(endpoint, { timeout: 60000 });

        return Array.isArray(response)
          ? response
          : (response && typeof response === 'object' && 'data' in response ? (response as { data: Class[] }).data : []);
      } catch (error) {
        console.error('Error fetching classes:', error);
        return [];
      }
    },

    getClassById: async (id: string): Promise<Class> => {
      const client = await waitForApiClientReady();
      return client.get<Class>(`/academics/classes/${id}`);
    },

    getClassWithDetails: async (id: string): Promise<ClassWithDetails> => {
      const client = await waitForApiClientReady();
      return client.get<ClassWithDetails>(`/academics/classes/${id}/details`);
    },

    createClass: async (classData: ClassCreate): Promise<Class> => {
      const client = await waitForApiClientReady();
      return client.post<Class>('/academics/classes', classData);
    },

    updateClass: async (id: string, classData: ClassUpdate): Promise<Class> => {
      const client = await waitForApiClientReady();
      return client.put<Class>(`/academics/classes/${id}`, classData);
    },

    deleteClass: async (id: string): Promise<void> => {
      const client = await waitForApiClientReady();
      return client.delete<void>(`/academics/classes/${id}`);
    },

    // Class Subjects management
    addSubjectToClass: async (classId: string, subjectData: any): Promise<ClassSubject> => {
      const client = await waitForApiClientReady();
      return client.post<ClassSubject>(`/academics/classes/${classId}/subjects`, subjectData);
    },

    removeSubjectFromClass: async (classId: string, subjectId: string): Promise<void> => {
      const client = await waitForApiClientReady();
      return client.delete<void>(`/academics/classes/${classId}/subjects/${subjectId}`);
    },

    getClassStudents: async (classId: string): Promise<{ id: string; name: string; roll_number?: string }[]> => {
      const client = await waitForApiClientReady();
      const rawStudents = await client.get<unknown[]>(`/academics/classes/${classId}/students`);

      // Map backend fields to frontend-expected fields
      return (rawStudents || []).map((student: unknown) => {
        const s = student as Record<string, unknown>;
        return {
          id: String(s.id || ''),
          // Backend uses full_name, frontend expects name
          name: String(s.full_name || s.name || `${s.first_name || ''} ${s.last_name || ''}`.trim() || 'Unknown'),
          // Backend may use roll_number as int or admission_number as string
          roll_number: s.roll_number ? String(s.roll_number) : s.admission_number ? String(s.admission_number) : undefined
        };
      });
    },

    getClassEnrollmentCount: async (
      classId: string,
      options?: { academic_year_id?: string; is_active?: boolean; status?: 'active' | 'inactive' }
    ): Promise<number> => {
      const client = await waitForApiClientReady();
      const qs = new URLSearchParams();
      if (options?.academic_year_id) qs.append('academic_year_id', options.academic_year_id);
      if (options?.is_active !== undefined) qs.append('is_active', String(options.is_active));
      if (options?.status) qs.append('status', options.status);

      const data = await client.get<{ count: number } | number>(
        `/academics/classes/${classId}/enrollment-count${qs.size ? '?' + qs.toString() : ''}`
      );
      return typeof data === 'number' ? data : data?.count ?? 0;
    },

    getClassEnrollments: async (
      classId: string,
      options?: { academic_year_id?: string; is_active?: boolean }
    ): Promise<unknown[]> => {
      const client = await waitForApiClientReady();
      const qs = new URLSearchParams();
      if (options?.academic_year_id) qs.append('academic_year_id', options.academic_year_id);
      if (options?.is_active !== undefined) qs.append('is_active', String(options.is_active));
      return client.get<unknown[]>(
        `/academics/classes/${classId}/enrollments${qs.size ? '?' + qs.toString() : ''}`
      );
    },

    createClassEnrollment: async (payload: {
      student_id: string;
      class_id: string;
      academic_year_id: string;
      enrollment_date?: string;
      status?: string;
    }): Promise<unknown> => {
      const client = await waitForApiClientReady();
      return client.post<unknown>('/academics/class-enrollments', payload);
    },

    bulkCreateClassEnrollments: async (payload: {
      class_id: string;
      academic_year_id: string;
      student_ids: string[];
      enrollment_date?: string;
      status?: string;
    }): Promise<unknown[]> => {
      const client = await waitForApiClientReady();
      return client.post<unknown[]>('/academics/class-enrollments/bulk', payload);
    },

    checkDuplicateClassIdentity: async (identity: {
      academic_year_id: string;
      grade_id: string;
      section_id: string;
    }): Promise<Class | null> => {
      const client = await waitForApiClientReady();
      const queryParams = new URLSearchParams();
      queryParams.append('academic_year_id', identity.academic_year_id);
      queryParams.append('grade_id', identity.grade_id);
      queryParams.append('section_id', identity.section_id);

      const endpoint = `/academics/classes?${queryParams.toString()}`;
      const response = await client.get<Class[]>(endpoint);
      const arr = Array.isArray(response) ? response : [];

      return (arr || []).find(
        c =>
          c.academic_year_id === identity.academic_year_id &&
          c.grade_id === identity.grade_id &&
          c.section_id === identity.section_id
      ) || null;
    }
  }), [waitForApiClientReady]);

  return service;
}
