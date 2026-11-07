'use client';

// TanStack Query hooks for the Attendance area. Every key starts with the school, so a phone that
// signs into another school never shows the wrong class.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useSchoolKey } from '@/components/students/queries';
import { useClassService } from '@/services/api/class-service';
import { useDailyAttendanceService } from '@/services/api/daily-attendance-service';
import type {
  AttendanceSettings,
  DailyBulkInput,
  ExcuseDocument,
  ExcuseStatus,
} from '@/types/daily-attendance';

export const attendanceKeys = {
  all: (school: string | null) => ['attendance', school] as const,
  overview: (school: string | null, date: string) => [...attendanceKeys.all(school), 'overview', date] as const,
  dayInfo: (school: string | null) => [...attendanceKeys.all(school), 'day-info'] as const,
  classes: (school: string | null, sponsorId: string) => [...attendanceKeys.all(school), 'classes', sponsorId] as const,
  roster: (school: string | null, classId: string, date: string) =>
    [...attendanceKeys.all(school), 'roster', classId, date] as const,
  events: (school: string | null, dailyId: string) => [...attendanceKeys.all(school), 'events', dailyId] as const,
  excuses: (school: string | null, status: ExcuseStatus) => [...attendanceKeys.all(school), 'excuses', status] as const,
  report: (school: string | null, classId: string, start: string, end: string) =>
    [...attendanceKeys.all(school), 'report', classId, start, end] as const,
  idCards: (school: string | null, classId: string) => [...attendanceKeys.all(school), 'id-cards', classId] as const,
  settings: (school: string | null) => [...attendanceKeys.all(school), 'settings'] as const,
  calendar: (school: string | null, from: string, to: string) =>
    [...attendanceKeys.all(school), 'calendar', from, to] as const,
  history: (school: string | null, studentId: string) => [...attendanceKeys.all(school), 'history', studentId] as const,
};

/** Today in the school's time zone ("" until known), and whether it is a school day. */
export function useSchoolToday() {
  const { getDayInfo } = useDailyAttendanceService();
  const school = useSchoolKey();
  const query = useQuery({
    queryKey: attendanceKeys.dayInfo(school),
    queryFn: () => getDayInfo(),
    enabled: Boolean(school),
    staleTime: 5 * 60 * 1000,
  });
  return { today: query.data?.today ?? '', isLoading: query.isLoading };
}

/** The whole school's day, class by class. `date` "" means the school's today. */
export function useAttendanceOverview(date: string, enabled = true) {
  const { getOverview } = useDailyAttendanceService();
  const school = useSchoolKey();
  return useQuery({
    queryKey: attendanceKeys.overview(school, date),
    queryFn: () => getOverview(date || undefined),
    enabled: Boolean(school) && enabled,
    refetchInterval: 60 * 1000, // scans keep arriving through the morning
  });
}

/** Active classes: every class, or (with `sponsorId`) the classes that person sponsors. */
export function useAttendanceClasses(sponsorId?: string, enabled = true) {
  const { getClasses } = useClassService();
  const school = useSchoolKey();
  return useQuery({
    queryKey: attendanceKeys.classes(school, sponsorId ?? ''),
    queryFn: async () => {
      const list = await getClasses(sponsorId ? { class_teacher_id: sponsorId, is_active: true } : { is_active: true });
      return list
        .map((c) => ({ id: c.id, name: c.name || [c.grade_name, c.section_name].filter(Boolean).join(' - ') || 'Unnamed class' }))
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    },
    enabled: Boolean(school) && enabled,
    staleTime: 5 * 60 * 1000,
  });
}

export function useClassRoster(classId: string, date: string) {
  const { getRoster } = useDailyAttendanceService();
  const school = useSchoolKey();
  return useQuery({
    queryKey: attendanceKeys.roster(school, classId, date),
    queryFn: () => getRoster(classId, date || undefined),
    enabled: Boolean(school && classId),
  });
}

export function useAttendanceEvents(dailyId: string | null) {
  const { getEvents } = useDailyAttendanceService();
  const school = useSchoolKey();
  return useQuery({
    queryKey: attendanceKeys.events(school, dailyId ?? ''),
    queryFn: () => getEvents(dailyId as string),
    enabled: Boolean(school && dailyId),
  });
}

