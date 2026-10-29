// Reads and actions behind the Students area (directory and student profile).
// Every call goes to an endpoint that exists today; see the Students area report for gaps.
import { useMemo } from 'react';

import { createWaitForApiClientReady, useApiClientWithLoading } from './api-client';
import type { StudentDailyHistory, IdCard } from '@/types/daily-attendance';

export interface StudentRecord {
  id: string;
  first_name: string;
  last_name: string;
  username?: string | null;
  email?: string | null;
  phone_number?: string | null;
  admission_number: string;
  admission_date?: string | null;
  date_of_birth?: string | null;
  gender?: string | null;
  address?: string | null;
  status: string;
  is_active?: boolean;
  photo?: string | null;
}

export interface StudentRecordUpdate {
  first_name?: string;
  last_name?: string;
  gender?: string | null;
  date_of_birth?: string | null;
  admission_number?: string;
  admission_date?: string | null;
  email?: string | null;
  username?: string;
  phone_number?: string | null;
  address?: string | null;
}

/** An enrollment as returned by /people/students/{id}/enrollments (fields vary while the table is merged). */
export interface StudentEnrollment {
  id: string;
  student_id: string;
  academic_year_id: string;
  academic_year?: string | null;
  grade_id?: string | null;
  section_id?: string | null;
  grade?: string | null;
  section?: string | null;
  grade_name?: string | null;
  section_name?: string | null;
  class_id?: string | null;
  class_name?: string | null;
  enrollment_date?: string | null;
  status: string;
  is_active: boolean;
  withdrawal_date?: string | null;
  withdrawal_reason?: string | null;
}

export interface GuardianRecord {
  id: string;
  first_name: string;
  last_name: string;
  username?: string | null;
  email?: string | null;
  phone_number?: string | null;
  whatsapp_number?: string | null;
  relationship_type: string;
  status?: string;
}

export interface CurrentYear {
  id: string;
  name: string;
  start_date?: string;
  end_date?: string;
}

export interface YearClass {
  id: string;
  name?: string | null;
  academic_year_id: string;
  grade_id: string;
  section_id: string;
  grade_name?: string | null;
  section_name?: string | null;
  capacity?: number;
  is_active?: boolean;
}

export interface PublishedGrade {
  id: string;
  subject_id: string;
  subject_name?: string | null;
  assessment_name: string;
  assessment_type: string;
  assessment_date: string;
  score: number;
  max_score: number;
  percentage: number;
  letter_grade?: string | null;
  period_number?: number | null;
  semester?: number | null;
  is_published?: boolean;
}

const PAGE = 200;
const ENROLLMENT_CHUNK = 100;

