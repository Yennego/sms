import { useApiClientWithLoading, createWaitForApiClientReady } from './api-client';
import { Teacher, TeacherCreate, TeacherUpdate, TeacherFilters, TeacherCreateResponse } from '@/types/teacher';
import { useMemo } from 'react';

export function useTeacherService() {
  const { apiClient, isLoading: apiLoading } = useApiClientWithLoading();
  const waitForApiClientReady = useMemo(() => createWaitForApiClientReady(apiClient), [apiClient]);

  return useMemo(() => ({
    getTeachers: async (filters?: TeacherFilters): Promise<Teacher[]> => {
      const client = await waitForApiClientReady();

      try {
        const queryParams = new URLSearchParams();
        if (filters?.department && filters.department !== 'all') {
          queryParams.append('department', filters.department);
        }
        if (filters?.status && filters.status !== 'all') queryParams.append('status', filters.status);
        if (filters?.is_class_teacher !== undefined) queryParams.append('is_class_teacher', filters.is_class_teacher.toString());
        if (filters?.search) queryParams.append('search', filters.search);
        queryParams.append('skip', '0');
        queryParams.append('limit', '50');

        const endpoint = `/people/teachers${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
        const cacheBuster = `${endpoint.includes('?') ? '&' : '?'}_t=${Date.now()}`;
        const finalEndpoint = endpoint + cacheBuster;

        const response = await client.get<Teacher[] | { data: Teacher[] }>(finalEndpoint);

        if (Array.isArray(response)) {
          return response;
        } else if (response && typeof response === 'object' && 'data' in response) {
          const obj = response as { data: Teacher[] };
          return Array.isArray(obj.data) ? obj.data : [];
        } else {
          return [];
        }
      } catch (error) {
        console.error('Error fetching teachers:', error);
        throw error;
      }
    },

    getTeacher: async (teacherId: string): Promise<Teacher> => {
      const client = await waitForApiClientReady();
      try {
        const endpoint = `/people/teachers/${teacherId}`;
        return await client.get<Teacher>(endpoint);
      } catch (error) {
        console.error('Error fetching teacher:', error);
        throw error;
      }
    },

    createTeacher: async (teacherData: TeacherCreate): Promise<TeacherCreateResponse> => {
      const client = await waitForApiClientReady();
      try {
        const endpoint = '/people/teachers';
        return await client.post<TeacherCreateResponse>(endpoint, teacherData);
      } catch (error) {
        console.error('Error creating teacher:', error);
        throw error;
      }
    },

    createTeachersBulk: async (teachersData: TeacherCreate[]): Promise<TeacherCreateResponse[]> => {
      const client = await waitForApiClientReady();
      try {
        const endpoint = '/people/teachers/bulk';
        return await client.post<TeacherCreateResponse[]>(endpoint, teachersData);
      } catch (error) {
        console.error('Error creating teachers in bulk:', error);
        throw error;
      }
    },

    updateTeacher: async (teacherId: string, teacherData: TeacherUpdate): Promise<Teacher> => {
      const client = await waitForApiClientReady();
      try {
        const endpoint = `/people/teachers/${teacherId}`;
        return await client.put<Teacher>(endpoint, teacherData);
      } catch (error) {
        console.error('Error updating teacher:', error);
        throw error;
      }
    },

    deleteTeacher: async (id: string): Promise<void> => {
      const client = await waitForApiClientReady();
      await client.delete(`/people/teachers/${id}`);
    },

    createBulkTeachers: async (teachers: TeacherCreate[]): Promise<Teacher[]> => {
      const client = await waitForApiClientReady();
      try {
        const response = await client.post<Teacher[]>('/people/teachers/bulk', teachers);
        return Array.isArray(response) ? response : [];
      } catch (error) {
        console.error('Error creating bulk teachers:', error);
        throw error;
      }
    },

    getClassTeachers: async (): Promise<Teacher[]> => {
      const client = await waitForApiClientReady();
      try {
        const endpoint = '/people/teachers/class-teachers';
        return await client.get<Teacher[]>(endpoint);
      } catch (error) {
        console.error('Error fetching class teachers:', error);
        throw error;
      }
    },

    retireTeacher: async (teacherId: string, exitDate: string): Promise<Teacher> => {
      const client = await waitForApiClientReady();
      try {
        const endpoint = `/people/teachers/${teacherId}`;
        return await client.put<Teacher>(endpoint, {
          status: 'retired',
          exit_date: exitDate,
          retirement_date: exitDate
        });
      } catch (error) {
        console.error('Error retiring teacher:', error);
        throw error;
      }
    },

    resignTeacher: async (teacherId: string, exitDate: string, reason?: string): Promise<Teacher> => {
      const client = await waitForApiClientReady();
      try {
        const endpoint = `/people/teachers/${teacherId}`;
        return await client.put<Teacher>(endpoint, {
          status: 'resigned',
          exit_date: exitDate,
          resignation_date: exitDate,
          resignation_reason: reason
        });
      } catch (error) {
        console.error('Error processing teacher resignation:', error);
        throw error;
      }
    },

    activateTeacher: async (teacherId: string): Promise<Teacher> => {
      const client = await waitForApiClientReady();
      try {
        const endpoint = `/people/teachers/${teacherId}`;
        return await client.put<Teacher>(endpoint, {
          status: 'active'
        });
      } catch (error) {
        console.error('Error activating teacher:', error);
        throw error;
      }
    },

    deactivateTeacher: async (teacherId: string): Promise<Teacher> => {
      const client = await waitForApiClientReady();
      try {
        const endpoint = `/people/teachers/${teacherId}`;
        return await client.put<Teacher>(endpoint, {
          status: 'inactive'
        });
      } catch (error) {
        console.error('Error deactivating teacher:', error);
        throw error;
      }
    },

    getDepartments: async (): Promise<string[]> => {
      const client = await waitForApiClientReady();
      try {
        const endpoint = '/people/teachers/departments';
        return await client.get<string[]>(endpoint);
      } catch (error) {
        console.error('Error fetching departments:', error);
        try {
          const teachers = await client.get<Teacher[]>('/people/teachers');
          const departments = [...new Set(teachers
            .map(teacher => teacher.department)
            .filter((dept): dept is string => !!dept && dept.trim() !== '')
          )];
          return departments.sort();
        } catch (fallbackError) {
          console.error('Fallback departments fetch failed:', fallbackError);
          return [];
        }
      }
    },

    getTeacherAssignments: async (teacherId: string, academicYearId?: string): Promise<any[]> => {
      const client = await waitForApiClientReady();
      try {
        const queryParams = new URLSearchParams();
        if (academicYearId) queryParams.append('academic_year_id', academicYearId);

        const endpoint = `/academics/teacher-subject-assignments/teacher/${teacherId}?${queryParams.toString()}`;
        return await client.get<any[]>(endpoint);
      } catch (error) {
        console.error('Error fetching teacher assignments:', error);
        throw error;
      }
    },

    getAssignmentStudents: async (assignmentId: string): Promise<any[]> => {
      const client = await waitForApiClientReady();
      try {
        const endpoint = `/academics/teacher-subject-assignments/${assignmentId}/students`;
        return await client.get<any[]>(endpoint);
      } catch (error) {
        console.error('Error fetching assignment students:', error);
        throw error;
      }
    },
  }), [waitForApiClientReady]);
}
