// TanStack Query hooks for the Students area. Every key starts with the school, so switching
// schools never shows another school's data.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useTenant } from '@/hooks/use-tenant';
import { useStudentRecordsService, type StudentRecordUpdate } from '@/services/api/student-records-service';
import { useAdmissionsService, type AdmissionRequest, type AdmissionRow } from '@/services/api/admissions-service';
import { classPlacementKeys } from '@/components/class-placement/queries';

export const studentAreaKeys = {
  all: (school: string | null) => ['students-area', school] as const,
  student: (school: string | null, id: string) => [...studentAreaKeys.all(school), 'student', id] as const,
  enrollments: (school: string | null, id: string) => [...studentAreaKeys.student(school, id), 'enrollments'] as const,
  guardians: (school: string | null, id: string) => [...studentAreaKeys.student(school, id), 'guardians'] as const,
  attendance: (school: string | null, id: string, start: string, end: string) =>
    [...studentAreaKeys.student(school, id), 'attendance', start, end] as const,
  grades: (school: string | null, id: string) => [...studentAreaKeys.student(school, id), 'grades'] as const,
  currentYear: (school: string | null) => [...studentAreaKeys.all(school), 'current-year'] as const,
  yearClasses: (school: string | null, yearId: string) => [...studentAreaKeys.all(school), 'year-classes', yearId] as const,
  guardianSearch: (school: string | null, q: string) => [...studentAreaKeys.all(school), 'guardian-search', q] as const,
};

export function useSchoolKey() {
  const { tenantKey } = useTenant();
  return tenantKey;
}

export function useStudentRecord(id: string) {
  const service = useStudentRecordsService();
  const school = useSchoolKey();
  return useQuery({
    queryKey: studentAreaKeys.student(school, id),
    queryFn: () => service.getStudent(id),
    enabled: Boolean(school && id),
    retry: (count, error) => (error as { statusCode?: number })?.statusCode !== 404 && count < 2,
  });
}

export function useStudentEnrollments(id: string) {
  const service = useStudentRecordsService();
  const school = useSchoolKey();
  return useQuery({
    queryKey: studentAreaKeys.enrollments(school, id),
    queryFn: () => service.getEnrollments(id),
    enabled: Boolean(school && id),
  });
}

export function useStudentGuardians(id: string, enabled = true) {
  const service = useStudentRecordsService();
  const school = useSchoolKey();
  return useQuery({
    queryKey: studentAreaKeys.guardians(school, id),
    queryFn: () => service.getGuardians(id),
    enabled: Boolean(school && id) && enabled,
  });
}

export function useStudentAttendance(id: string, start: string, end: string) {
  const service = useStudentRecordsService();
  const school = useSchoolKey();
  return useQuery({
    queryKey: studentAreaKeys.attendance(school, id, start, end),
    queryFn: () => service.getAttendanceHistory(id, start, end),
    enabled: Boolean(school && id),
  });
}

export function useStudentGrades(id: string) {
  const service = useStudentRecordsService();
  const school = useSchoolKey();
  return useQuery({
    queryKey: studentAreaKeys.grades(school, id),
    queryFn: () => service.getGrades(id),
    enabled: Boolean(school && id),
  });
}

export function useCurrentYear() {
  const service = useStudentRecordsService();
  const school = useSchoolKey();
  return useQuery({
    queryKey: studentAreaKeys.currentYear(school),
    queryFn: () => service.getCurrentYear(),
    enabled: Boolean(school),
    staleTime: 10 * 60 * 1000,
  });
}

/** Classes of the current school year. */
export function useCurrentYearClasses() {
  const service = useStudentRecordsService();
  const school = useSchoolKey();
  const year = useCurrentYear();
  const yearId = year.data?.id ?? '';
  const classes = useQuery({
    queryKey: studentAreaKeys.yearClasses(school, yearId),
    queryFn: () => service.getYearClasses(yearId),
    enabled: Boolean(school && yearId),
    staleTime: 5 * 60 * 1000,
  });
  return {
    year: year.data ?? null,
    classes: classes.data ?? [],
    isLoading: year.isLoading || (Boolean(yearId) && classes.isLoading),
    noCurrentYear: year.isSuccess && !year.data,
    error: year.error ?? classes.error,
  };
}

export function useUpdateStudentRecord(id: string) {
  const service = useStudentRecordsService();
  const school = useSchoolKey();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: StudentRecordUpdate) => service.updateStudent(id, data),
    onSuccess: (student) => {
      qc.setQueryData(studentAreaKeys.student(school, id), student);
      // The directory and class placement read the roster: refresh it
      qc.invalidateQueries({ queryKey: classPlacementKeys.all(school) });
      qc.invalidateQueries({ queryKey: ['students', school] });
    },
  });
}

export function useSetStudentStatus(id: string) {
  const service = useStudentRecordsService();
  const school = useSchoolKey();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (status: 'active' | 'inactive') => service.setStatus(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: studentAreaKeys.all(school) });
      qc.invalidateQueries({ queryKey: ['students', school] });
    },
  });
}

export function useResetPassword() {
  const service = useStudentRecordsService();
  return useMutation({ mutationFn: (userId: string) => service.resetPassword(userId) });
}

export function useReissueIdCard() {
  const service = useStudentRecordsService();
  return useMutation({ mutationFn: (studentId: string) => service.reissueIdCard(studentId) });
}

export function useAdmitStudent() {
  const service = useAdmissionsService();
  const school = useSchoolKey();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (request: AdmissionRequest) => service.admit(request),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: studentAreaKeys.all(school) });
      qc.invalidateQueries({ queryKey: ['students', school] });
    },
  });
}

export function useGuardianSearch(q: string) {
  const service = useAdmissionsService();
  const school = useSchoolKey();
  const term = q.trim();
  return useQuery({
    queryKey: studentAreaKeys.guardianSearch(school, term),
    queryFn: () => service.searchGuardians(term),
    enabled: Boolean(school) && term.length >= 2,
    staleTime: 30 * 1000,
  });
}

export function useImportAdmissions() {
  const service = useAdmissionsService();
  const school = useSchoolKey();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ rows, dryRun }: { rows: AdmissionRow[]; dryRun: boolean }) => service.importRows(rows, dryRun),
    onSuccess: (result, { dryRun }) => {
      if (!dryRun && result.created > 0) {
        qc.invalidateQueries({ queryKey: studentAreaKeys.all(school) });
        qc.invalidateQueries({ queryKey: ['students', school] });
      }
    },
  });
}
