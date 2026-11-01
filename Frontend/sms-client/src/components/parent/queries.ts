'use client';

// TanStack Query hooks for the parent portal. Every key starts with the school, so a shared phone
// that signs into another school never shows the wrong family.
import { useQuery } from '@tanstack/react-query';

import { resultsKeys, useSchoolKey } from '@/components/report-cards/queries';
import { useDailyAttendanceService } from '@/services/api/daily-attendance-service';
import { useFamilyService } from '@/services/api/family-service';
import type { ChildSummary } from '@/types/daily-attendance';

export const familyKeys = {
  all: (school: string | null) => ['family', school] as const,
  students: (school: string | null) => [...familyKeys.all(school), 'students'] as const,
  statement: (school: string | null, studentId: string, yearId: string) =>
    [...familyKeys.all(school), 'statement', studentId, yearId] as const,
  receipt: (school: string | null, paymentId: string) => [...familyKeys.all(school), 'receipt', paymentId] as const,
  dayInfo: (school: string | null) => [...familyKeys.all(school), 'day-info'] as const,
  attendance: (school: string | null, studentId: string, from: string, to: string) =>
    [...familyKeys.all(school), 'attendance', studentId, from, to] as const,
};

/** HTTP status of a failed request (AppError.statusCode), if any. */
export function statusOf(error: unknown): number | undefined {
  const s = (error as { statusCode?: unknown } | null)?.statusCode;
  return typeof s === 'number' ? s : undefined;
}

const noRetryOnClientErrors = (count: number, error: unknown) => {
  const status = statusOf(error);
  return !(status && status >= 400 && status < 500) && count < 2;
};

/**
 * The report card answers 403 "This report card is held until school fees are paid..." when the
 * school holds report cards for arrears (phase5-design.md section 5).
 */
export function isReportCardHeld(error: unknown): boolean {
  if (statusOf(error) !== 403) return false;
  const message = error instanceof Error ? error.message : String((error as { message?: unknown })?.message ?? '');
  return /held/i.test(message) && /fee/i.test(message);
}

/** The signed-in parent's children (GET /academics/attendance/daily/my-children). Shared with the results page. */
export function useMyChildren() {
  const { getMyChildren } = useDailyAttendanceService();
  const school = useSchoolKey();
  return useQuery<ChildSummary[]>({
    queryKey: [...resultsKeys.all(school), 'my-children'],
    queryFn: () => getMyChildren(),
    enabled: Boolean(school),
    staleTime: 5 * 60 * 1000,
  });
}

/** Balance and overdue per child (GET /finance/family/students). */
export function useFamilyStudents() {
  const service = useFamilyService();
  const school = useSchoolKey();
  return useQuery({
    queryKey: familyKeys.students(school),
    queryFn: () => service.getStudents(),
    enabled: Boolean(school),
    staleTime: 60 * 1000,
    retry: noRetryOnClientErrors,
  });
}

/** One child's read-only statement for a year (GET /finance/family/accounts/{id}). */
export function useFamilyStatement(studentId: string | undefined, yearId: string | undefined) {
  const service = useFamilyService();
  const school = useSchoolKey();
  return useQuery({
    queryKey: familyKeys.statement(school, studentId ?? '', yearId ?? ''),
    queryFn: () => service.getStatement(studentId as string, yearId || undefined),
    enabled: Boolean(school && studentId),
    staleTime: 60 * 1000,
    retry: noRetryOnClientErrors,
  });
}

/** A receipt (GET /finance/family/payments/{id}). */
export function useFamilyReceipt(paymentId: string | undefined) {
  const service = useFamilyService();
  const school = useSchoolKey();
  return useQuery({
    queryKey: familyKeys.receipt(school, paymentId ?? ''),
    queryFn: () => service.getReceipt(paymentId as string),
    enabled: Boolean(school && paymentId),
    staleTime: 5 * 60 * 1000,
    retry: noRetryOnClientErrors,
  });
}

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function shiftDay(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return isoDate(d);
}

/** Today in the school's time zone, and whether it is a school day (falls back to the phone's date). */
export function useSchoolDay() {
  const { getDayInfo } = useDailyAttendanceService();
  const school = useSchoolKey();
  const query = useQuery({
    queryKey: familyKeys.dayInfo(school),
    queryFn: () => getDayInfo(),
    enabled: Boolean(school),
    staleTime: 5 * 60 * 1000,
    retry: noRetryOnClientErrors,
  });
  return {
    today: query.data?.today ?? isoDate(new Date()),
    isSchoolDay: query.data ? query.data.is_school_day : null,
    isLoading: query.isLoading,
  };
}

/** The last 14 days of a child's school-day attendance, today included. */
export function useRecentAttendance(studentId: string | undefined, today: string) {
  const { getStudentHistory } = useDailyAttendanceService();
  const school = useSchoolKey();
  const from = shiftDay(today, -14);
  return useQuery({
    queryKey: familyKeys.attendance(school, studentId ?? '', from, today),
    queryFn: () => getStudentHistory(studentId as string, from, today),
    enabled: Boolean(school && studentId),
    staleTime: 60 * 1000,
    retry: noRetryOnClientErrors,
  });
}