/** Save a class's marks, then attach any excuse documents to the saved records. */
export function useSaveRoster() {
  const { saveRoster, setExcuse } = useDailyAttendanceService();
  const school = useSchoolKey();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { input: DailyBulkInput; documents: Record<string, ExcuseDocument> }) => {
      const saved = await saveRoster(vars.input);
      const failedDocuments: string[] = [];
      for (const [studentId, doc] of Object.entries(vars.documents)) {
        const record = saved.find((r) => r.student_id === studentId);
        const reason = vars.input.entries.find((e) => e.student_id === studentId)?.excuse_reason;
        if (!record || !reason) continue;
        try {
          await setExcuse(record.id, reason, doc);
        } catch {
          failedDocuments.push(studentId);
        }
      }
      return { saved, failedDocuments };
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: attendanceKeys.all(school) }),
  });
}

/** Admins: everyone not marked on `date` is recorded absent. */
export function useCloseDay() {
  const { closeDay } = useDailyAttendanceService();
  const school = useSchoolKey();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (date: string) => closeDay(date || undefined),
    onSettled: () => queryClient.invalidateQueries({ queryKey: attendanceKeys.all(school) }),
  });
}

export function useExcuses(status: ExcuseStatus) {
  const { listExcuses } = useDailyAttendanceService();
  const school = useSchoolKey();
  return useQuery({
    queryKey: attendanceKeys.excuses(school, status),
    queryFn: () => listExcuses(status),
    enabled: Boolean(school),
  });
}

export function useReviewExcuse() {
  const { reviewExcuse } = useDailyAttendanceService();
  const school = useSchoolKey();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { dailyId: string; approve: boolean; notes?: string }) =>
      reviewExcuse(vars.dailyId, vars.approve, vars.notes),
    onSettled: () => queryClient.invalidateQueries({ queryKey: attendanceKeys.all(school) }),
  });
}

/** A class's report for a period ("" dates = the school year so far). Runs once a class is chosen. */
export function useClassReport(classId: string, start: string, end: string) {
  const { getClassReport } = useDailyAttendanceService();
  const school = useSchoolKey();
  return useQuery({
    queryKey: attendanceKeys.report(school, classId, start, end),
    queryFn: () => getClassReport(classId, start || undefined, end || undefined),
    enabled: Boolean(school && classId),
  });
}

export function useClassIdCards(classId: string) {
  const { getClassIdCards } = useDailyAttendanceService();
  const school = useSchoolKey();
  return useQuery({
    queryKey: attendanceKeys.idCards(school, classId),
    queryFn: () => getClassIdCards(classId),
    enabled: Boolean(school && classId),
  });
}

export function useReissueIdCard(classId: string) {
  const { reissueIdCard } = useDailyAttendanceService();
  const school = useSchoolKey();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (studentId: string) => reissueIdCard(studentId),
    onSettled: () => queryClient.invalidateQueries({ queryKey: attendanceKeys.idCards(school, classId) }),
  });
}

export function useAttendanceSettings() {
  const { getSettings } = useDailyAttendanceService();
  const school = useSchoolKey();
  return useQuery({
    queryKey: attendanceKeys.settings(school),
    queryFn: () => getSettings(),
    enabled: Boolean(school),
  });
}

export function useSaveAttendanceSettings() {
  const { updateSettings } = useDailyAttendanceService();
  const school = useSchoolKey();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: AttendanceSettings) => updateSettings(data),
    onSuccess: (saved) => queryClient.setQueryData(attendanceKeys.settings(school), saved),
    onSettled: () => queryClient.invalidateQueries({ queryKey: attendanceKeys.all(school) }),
  });
}

export function useSchoolCalendar(from: string, to: string) {
  const { listCalendar } = useDailyAttendanceService();
  const school = useSchoolKey();
  return useQuery({
    queryKey: attendanceKeys.calendar(school, from, to),
    queryFn: () => listCalendar(from, to),
    enabled: Boolean(school && from && to),
  });
}

export function useSetCalendarDay() {
  const { setCalendarDay, deleteCalendarDay } = useDailyAttendanceService();
  const school = useSchoolKey();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { date: string; remove?: boolean; isSchoolDay?: boolean; label?: string }) => {
      if (vars.remove) await deleteCalendarDay(vars.date);
      else await setCalendarDay(vars.date, Boolean(vars.isSchoolDay), vars.label);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: attendanceKeys.all(school) }),
  });
}

export function useStudentAttendanceHistory(studentId: string, refreshKey = 0) {
  const { getStudentHistory } = useDailyAttendanceService();
  const school = useSchoolKey();
  return useQuery({
    queryKey: [...attendanceKeys.history(school, studentId), refreshKey],
    queryFn: () => getStudentHistory(studentId),
    enabled: Boolean(school && studentId),
  });
}
