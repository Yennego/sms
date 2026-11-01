// Staff area service (remodel): teachers with username and optional email, admin password reset,
// what a teacher teaches and which classes they sponsor. Kept separate from teacher-service.ts,
// which older pages still use.

import { useMemo } from 'react';
import { useApiClientWithLoading, createWaitForApiClientReady } from './api-client';

export type StaffStatus = 'active' | 'inactive' | 'retired' | 'resigned';

export interface StaffMember {
  id: string;
  email?: string | null;
  username?: string | null;
  first_name: string;
  last_name: string;
  phone_number?: string | null;
  is_active: boolean;
  last_login?: string | null;
  created_at?: string;
  updated_at?: string;
  employee_id: string;
  department?: string | null;
  qualification?: string | null;
  joining_date?: string | null;
  is_class_teacher: boolean;
  address?: string | null;
  city?: string | null;
  county?: string | null;
  country?: string | null;
  gender?: string | null;
  whatsapp_number?: string | null;
  status: StaffStatus | string;
  exit_date?: string | null;
}

export interface StaffCreate {
  first_name: string;
  last_name: string;
  email?: string;
  username?: string;
  employee_id?: string;
  phone_number?: string;
  department?: string;
  qualification?: string;
  joining_date?: string;
  gender?: string;
  address?: string;
}

export interface StaffCreateResult extends StaffMember {
  generated_password?: string | null;
}

export interface StaffUpdate {
  first_name?: string;
  last_name?: string;
  email?: string | null;
  username?: string;
  employee_id?: string;
  phone_number?: string | null;
  department?: string | null;
  qualification?: string | null;
  joining_date?: string | null;
  gender?: string | null;
  address?: string | null;
  status?: StaffStatus;
  is_active?: boolean;
}

/** One subject a teacher teaches in one class (GET /academics/teacher-subject-assignments/teacher/{id}). */
export interface TeachingAssignment {
  id: string;
  class_id: string;
  subject_id: string;
  subject_name?: string | null;
  name?: string | null;
  class_name?: string | null;
  grade_name?: string | null;
  section_name?: string | null;
  academic_year?: string | null;
  academic_year_id?: string | null;
}

/** The fields of a class (GET /academics/classes) the Staff area uses. */
export interface StaffClass {
  id: string;
  name?: string | null;
  grade_name?: string | null;
  section_name?: string | null;
  academic_year_id: string;
  academic_year_name?: string | null;
  class_teacher_id?: string | null;
  is_active: boolean;
}

export interface PasswordResetResult {
  message?: string;
  generated_password: string;
}

function asList<T>(response: unknown): T[] {
  if (Array.isArray(response)) return response as T[];
  if (response && typeof response === 'object' && 'data' in response) {
    const data = (response as { data: unknown }).data;
    return Array.isArray(data) ? (data as T[]) : [];
  }
  return [];
}

export function useStaffService() {
  const { apiClient } = useApiClientWithLoading();
  const ready = useMemo(() => createWaitForApiClientReady(apiClient), [apiClient]);

  return useMemo(
    () => ({
      listTeachers: async (): Promise<StaffMember[]> => {
        const client = await ready();
        return asList<StaffMember>(await client.get('/people/teachers?skip=0&limit=1000'));
      },

      getTeacher: async (id: string): Promise<StaffMember> => {
        const client = await ready();
        return client.get<StaffMember>(`/people/teachers/${id}`);
      },

      getDepartments: async (): Promise<string[]> => {
        const client = await ready();
        return asList<string>(await client.get('/people/teachers/departments'));
      },

      createTeacher: async (data: StaffCreate): Promise<StaffCreateResult> => {
        const client = await ready();
        return client.post<StaffCreateResult>('/people/teachers', data);
      },

      updateTeacher: async (id: string, data: StaffUpdate): Promise<StaffMember> => {
        const client = await ready();
        return client.put<StaffMember>(`/people/teachers/${id}`, data);
      },

      /** Issues a new password; the user must change it at next sign-in. */
      resetPassword: async (userId: string): Promise<PasswordResetResult> => {
        const client = await ready();
        return client.post<PasswordResetResult>(`/auth/admin/reset-password/${userId}`, {});
      },

      getTeachingAssignments: async (teacherId: string, academicYearId?: string): Promise<TeachingAssignment[]> => {
        const client = await ready();
        const params = new URLSearchParams({ skip: '0', limit: '1000' });
        if (academicYearId) params.append('academic_year_id', academicYearId);
        return asList<TeachingAssignment>(
          await client.get(`/academics/teacher-subject-assignments/teacher/${teacherId}?${params.toString()}`)
        );
      },

      /** Classes, optionally for one year or one sponsor (class_teacher_id). */
      getClasses: async (filters: { academicYearId?: string; sponsorId?: string } = {}): Promise<StaffClass[]> => {
        const client = await ready();
        const params = new URLSearchParams({ skip: '0', limit: '1000' });
        if (filters.academicYearId) params.append('academic_year_id', filters.academicYearId);
        if (filters.sponsorId) params.append('class_teacher_id', filters.sponsorId);
        return asList<StaffClass>(await client.get(`/academics/classes?${params.toString()}`, { timeout: 60000 }));
      },
    }),
    [ready]
  );
}
