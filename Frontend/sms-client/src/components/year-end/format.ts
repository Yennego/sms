// Display helpers for the year-end tools (enrollments, promotion, remedial work).
import type { StatusBadgeStatus } from '@/components/ui/status-badge';
import type { Enrollment, StudentMinimal } from '@/types/enrollment';
import type { Student } from '@/types/student';

export const ENROLLMENT_STATUSES = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'transferred', label: 'Transferred' },
  { value: 'graduated', label: 'Graduated' },
  { value: 'withdrawn', label: 'Withdrawn' },
] as const;

/** A name from a nested object or a plain string (the API sends either). */
export function nameOf(value?: string | { name?: string } | null): string {
  if (!value) return '';
  return typeof value === 'string' ? value : (value.name ?? '');
}

export function studentLabel(s?: Partial<StudentMinimal> | Partial<Student> | null): string {
  if (!s) return '';
  const first = (s as StudentMinimal).firstName || (s as StudentMinimal).first_name || '';
  const last = (s as StudentMinimal).lastName || (s as StudentMinimal).last_name || '';
  return `${first} ${last}`.trim();
}

/** The student of an enrollment: the nested one, else from the loaded list. */
export function enrollmentStudent(e: Enrollment, students: Student[]): { name: string; admission: string } {
  const s = e.student ?? students.find((st) => st.id === e.student_id);
  return { name: studentLabel(s) || 'Unknown student', admission: s?.admission_number ?? '' };
}

export function enrollmentStatusBadge(status?: string | null): { status: StatusBadgeStatus; label: string } {
  switch ((status || '').toLowerCase()) {
    case 'active':
      return { status: 'success', label: 'Active' };
    case 'graduated':
      return { status: 'info', label: 'Graduated' };
    case 'transferred':
      return { status: 'warning', label: 'Transferred' };
    case 'withdrawn':
      return { status: 'danger', label: 'Withdrawn' };
    case 'inactive':
      return { status: 'neutral', label: 'Inactive' };
    default:
      return { status: 'neutral', label: status || 'Unknown' };
  }
}

/** Promotion decision: Eligible (moves up), Conditional (moves up after remedial work), Repeating, Not graded. */
export function promotionBadge(status?: string | null): { status: StatusBadgeStatus; label: string } {
  switch (status) {
    case 'Eligible':
      return { status: 'success', label: 'Eligible' };
    case 'Conditional':
      return { status: 'warning', label: 'Conditional' };
    case 'Repeating':
      return { status: 'danger', label: 'Repeating' };
    case 'Not graded':
      return { status: 'neutral', label: 'Not graded' };
    default:
      return { status: 'neutral', label: status || 'Not checked' };
  }
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}
