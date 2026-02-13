import { useApiClientWithLoading, createWaitForApiClientReady } from './api-client';
import { Student, StudentCreate, StudentUpdate, StudentCreateResponse } from '@/types/student';
import { useMemo } from 'react';

export function useStudentService() {
  const { apiClient, isLoading: apiLoading } = useApiClientWithLoading();
  const waitForApiClientReady = createWaitForApiClientReady(apiClient);

  const mapStudent = (s: any): Student => ({
    ...s,
    firstName: s.firstName || s.first_name || '',
    lastName: s.lastName || s.last_name || '',
  });

  const service = useMemo(() => ({
    getStudents: async (params?: { grade?: string; section?: string; status?: string; search?: string }) => {
      const client = await waitForApiClientReady();
      const queryParams = new URLSearchParams();
      if (params?.grade) queryParams.append('grade', params.grade);
      if (params?.section) queryParams.append('section', params.section);
      if (params?.status) queryParams.append('status', params.status);
      if (params?.search) queryParams.append('search', params.search);
      const queryString = queryParams.toString();
      const endpoint = `/people/students${queryString ? `?${queryString}` : ''}`;
      const resp = await client.get<any[]>(endpoint);
      return resp.map(mapStudent);
    },
    getStudentById: async (id: string) => {
      const client = await waitForApiClientReady();
      const resp = await client.get<any>(`/people/students/${id}`);
      return mapStudent(resp);
    },
    createStudent: async (student: StudentCreate) => {
      const client = await waitForApiClientReady();
      const payload = {
        ...student,
        first_name: student.firstName,
        last_name: student.lastName,
      };
      const resp = await client.post<any>('/people/students', payload);
      return mapStudent(resp);
    },
    createStudentsBulk: async (students: StudentCreate[]) => {
      const client = await waitForApiClientReady();
      const payload = students.map(s => ({
        ...s,
        first_name: s.firstName,
        last_name: s.lastName,
      }));
      const resp = await client.post<any[]>('/people/students/bulk', payload);
      return resp.map(item => ({
        ...item,
        student: item.student ? mapStudent(item.student) : undefined
      }));
    },
    updateStudent: async (id: string, student: StudentUpdate) => {
      const client = await waitForApiClientReady();

      const cleanPayload: any = { ...student };
      if (student.firstName) {
        cleanPayload.first_name = student.firstName;
        delete cleanPayload.firstName;
      }
      if (student.lastName) {
        cleanPayload.last_name = student.lastName;
        delete cleanPayload.lastName;
      }

      const resp = await client.put<any>(`/people/students/${id}`, cleanPayload);
      return mapStudent(resp);
    },
    updateStudentStatus: async (id: string, status: string, reason?: string) => {
      const client = await waitForApiClientReady();
      const queryParams = new URLSearchParams();
      queryParams.append('status', status);
      if (reason) queryParams.append('reason', reason);
      const resp = await client.put<any>(`/people/students/${id}/status?${queryParams.toString()}`, {});
      return mapStudent(resp);
    },
    deleteStudent: async (id: string) => {
      const client = await waitForApiClientReady();
      return client.delete<void>(`/people/students/${id}`);
    },
    bulkDeleteStudents: async (studentIds: string[]) => {
      const client = await waitForApiClientReady();
      return client.delete<any>('/people/students/action/bulk-delete', {
        data: { student_ids: studentIds }
      });
    },
    getStudentsPaged: async (
      skip?: number,
      limit?: number,
      params?: { grade?: string; section?: string; status?: string; search?: string }
    ) => {
      const client = await waitForApiClientReady();
      const queryParams = new URLSearchParams();
      if (typeof skip === 'number') queryParams.append('skip', String(skip));
      if (typeof limit === 'number') queryParams.append('limit', String(limit));
      if (params?.grade) queryParams.append('grade', params.grade);
      if (params?.section) queryParams.append('section', params.section);
      if (params?.status) queryParams.append('status', params.status);
      if (params?.search) queryParams.append('search', params.search);
      const queryString = queryParams.toString();
      const endpoint = `/people/students${queryString ? `?${queryString}` : ''}`;
      const resp = await client.get<any[]>(endpoint);
      return resp.map(mapStudent);
    },
  }), [waitForApiClientReady]);

  return service;
}
