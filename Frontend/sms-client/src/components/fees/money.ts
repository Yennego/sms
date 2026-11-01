// Money and label helpers for the Fees area (content style: design brief section 7).
//
// Amounts arrive as decimal strings and are formatted for display only: "USD 1,250.00", never "$".
// Comparisons (is this more than the balance? do the percents add up to 100?) use whole cents as
// BigInt, so no floating point is ever involved. USD and LRD are never added together.
import type {
  AdjustmentKind,
  Currency,
  InstallmentState,
  Money,
  PaymentMethod,
  PerCurrency,
} from '@/services/api/fees-service';
import { CURRENCIES } from '@/services/api/fees-service';

const ZERO = BigInt(0);
const HUNDRED = BigInt(100);

/** Whole cents (hundredths) of a decimal string or number; null when it isn't a number. */
export function toCents(value: Money | number | null | undefined): bigint | null {
  if (value === null || value === undefined) return null;
  const text =
    typeof value === 'number' ? (Number.isFinite(value) ? value.toFixed(2) : '') : String(value).trim().replace(/,/g, '');
  const m = /^([+-])?(\d*)(?:\.(\d*))?$/.exec(text);
  if (!m || (!m[2] && !m[3])) return null;
  const negative = m[1] === '-';
  const frac = m[3] ?? '';
  let cents = BigInt(m[2] || '0') * HUNDRED + BigInt(`${frac}00`.slice(0, 2));
  if (frac.length > 2 && Number(frac[2]) >= 5) cents += BigInt(1);
  return negative ? -cents : cents;
}

/** "125000" cents → "1250.00" (for sending back to the server). */
export function centsToDecimal(cents: bigint): string {
  const negative = cents < ZERO;
  const abs = negative ? -cents : cents;
  const whole = abs / HUNDRED;
  const part = (abs % HUNDRED).toString().padStart(2, '0');
  return `${negative ? '-' : ''}${whole.toString()}.${part}`;
}

function group(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** "1,250.00" (no currency). Used where the currency is a column heading. */
export function formatAmount(amount: Money | number | null | undefined): string {
  const cents = toCents(amount);
  if (cents === null) return '—';
  const negative = cents < ZERO;
  const abs = negative ? -cents : cents;
  return `${negative ? '-' : ''}${group((abs / HUNDRED).toString())}.${(abs % HUNDRED).toString().padStart(2, '0')}`;
}

/** "USD 1,250.00". The one way money is shown in the Fees area. */
export function formatMoney(amount: Money | number | null | undefined, currency: Currency | string): string {
  return `${currency} ${formatAmount(amount)}`;
}

export function isPositive(value: Money | number | null | undefined): boolean {
  const c = toCents(value);
  return c !== null && c > ZERO;
}

/** True when any currency in the pair is above zero. */
export function anyPositive(pc: PerCurrency | null | undefined): boolean {
  return CURRENCIES.some((c) => isPositive(pc?.[c]));
}

/** Currencies to show for a pair: the locked one, else those present (both when none are). */
export function shownCurrencies(pc: PerCurrency | null | undefined, locked?: Currency | null): Currency[] {
  if (locked) return [locked];
  const present = CURRENCIES.filter((c) => pc?.[c] !== undefined && pc?.[c] !== null);
  return present.length > 0 ? present : [...CURRENCIES];
}

/** "USD 150.00 · LRD 27,000.00" (each currency on its own, never summed). */
export function formatPair(pc: PerCurrency | null | undefined, locked?: Currency | null): string {
  return shownCurrencies(pc, locked)
    .map((c) => formatMoney(pc?.[c] ?? '0', c))
    .join(' · ');
}

/** Is `amount` more than `limit`? (both decimal strings) */
export function exceeds(amount: Money, limit: Money | null | undefined): boolean {
  const a = toCents(amount);
  const l = toCents(limit ?? '0');
  return a !== null && l !== null && a > l;
}

// ---- Labels --------------------------------------------------------------------------------------

export const METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'Cash',
  bank: 'Bank',
  mobile_money: 'Mobile money',
};

export function methodLabel(method: string | null | undefined): string {
  return (method && METHOD_LABELS[method as PaymentMethod]) || method || '—';
}

export const ADJUSTMENT_LABELS: Record<AdjustmentKind, string> = {
  discount: 'Discount',
  scholarship: 'Scholarship',
  waiver: 'Waiver',
};

export const INSTALLMENT_LABELS: Record<InstallmentState, string> = {
  paid: 'Paid',
  due: 'Due',
  overdue: 'Overdue',
  upcoming: 'Not due yet',
};

export function formatPercent(value: Money | number | null | undefined): string {
  const cents = toCents(value);
  if (cents === null) return '—';
  const text = centsToDecimal(cents).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
  return `${text}%`;
}

const CURRENCY_NAMES: Record<Currency, string> = { USD: 'US dollars', LRD: 'Liberian dollars' };

export function currencyName(currency: Currency): string {
  return CURRENCY_NAMES[currency] ?? currency;
}

// ---- Amount in words (receipts) ------------------------------------------------------------------

const ONES = [
  '', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve',
  'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen',
];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const SCALES = ['', 'thousand', 'million', 'billion', 'trillion'];

function underThousand(n: number): string {
  const parts: string[] = [];
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  if (hundreds) parts.push(`${ONES[hundreds]} hundred`);
  if (rest >= 20) parts.push(TENS[Math.floor(rest / 10)] + (rest % 10 ? `-${ONES[rest % 10]}` : ''));
  else if (rest) parts.push(ONES[rest]);
  return parts.join(' ');
}

function wholeInWords(digits: string): string {
  const clean = digits.replace(/^0+/, '');
  if (!clean) return 'zero';
  const groups: number[] = [];
  for (let end = clean.length; end > 0; end -= 3) {
    groups.unshift(Number(clean.slice(Math.max(0, end - 3), end)));
  }
  if (groups.length > SCALES.length) return group(clean);
  return groups
    .map((g, i) => {
      if (!g) return '';
      const scale = SCALES[groups.length - 1 - i];
      return `${underThousand(g)}${scale ? ` ${scale}` : ''}`;
    })
    .filter(Boolean)
    .join(' ');
}

/** "One thousand two hundred fifty US dollars and 50/100 only" */
export function amountInWords(amount: Money, currency: Currency): string {
  const cents = toCents(amount);
  if (cents === null) return '';
  const abs = cents < ZERO ? -cents : cents;
  const whole = wholeInWords((abs / HUNDRED).toString());
  const part = (abs % HUNDRED).toString().padStart(2, '0');
  const text = `${whole} ${currencyName(currency)}${part !== '00' ? ` and ${part}/100` : ''} only`;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// ---- Dates ---------------------------------------------------------------------------------------

/** Today as "2026-10-30" in the browser's time zone (useSchoolToday has the school's day). */
export function todayIso(): string {
  return isoDate(new Date());
}

export function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const DATE_TIME = new Intl.DateTimeFormat('en-GB', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

/** "Mon 20 Oct 2026, 14:05" */
export function formatDateTime(value?: string | null): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const parts = DATE_TIME.formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('weekday')} ${get('day')} ${get('month')} ${get('year')}, ${get('hour')}:${get('minute')}`;
}

// ---- Errors --------------------------------------------------------------------------------------

export function errorStatus(error: unknown): number | undefined {
  return (error as { statusCode?: number } | null)?.statusCode;
}
