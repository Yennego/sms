// Display helpers for the parent screens (design brief section 7): money with its currency code
// ("LRD 4,500.00", never "$") and short dates people know ("Mon 20 Oct").
//
// Amounts arrive as decimal strings and are only reformatted as text: no float maths, and USD
// and LRD are never added together.
import { CURRENCIES, type Currency, type Money } from '@/services/api/family-service';

/** "4500" / "4500.5" / 4500 -> "LRD 4,500.00". Unparseable input is shown as it came. */
export function formatMoney(amount: string | number | null | undefined, currency: string | null | undefined): string {
  const code = currency ? `${currency} ` : '';
  if (amount === null || amount === undefined || amount === '') return `${code}—`;
  const text = String(amount).trim();
  const m = /^([-+])?(\d*)(?:\.(\d*))?$/.exec(text);
  if (!m || (!m[2] && !m[3])) return `${code}${text}`;
  const sign = m[1] === '-' && /[1-9]/.test(text) ? '-' : '';
  const whole = (m[2] || '0').replace(/^0+(?=\d)/, '').replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const cents = `${m[3] ?? ''}00`.slice(0, 2);
  return `${code}${sign}${whole}.${cents}`;
}

/**
 * The amounts to show for a student: only their currency once it is fixed, otherwise every
 * currency the server sent (both, before the first payment). Never summed.
 */
export function moneyLines(money: Money, currency: Currency | null): { currency: Currency; text: string }[] {
  const codes = currency ? [currency] : CURRENCIES;
  return codes
    .filter((c) => money[c] !== undefined)
    .map((c) => ({ currency: c, text: formatMoney(money[c], c) }));
}

function toDate(iso: string): Date | null {
  // Date-only values are local calendar days; datetimes keep their own offset.
  const d = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T00:00:00`) : new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "Mon 20 Oct" (or "Mon 20 Oct 2026" with `withYear`). */
export function formatDay(iso: string | null | undefined, withYear = false): string {
  if (!iso) return '—';
  const d = toDate(iso);
  if (!d) return iso;
  // en-US short names ("Sep", not en-GB's "Sept"), arranged day-first.
  const weekday = d.toLocaleDateString('en-US', { weekday: 'short' });
  const day = d.getDate();
  const month = d.toLocaleDateString('en-US', { month: 'short' });
  return `${weekday} ${day} ${month}${withYear ? ` ${d.getFullYear()}` : ''}`;
}

/** "14:05" for a datetime, or '' for a date-only value. */
export function formatTime(iso: string | null | undefined): string {
  if (!iso || /^\d{4}-\d{2}-\d{2}$/.test(iso)) return '';
  const d = toDate(iso);
  return d ? d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '';
}
