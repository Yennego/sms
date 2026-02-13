import { useApiClient, createWaitForApiClientReady, useApiClientWithLoading } from './api-client';
import { useMemo } from 'react';
import {
  Attendance,
  AttendanceCreate,
  AttendanceUpdate,
  AttendanceWithDetails,
  AttendanceSummary,
  BulkAttendanceCreate,
  AttendanceFilters,
  AttendanceReport,
  AttendanceStatus
} from '@/types/attendance';
import { handleError, AppError, ErrorType } from '@/utils/error-utils';

/**
 * Attendance Service Hook
 */
export function useAttendanceService() {
  const { apiClient, isLoading: apiLoading } = useApiClientWithLoading();
  const waitForApiClientReady = useMemo(() => createWaitForApiClientReady(apiClient), [apiClient]);

  return useMemo(() => ({
    // ✅ Core CRUD Operations
    getAttendanceRecords: async (filters?: AttendanceFilters): Promise<Attendance[]> => {
      const client = await waitForApiClientReady();
      try {
        const queryParams = new URLSearchParams();
        if (filters?.student_id) queryParams.append('student_id', filters.student_id);
        if (filters?.class_id) queryParams.append('class_id', filters.class_id);
        if (filters?.schedule_id) queryParams.append('schedule_id', filters.schedule_id);
        if (filters?.academic_year_id) queryParams.append('academic_year_id', filters.academic_year_id);
        if (filters?.start_date) queryParams.append('start_date', filters.start_date);
        if (filters?.end_date) queryParams.append('end_date', filters.end_date);
        if (filters?.status) queryParams.append('status_filter', filters.status);
        if (filters?.date) queryParams.append('start_date', filters.date);
        if (filters?.date) queryParams.append('end_date', filters.date);

        const endpoint = `/academics/attendance?${queryParams.toString()}`;
        return await client.get<Attendance[]>(endpoint);
      } catch (error) {
        console.error('Error fetching attendance records:', error);
        throw error;
      }
    },

    getAttendanceById: async (id: string): Promise<Attendance> => {
      const client = await waitForApiClientReady();
      return client.get<Attendance>(`/academics/attendance/${id}`);
    },

    createAttendance: async (attendanceData: AttendanceCreate): Promise<Attendance> => {
      const client = await waitForApiClientReady();
      return client.post<Attendance>('/academics/attendance', attendanceData);
    },

    updateAttendance: async (id: string, attendanceData: AttendanceUpdate): Promise<Attendance> => {
      const client = await waitForApiClientReady();
      return client.put<Attendance>(`/academics/attendance/${id}`, attendanceData);
    },

    deleteAttendance: async (id: string): Promise<void> => {
      const client = await waitForApiClientReady();
      await client.delete<void>(`/academics/attendance/${id}`);
    },

    // ✅ Attendance Marking
    markDailyAttendance: async (data: {
      student_id: string;
      schedule_id: string;
      academic_year_id: string;
      status: AttendanceStatus;
      date?: string;
      check_in_time?: string;
      check_out_time?: string;
      comments?: string;
    }): Promise<Attendance> => {
      const client = await waitForApiClientReady();
      const queryParams = new URLSearchParams();
      Object.entries(data).forEach(([key, val]) => {
        if (val !== undefined && val !== null && val !== '') queryParams.append(key, String(val));
      });
      return client.post<Attendance>(`/academics/attendance/mark-daily?${queryParams.toString()}`);
    },

    bulkMarkAttendance: async (attendanceRecords: BulkAttendanceCreate[]): Promise<Attendance[]> => {
      const client = await waitForApiClientReady();
      return client.post<Attendance[]>('/academics/attendance/bulk-mark', attendanceRecords);
    },

    // Proper method declaration
    bulkMarkAttendanceViaProxy: async (data: {
      class_id: string;
      academic_year_id: string;
      date: string; // ISO YYYY-MM-DD
      schedule_id?: string;
      period?: number | string;
      attendances: Array<{ student_id: string; status: AttendanceStatus }>;
    }): Promise<{ results: unknown[]; resolved_schedule_id: string | null }> => {
      const client = await waitForApiClientReady();
      return client.post<{ results: unknown[]; resolved_schedule_id: string | null }>(
        '/academics/attendance/bulk-mark',
        data
      );
    },

    updateAttendanceStatus: async (
      id: string,
      data: {
        status: AttendanceStatus;
        check_in_time?: string;
        check_out_time?: string;
        comments?: string;
      }
    ): Promise<Attendance> => {
      const client = await waitForApiClientReady();
      const queryParams = new URLSearchParams();
      Object.entries(data).forEach(([key, val]) => {
        if (val !== undefined && val !== null && val !== '') queryParams.append(key, String(val));
      });
      return client.put<Attendance>(`/academics/attendance/${id}/status?${queryParams.toString()}`);
    },

    // ✅ Query Endpoints
    getStudentAttendance: async (
      studentId: string,
      filters?: { start_date?: string; end_date?: string }
    ): Promise<Attendance[]> => {
      const client = await waitForApiClientReady();
      const queryParams = new URLSearchParams();
      queryParams.append('student_id', studentId);
      if (filters?.start_date) queryParams.append('start_date', filters.start_date);
      if (filters?.end_date) queryParams.append('end_date', filters.end_date);
      const endpoint = `/academics/attendance?${queryParams.toString()}`;
      return client.get<Attendance[]>(endpoint);
    },

    getClassAttendance: async (
      classId: string,
      filters?: { start_date?: string; end_date?: string }
    ): Promise<Attendance[]> => {
      const client = await waitForApiClientReady();
      const queryParams = new URLSearchParams();
      queryParams.append('class_id', classId);
      if (filters?.start_date) queryParams.append('start_date', filters.start_date);
      if (filters?.end_date) queryParams.append('end_date', filters.end_date);
      const endpoint = `/academics/attendance?${queryParams.toString()}`;
      return client.get<Attendance[]>(endpoint);
    },

    getAttendanceByDate: async (date: string, classId?: string, scheduleId?: string): Promise<Attendance[]> => {
      const client = await waitForApiClientReady();
      try {
        const queryParams = new URLSearchParams();
        queryParams.append('start_date', date);
        queryParams.append('end_date', date);
        if (classId) queryParams.append('class_id', classId);
        if (scheduleId) queryParams.append('schedule_id', scheduleId);

        const endpoint = `/academics/attendance?${queryParams.toString()}`;
        return await client.get<Attendance[]>(endpoint);
      } catch (error) {
        const appErr = handleError(error);
        if (appErr instanceof AppError && appErr.type === ErrorType.NOT_FOUND) return [];
        throw error;
      }
    },

    // ✅ Reporting & Analytics
    getAttendanceSummary: async (filters?: {
      student_id?: string;
      class_id?: string;
      start_date?: string;
      end_date?: string;
    }): Promise<AttendanceSummary> => {
      const client = await waitForApiClientReady();
      const queryParams = new URLSearchParams();
      Object.entries(filters || {}).forEach(([key, val]) => {
        if (val) queryParams.append(key, val);
      });
      const endpoint = `/academics/attendance/summary${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
      return client.get<AttendanceSummary>(endpoint);
    },

    generateAttendanceReport: async (filters?: {
      class_id?: string;
      student_id?: string;
      start_date?: string;
      end_date?: string;
      report_type?: string;
    }): Promise<AttendanceReport> => {
      const client = await waitForApiClientReady();
      const queryParams = new URLSearchParams();
      Object.entries(filters || {}).forEach(([key, val]) => {
        if (val) queryParams.append(key, val);
      });
      const endpoint = `/academics/attendance/report${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
      return client.get<AttendanceReport>(endpoint);
    },

    getAbsentStudents: async (date?: string, classId?: string): Promise<Attendance[]> => {
      const client = await waitForApiClientReady();
      const queryParams = new URLSearchParams();
      if (date) queryParams.append('attendance_date', date);
      if (classId) queryParams.append('class_id', classId);
      const endpoint = `/academics/attendance/absent${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
      return client.get<Attendance[]>(endpoint);
    },

    getLateStudents: async (date?: string, classId?: string): Promise<Attendance[]> => {
      const client = await waitForApiClientReady();
      const queryParams = new URLSearchParams();
      if (date) queryParams.append('attendance_date', date);
      if (classId) queryParams.append('class_id', classId);
      const endpoint = `/academics/attendance/late${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
      return client.get<Attendance[]>(endpoint);
    },

    getAttendancePercentage: async (filters?: {
      student_id?: string;
      class_id?: string;
      start_date?: string;
      end_date?: string;
    }): Promise<{ attendance_percentage: number }> => {
      const client = await waitForApiClientReady();
      const queryParams = new URLSearchParams();
      if (filters?.start_date) queryParams.append('start_date', filters.start_date);
      if (filters?.end_date) queryParams.append('end_date', filters.end_date);

      let endpoint = '';
      if (filters?.student_id) {
        endpoint = `/academics/attendance/student/${filters.student_id}/percentage${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
      } else {
        // Fallback or specific class endpoint if it existed, but for now student is the main one
        return { attendance_percentage: 0 };
      }
      return client.get<{ attendance_percentage: number }>(endpoint);
    },
  }), [waitForApiClientReady]);
}
