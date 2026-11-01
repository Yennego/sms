// Display helpers for the inbox, announcements and delivery log (content style: design brief
// section 7: plain words, sentence case).
import type { AudienceRole, DeliveryStatus, NotificationEvent } from '@/services/api/communication-service';
import type { StatusBadgeStatus } from '@/components/ui/status-badge';

export const EVENT_LABELS: Record<NotificationEvent, string> = {
  attendance_absent: 'Absence',
  attendance_late: 'Late arrival',
  results_published: 'Results',
  payment_received: 'Payment',
  announcement: 'Announcement',
};

export function eventLabel(event: string): string {
  return EVENT_LABELS[event as NotificationEvent] ?? event;
}

export const ROLE_AUDIENCE_LABELS: Record<AudienceRole, string> = {
  parents: 'All parents',
  students: 'All students',
  teachers: 'All teachers',
  staff: 'All staff',
};

/** Who receives it, in words for the confirm step (phase6-design.md section 8, audience rules). */
export const ROLE_AUDIENCE_DESCRIPTIONS: Record<AudienceRole, string> = {
  parents: 'Every parent account in the school.',
  students: 'Every student account in the school.',
  teachers: 'Every teacher account in the school.',
  staff: 'Everyone who is not a student or a parent, teachers included.',
};

export const DELIVERY_STATUS_BADGES: Record<DeliveryStatus, { status: StatusBadgeStatus; label: string }> = {
  queued: { status: 'pending', label: 'Queued' },
  sent: { status: 'success', label: 'Sent' },
  failed: { status: 'danger', label: 'Failed' },
  skipped: { status: 'neutral', label: 'Skipped' },
};

const DAY_TIME = new Intl.DateTimeFormat('en-GB', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});
const TIME = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' });
const DAY_MONTH = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });

/** "Tue 20 Oct 2026, 14:05" */
export function formatDateTime(value?: string | null): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const parts = DAY_TIME.formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('weekday')} ${get('day')} ${get('month')} ${get('year')}, ${get('hour')}:${get('minute')}`;
}

/** Short time for lists: "14:05" today, "Yesterday", "20 Oct" this year, else the full date. */
export function formatWhen(value?: string | null, now = new Date()): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (sameDay(d, now)) return TIME.format(d);
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (sameDay(d, yesterday)) return 'Yesterday';
  if (d.getFullYear() === now.getFullYear()) return DAY_MONTH.format(d);
  return formatDateTime(value);
}

/** "1 person" / "312 people" */
export function peopleCount(n: number): string {
  return `${n.toLocaleString('en-US')} ${n === 1 ? 'person' : 'people'}`;
}
