// Labels for platform billing. Money is formatted with the Fees helpers (components/fees/money.ts):
// "USD 30.00", each currency on its own, never added together.
import type { StatusBadgeStatus } from '@/components/ui/status-badge';
import { methodLabel as feesMethodLabel } from '@/components/fees/money';
import type { BillingBanner, InvoiceLineKind, SubscriptionStatus } from '@/services/api/billing-service';

/** Who issues platform invoices and receipts (the heading of the printed copies). */
export const PLATFORM_NAME = process.env.NEXT_PUBLIC_PLATFORM_NAME || 'School Portal';

export const STATUS_LABELS: Record<SubscriptionStatus, string> = {
  trial: 'Trial',
  active: 'Active',
  read_only: 'Read-only',
  suspended: 'Suspended',
  dormant: 'Dormant',
};

export const STATUS_TONES: Record<SubscriptionStatus, StatusBadgeStatus> = {
  trial: 'info',
  active: 'success',
  read_only: 'warning',
  suspended: 'danger',
  dormant: 'neutral',
};

/** One line on what each status means, for the operator. */
export const STATUS_HINTS: Record<SubscriptionStatus, string> = {
  trial: 'Nothing charged yet (the first term is free).',
  active: 'Everything works.',
  read_only: 'Can sign in, view and print; changes are refused.',
  suspended: "Only the school's admins can sign in, to pay and export.",
  dormant: 'Free and read-only, kept for a year.',
};

export function statusLabel(status: string | null | undefined): string {
  return (status && STATUS_LABELS[status as SubscriptionStatus]) || status || '—';
}

export const BANNER_LABELS: Record<BillingBanner, string> = {
  none: '',
  due_soon: 'Due soon',
  overdue: 'Overdue',
  read_only: 'Read-only',
  suspended: 'Suspended',
  dormant: 'Dormant',
};

export const LINE_KIND_LABELS: Record<InvoiceLineKind, string> = {
  staff: 'Staff',
  family: 'Parents and students',
  minimum: 'Term minimum',
  first_term_free: 'First term free',
  adjustment: 'Adjustment',
};

export function methodLabel(method: string | null | undefined): string {
  return method === 'online' ? 'Online' : feesMethodLabel(method);
}

const MONTH = new Intl.DateTimeFormat('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' });

/** "2026-10-01" → "Oct 2026" */
export function formatMonth(value: string | null | undefined): string {
  if (!value) return '';
  const d = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? value : MONTH.format(d);
}