export function useStudentRecordsService() {
  const { apiClient } = useApiClientWithLoading();
  const waitForApiClientReady = useMemo(() => createWaitForApiClientReady(apiClient), [apiClient]);

  return useMemo(
    () => ({
      /** Every student of the school (the list endpoint pages by skip/limit). */
      listAllStudents: async (): Promise<StudentRecord[]> => {
        const client = await waitForApiClientReady();
        const all: StudentRecord[] = [];
        for (let skip = 0; skip < 10000; skip += PAGE) {
          const resp = await client.get<{ items: StudentRecord[]; total: number } | StudentRecord[]>(
            `/people/students?skip=${skip}&limit=${PAGE}`
          );
          const items = Array.isArray(resp) ? resp : resp?.items ?? [];
          all.push(...items);
          const total = Array.isArray(resp) ? items.length : resp?.total ?? 0;
          if (Array.isArray(resp) || items.length < PAGE || all.length >= total) break;
        }
        return all;
      },

      getStudent: async (id: string): Promise<StudentRecord> => {
        const client = await waitForApiClientReady();
        return client.get<StudentRecord>(`/people/students/${id}`);
      },

      updateStudent: async (id: string, data: StudentRecordUpdate): Promise<StudentRecord> => {
        const client = await waitForApiClientReady();
        return client.put<StudentRecord>(`/people/students/${id}`, data);
      },

      setStatus: async (id: string, status: 'active' | 'inactive', reason?: string): Promise<StudentRecord> => {
        const client = await waitForApiClientReady();
        const qs = new URLSearchParams({ status });
        if (reason) qs.append('reason', reason);
        return client.put<StudentRecord>(`/people/students/${id}/status?${qs.toString()}`, {});
      },

      getEnrollments: async (id: string): Promise<StudentEnrollment[]> => {
        const client = await waitForApiClientReady();
        const resp = await client.get<StudentEnrollment[]>(`/people/students/${id}/enrollments`);
        return Array.isArray(resp) ? resp : [];
      },

      /** Current enrollment per student id (null when not enrolled). */
      getCurrentEnrollments: async (ids: string[]): Promise<Record<string, StudentEnrollment | null>> => {
        const client = await waitForApiClientReady();
        const out: Record<string, StudentEnrollment | null> = {};
        for (let i = 0; i < ids.length; i += ENROLLMENT_CHUNK) {
          const chunk = ids.slice(i, i + ENROLLMENT_CHUNK);
          const resp = await client.post<
            Record<string, StudentEnrollment | null> | { enrollments: Record<string, StudentEnrollment | null> }
          >('/people/students/bulk-enrollments', { student_ids: chunk });
          const map =
            resp && typeof resp === 'object' && 'enrollments' in resp && typeof resp.enrollments === 'object'
              ? (resp.enrollments as Record<string, StudentEnrollment | null>)
              : ((resp ?? {}) as Record<string, StudentEnrollment | null>);
          Object.assign(out, map);
        }
        return out;
      },

      getGuardians: async (studentId: string): Promise<GuardianRecord[]> => {
        const client = await waitForApiClientReady();
        const resp = await client.get<GuardianRecord[]>(`/people/parents/by-student/${studentId}`);
        return Array.isArray(resp) ? resp : [];
      },

      getAttendanceHistory: async (studentId: string, startDate?: string, endDate?: string): Promise<StudentDailyHistory> => {
        const client = await waitForApiClientReady();
        const qs = new URLSearchParams();
        if (startDate) qs.append('start_date', startDate);
        if (endDate) qs.append('end_date', endDate);
        const q = qs.toString();
        return client.get<StudentDailyHistory>(`/academics/attendance/daily/student/${studentId}${q ? `?${q}` : ''}`);
      },

      getGrades: async (studentId: string): Promise<PublishedGrade[]> => {
        const client = await waitForApiClientReady();
        const resp = await client.get<PublishedGrade[]>(`/academics/grades?student_id=${studentId}&limit=1000`);
        return Array.isArray(resp) ? resp : [];
      },

      /** Returns the new one-time password. */
      resetPassword: async (userId: string): Promise<string> => {
        const client = await waitForApiClientReady();
        const resp = await client.post<{ generated_password: string }>(`/auth/admin/reset-password/${userId}`);
        return resp.generated_password;
      },

      reissueIdCard: async (studentId: string): Promise<IdCard> => {
        const client = await waitForApiClientReady();
        return client.post<IdCard>(`/academics/attendance/id-cards/${studentId}/reissue`);
      },

      getCurrentYear: async (): Promise<CurrentYear | null> => {
        const client = await waitForApiClientReady();
        try {
          return await client.get<CurrentYear>('/academics/academic-years/current');
        } catch (error) {
          if ((error as { statusCode?: number })?.statusCode === 404) return null;
          throw error;
        }
      },

      getYearClasses: async (academicYearId: string): Promise<YearClass[]> => {
        const client = await waitForApiClientReady();
        const resp = await client.get<YearClass[]>(
          `/academics/classes?academic_year_id=${academicYearId}&skip=0&limit=500`
        );
        return Array.isArray(resp) ? resp : [];
      },
    }),
    [waitForApiClientReady]
  );
}
