// Display helpers for the Students area (content style: design brief section 7).
import type { StatusBadgeStatus } from '@/components/ui/status-badge';
import type { StudentEnrollment, YearClass } from '@/services/api/student-records-service';

const DAY = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const TIME = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' });

/** "Mon 20 Oct 2026". Accepts "2026-10-20" or a full ISO timestamp. */
export function formatDate(value?: string | null): string {
  if (!value) return '';
  const day = value.slice(0, 10);
  const d = new Date(`${day}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return value;
  // en-GB gives "Mon, 20 Oct 2026" in some engines; drop the comma.
  return DAY.format(d).replace(',', '');
}

export function formatTime(value?: string | null): string {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : TIME.format(d);
}

export function fullName(p: { first_name?: string | null; last_name?: string | null }): string {
  return [p.first_name, p.last_name].filter(Boolean).join(' ').trim() || 'Unnamed';
}

export function yearClassName(c: Pick<YearClass, 'name' | 'grade_name' | 'section_name'>): string {
  if (c.name) return c.name;
  return [c.grade_name, c.section_name].filter(Boolean).join(' - ') || 'Unnamed class';
}

export function enrollmentClassName(e?: StudentEnrollment | null): string {
  if (!e) return '';
  if (e.class_name) return e.class_name;
  const grade = e.grade_name || e.grade;
  const section = e.section_name || e.section;
  return [grade, section].filter(Boolean).join(' - ');
}

/** Find the class of an enrollment among the classes of the year. */
export function classIdOfEnrollment(e: StudentEnrollment | null | undefined, classes: YearClass[]): string | null {
  if (!e) return null;
  if (e.class_id) return e.class_id;
  const match = classes.find(
    (c) => c.academic_year_id === e.academic_year_id && c.grade_id === e.grade_id && c.section_id === e.section_id
  );
  return match?.id ?? null;
}

export const STUDENT_STATUSES = ['active', 'inactive', 'graduated', 'transferred'] as const;

export function studentStatusBadge(status?: string | null): { status: StatusBadgeStatus; label: string } {
  switch ((status || '').toLowerCase()) {
    case 'active':
      return { status: 'success', label: 'Active' };
    case 'inactive':
      return { status: 'neutral', label: 'Inactive' };
    case 'graduated':
      return { status: 'info', label: 'Graduated' };
    case 'transferred':
      return { status: 'warning', label: 'Transferred' };
    case 'withdrawn':
      return { status: 'warning', label: 'Withdrawn' };
    default:
      return { status: 'neutral', label: status ? capitalize(status) : 'Unknown' };
  }
}

export function capitalize(text: string): string {
  return text ? text.charAt(0).toUpperCase() + text.slice(1).replace(/_/g, ' ') : text;
}

/** Plain message from an API error (the client throws AppError with the server's detail). */
export function errorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === 'object' && 'message' in error) {
    const msg = String((error as { message?: unknown }).message || '');
    if (msg && !msg.startsWith('{') && msg.length < 300) return msg;
  }
  return fallback;
}

export function isNotFound(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && (error as { statusCode?: number }).statusCode === 404);
}

/** Today in the browser's time zone as yyyy-mm-dd. */
export function isoDay(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
