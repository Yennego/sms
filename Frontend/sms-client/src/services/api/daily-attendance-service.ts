import { createWaitForApiClientReady, useApiClientWithLoading } from './api-client';
import { useMemo } from 'react';
import {
  AttendanceEvent,
  AttendanceSettings,
  ChildSummary,
  DailyAttendanceRecord,
  DailyBulkInput,
  DailyRoster,
  DailyStatusInput,
  ExcuseDocument,
  ExcuseListItem,
  ExcuseStatus,
  IdCard,
  ParentExcuseInput,
  ScanMode,
  ScanResult,
  SchoolCalendarDay,
  SchoolDayInfo,
  StudentDailyHistory,
} from '@/types/daily-attendance';

const BASE = '/academics/attendance';

const qs = (params: Record<string, string | undefined>) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) query.append(key, value);
  });
  const text = query.toString();
  return text ? `?${text}` : '';
};

/**
 * School-day attendance: one record per student per day (manual, QR scan or auto-absent).
 */
export function useDailyAttendanceService() {
  const { apiClient } = useApiClientWithLoading();
  const waitForApiClientReady = useMemo(() => createWaitForApiClientReady(apiClient), [apiClient]);

  return useMemo(() => ({
    // Roster & marking
    getRoster: async (classId: string, date?: string): Promise<DailyRoster> => {
      const client = await waitForApiClientReady();
      return client.get<DailyRoster>(`${BASE}/daily${qs({ class_id: classId, date })}`);
    },

    saveRoster: async (data: DailyBulkInput): Promise<DailyAttendanceRecord[]> => {
      const client = await waitForApiClientReady();
      return client.post<DailyAttendanceRecord[]>(`${BASE}/daily/bulk`, data);
    },

    setStatus: async (studentId: string, data: DailyStatusInput, date?: string): Promise<DailyAttendanceRecord> => {
      const client = await waitForApiClientReady();
      return client.put<DailyAttendanceRecord>(`${BASE}/daily/${studentId}${qs({ date })}`, data);
    },

    setExcuse: async (dailyId: string, reason: string, document?: ExcuseDocument): Promise<DailyAttendanceRecord> => {
      const client = await waitForApiClientReady();
      return client.put<DailyAttendanceRecord>(`${BASE}/daily/${dailyId}/excuse`, { reason, document });
    },

    getExcuseDocument: async (dailyId: string): Promise<ExcuseDocument> => {
      const client = await waitForApiClientReady();
      return client.get<ExcuseDocument>(`${BASE}/daily/${dailyId}/excuse/document`);
    },

    listExcuses: async (status: ExcuseStatus = 'pending'): Promise<ExcuseListItem[]> => {
      const client = await waitForApiClientReady();
      return client.get<ExcuseListItem[]>(`${BASE}/daily/excuses${qs({ status })}`);
    },

    // Parents
    getMyChildren: async (): Promise<ChildSummary[]> => {
      const client = await waitForApiClientReady();
      return client.get<ChildSummary[]>(`${BASE}/daily/my-children`);
    },

    submitParentExcuse: async (data: ParentExcuseInput): Promise<DailyAttendanceRecord> => {
      const client = await waitForApiClientReady();
      return client.post<DailyAttendanceRecord>(`${BASE}/daily/excuses`, data);
    },

    reviewExcuse: async (dailyId: string, approve: boolean, notes?: string): Promise<DailyAttendanceRecord> => {
      const client = await waitForApiClientReady();
      return client.post<DailyAttendanceRecord>(`${BASE}/daily/${dailyId}/excuse/review`, { approve, notes });
    },

    closeDay: async (date?: string): Promise<{ date: string; marked_absent: number }> => {
      const client = await waitForApiClientReady();
      return client.post<{ date: string; marked_absent: number }>(`${BASE}/daily/close-day${qs({ date })}`);
    },

    getStudentHistory: async (studentId: string, startDate?: string, endDate?: string): Promise<StudentDailyHistory> => {
      const client = await waitForApiClientReady();
      return client.get<StudentDailyHistory>(
        `${BASE}/daily/student/${studentId}${qs({ start_date: startDate, end_date: endDate })}`
      );
    },

    getEvents: async (dailyId: string): Promise<AttendanceEvent[]> => {
      const client = await waitForApiClientReady();
      return client.get<AttendanceEvent[]>(`${BASE}/daily/${dailyId}/events`);
    },

    // QR scanning & ID cards
    scan: async (token: string, mode: ScanMode, deviceLabel?: string): Promise<ScanResult> => {
      const client = await waitForApiClientReady();
      return client.post<ScanResult>(`${BASE}/scan`, { token, mode, device_label: deviceLabel || undefined });
    },

    manualCheckIn: async (admissionNumber: string, deviceLabel?: string): Promise<ScanResult> => {
      const client = await waitForApiClientReady();
      return client.post<ScanResult>(`${BASE}/scan/manual`, {
        admission_number: admissionNumber,
        device_label: deviceLabel || undefined,
      });
    },

    getClassIdCards: async (classId: string): Promise<IdCard[]> => {
      const client = await waitForApiClientReady();
      return client.get<IdCard[]>(`${BASE}/id-cards${qs({ class_id: classId })}`);
    },

    reissueIdCard: async (studentId: string): Promise<IdCard> => {
      const client = await waitForApiClientReady();
      return client.post<IdCard>(`${BASE}/id-cards/${studentId}/reissue`);
    },

    // Settings & calendar
    getSettings: async (): Promise<AttendanceSettings> => {
      const client = await waitForApiClientReady();
      return client.get<AttendanceSettings>(`${BASE}/settings`);
    },

    updateSettings: async (data: AttendanceSettings): Promise<AttendanceSettings> => {
      const client = await waitForApiClientReady();
      return client.put<AttendanceSettings>(`${BASE}/settings`, data);
    },

    getDayInfo: async (date?: string): Promise<SchoolDayInfo> => {
      const client = await waitForApiClientReady();
      return client.get<SchoolDayInfo>(`${BASE}/calendar/day-info${qs({ date })}`);
    },

    listCalendar: async (startDate: string, endDate: string): Promise<SchoolCalendarDay[]> => {
      const client = await waitForApiClientReady();
      return client.get<SchoolCalendarDay[]>(`${BASE}/calendar${qs({ start_date: startDate, end_date: endDate })}`);
    },

    setCalendarDay: async (date: string, isSchoolDay: boolean, label?: string): Promise<SchoolCalendarDay> => {
      const client = await waitForApiClientReady();
      return client.put<SchoolCalendarDay>(`${BASE}/calendar/${date}`, { is_school_day: isSchoolDay, label });
    },

    deleteCalendarDay: async (date: string): Promise<void> => {
      const client = await waitForApiClientReady();
      await client.delete<void>(`${BASE}/calendar/${date}`);
    },
  }), [waitForApiClientReady]);
}
