// A family's own fees: /finance/family (phase5-design.md section 5, "Family").
//
//   GET /finance/family/students                              -> linked children (parent) or self (student)
//   GET /finance/family/accounts/{student_id}?academic_year_id -> read-only statement
//   GET /finance/family/payments/{id}                         -> receipt
//
// Money arrives as decimal strings and is only ever displayed (never added up here). USD and LRD
// are kept apart: until a student's first payment of the year fixes the currency, amounts come
// per currency ({USD, LRD}). The responses are normalised defensively so a small naming
// difference on the server shows as a missing value, not a crash.
//
// Errors: a student of another school is 404 and one the parent isn't linked to is 403; a
// student with no bill for the year is 404 on the statement.
import { useMemo } from 'react';

import { createWaitForApiClientReady, useApiClientWithLoading } from './api-client';

const BASE = '/finance/family';

export type Currency = 'USD' | 'LRD';
export const CURRENCIES: Currency[] = ['USD', 'LRD'];

/** Amounts per currency, as decimal strings ("4500.00"). Missing key = no amount in that currency. */
export type Money = Partial<Record<Currency, string>>;

export type PaymentMethod = 'cash' | 'bank' | 'mobile_money' | string;

export interface FamilyStudent {
  student_id: string;
  name: string;
  admission_number: string | null;
  class_name: string | null;
  /** The current school year (the balances are for it). */
  academic_year_id: string | null;
  /** Fixed by the first payment of the year; null until then. */
  currency: Currency | null;
  balance: Money;
  overdue: Money;
  /** The earliest unpaid installment not yet past its date, with what is left of it. */
  next_due: { due_date: string; amount: Money } | null;
  report_cards_held: boolean;
}

/** "due": the next installment to pay; "upcoming": a later one, not due yet. */
export type InstallmentStatus = 'paid' | 'due' | 'overdue' | 'upcoming';

export interface FamilyInstallment {
  key: string;
  /** e.g. "Semester 1 · Part 2". */
  label: string;
  due_date: string | null;
  /** The share of the bill due by this date. */
  amount: Money;
  /** What is still unpaid of it (empty when unknown). */
  outstanding: Money;
  status: InstallmentStatus;
}

export interface FamilyPayment {
  id: string;
  receipt_number: string;
  received_at: string | null;
  amount: string;
  currency: Currency | null;
  method: PaymentMethod;
  reference: string | null;
  voided: boolean;
}

export interface FamilyStatement {
  student_id: string;
  student_name: string | null;
  class_name: string | null;
  academic_year_name: string | null;
  currency: Currency | null;
  balance: Money;
  overdue: Money;
  installments: FamilyInstallment[];
  payments: FamilyPayment[];
  /** True/false when the server says whether report cards are held; null when it doesn't say. */
  report_cards_held: boolean | null;
}

export interface FamilyReceipt extends FamilyPayment {
  /** e.g. "One hundred twenty US dollars only" (from the server). */
  amount_in_words: string | null;
  note: string | null;
  received_by_name: string | null;
  student_name: string | null;
  admission_number: string | null;
  class_name: string | null;
  academic_year_name: string | null;
  void_reason: string | null;
  voided_at: string | null;
  /** Balance left after this payment, when the server sends it. */
  balance_after: Money;
}

// ---------------------------------------------------------------------------
// Normalising
// ---------------------------------------------------------------------------

type Raw = Record<string, unknown>;

function obj(v: unknown): Raw {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Raw) : {};
}

function str(...values: unknown[]): string | null {
  for (const v of values) {
    if (typeof v === 'string' && v.trim() !== '') return v;
    if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  }
  return null;
}

function currencyOf(v: unknown): Currency | null {
  const s = typeof v === 'string' ? v.toUpperCase() : '';
  return s === 'USD' || s === 'LRD' ? s : null;
}

/** An amount as a string, never touched by float maths (numbers are only stringified). */
function amountOf(v: unknown): string | null {
  if (typeof v === 'string' && v.trim() !== '') return v.trim();
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  return null;
}

/**
 * Accepts {USD, LRD} (any case), {amount_usd, amount_lrd}, or a single amount (in `currency`).
 */
export function toMoney(v: unknown, currency: Currency | null): Money {
  const single = amountOf(v);
  if (single !== null) return currency ? { [currency]: single } : {};
  const o = obj(v);
  const out: Money = {};
  for (const c of CURRENCIES) {
    const lower = c.toLowerCase();
    const a = amountOf(o[c] ?? o[lower] ?? o[`amount_${lower}`]);
    if (a !== null) out[c] = a;
  }
  return out;
}

function list(v: unknown): unknown[] {
  if (Array.isArray(v)) return v;
  const items = obj(v).items;
  return Array.isArray(items) ? items : [];
}

/** True when the decimal string has no non-zero digit ("0", "0.00", "-0.00"). */
export function isZeroAmount(amount: string | null | undefined): boolean {
  return !amount || !/[1-9]/.test(amount);
}

export function hasAmount(m: Money): boolean {
  return CURRENCIES.some((c) => !isZeroAmount(m[c]));
}

function normaliseStudent(raw: unknown): FamilyStudent {
  const r = obj(raw);
  const student = obj(r.student);
  const currency = currencyOf(r.currency);
  const next = obj(r.next_due);
  const nextDate = str(next.due_date)?.slice(0, 10) ?? null;
  return {
    student_id: str(r.student_id, student.id, r.id) ?? '',
    name: str(r.name, r.student_name, student.name) ?? '',
    admission_number: str(r.admission_number, student.admission_number),
    class_name: str(r.class_name, student.class_name),
    academic_year_id: str(r.academic_year_id),
    currency,
    balance: toMoney(r.balance, currency),
    overdue: toMoney(r.overdue ?? r.overdue_amount, currency),
    next_due: nextDate ? { due_date: nextDate, amount: toMoney(next.amount, currency) } : null,
    report_cards_held: r.report_cards_held === true,
  };
}

function normalisePayment(raw: unknown, fallbackCurrency: Currency | null): FamilyPayment {
  const r = obj(raw);
  return {
    id: str(r.id, r.payment_id) ?? '',
    receipt_number: str(r.receipt_number, r.receipt_no) ?? '',
    received_at: str(r.received_at, r.paid_at, r.created_at),
    amount: amountOf(r.amount) ?? '0',
    currency: currencyOf(r.currency) ?? fallbackCurrency,
    method: str(r.method, r.payment_method) ?? '',
    reference: str(r.reference),
    voided: Boolean(r.voided_at) || r.is_void === true || r.voided === true || r.status === 'void',
  };
}

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function normaliseInstallment(raw: unknown, index: number, currency: Currency | null, today: string): FamilyInstallment {
  const r = obj(raw);
  const semester = obj(r.semester);
  const dueDate = str(r.due_date)?.slice(0, 10) ?? null;
  const amount = toMoney(r.amount_due ?? r.due ?? r.amount, currency);
  const outstanding = toMoney(r.outstanding ?? r.remaining ?? r.balance ?? r.unpaid, currency);
  const hasOutstanding = r.outstanding !== undefined || r.remaining !== undefined || r.balance !== undefined || r.unpaid !== undefined;

  const rawStatus = typeof r.status === 'string' ? r.status.toLowerCase() : '';
  let status: InstallmentStatus;
  if (rawStatus === 'paid' || rawStatus === 'overdue' || rawStatus === 'due' || rawStatus === 'upcoming') status = rawStatus;
  else if (rawStatus === 'partial' || rawStatus === 'pending') status = 'due';
  else if (r.is_paid === true || (hasOutstanding && !hasAmount(outstanding))) status = 'paid';
  else if (r.is_overdue === true || (dueDate !== null && dueDate < today && (!hasOutstanding || hasAmount(outstanding)))) status = 'overdue';
  else status = 'due';

  const semNumber = str(r.semester_number, semester.number);
  const semName = str(r.semester_name, semester.name) ?? (semNumber ? `Semester ${semNumber}` : null);
  const seq = str(r.sequence, r.installment_number);
  const label = [semName, seq ? `Part ${seq}` : null].filter(Boolean).join(' · ') || `Part ${index + 1}`;

  return {
    key: str(r.id) ?? `${semName ?? ''}-${seq ?? index}-${dueDate ?? ''}`,
    label,
    due_date: dueDate,
    amount,
    outstanding,
    status,
  };
}

function normaliseStatement(raw: unknown, studentId: string): FamilyStatement {
  const r = obj(raw);
  const account = obj(r.account);
  const student = obj(r.student ?? account.student);
  const year = obj(r.academic_year ?? account.academic_year);
  const currency = currencyOf(account.currency ?? r.currency);
  // The server's "today" is the school's day; the phone's date is only a fallback.
  const today = str(r.today)?.slice(0, 10) ?? todayIso();
  const installmentsRaw = list(r.installments ?? r.installment_schedule ?? r.schedule ?? account.installments);
  const installments = installmentsRaw
    .map((it, i) => normaliseInstallment(it, i, currency, today))
    .sort((a, b) => (a.due_date ?? '').localeCompare(b.due_date ?? ''));
  const payments = list(r.payments)
    .map((p) => normalisePayment(p, currency))
    .sort((a, b) => (b.received_at ?? '').localeCompare(a.received_at ?? ''));

  const heldRaw = r.report_cards_held ?? r.report_card_held ?? account.report_cards_held;
  return {
    student_id: str(account.student_id, student.id, r.student_id) ?? studentId,
    student_name: str(student.name, r.student_name, account.student_name),
    class_name: str(student.class_name, r.class_name, account.class_name),
    academic_year_name: str(year.name, r.academic_year_name, account.academic_year_name),
    currency,
    balance: toMoney(r.balance ?? account.balance, currency),
    overdue: toMoney(r.overdue ?? account.overdue, currency),
    installments,
    payments,
    report_cards_held: typeof heldRaw === 'boolean' ? heldRaw : null,
  };
}

function normaliseReceipt(raw: unknown): FamilyReceipt {
  const r = obj(raw);
  const payment = obj(r.payment);
  const base = { ...r, ...payment };
  const student = obj(r.student ?? payment.student);
  const year = obj(r.academic_year);
  const receivedBy = obj(base.received_by);
  const p = normalisePayment(base, null);
  return {
    ...p,
    amount_in_words: str(base.amount_in_words),
    note: str(base.note),
    received_by_name: str(base.received_by_name, receivedBy.name),
    student_name: str(student.name, r.student_name),
    admission_number: str(student.admission_number, r.admission_number),
    class_name: str(student.class_name, r.class_name),
    academic_year_name: str(year.name, r.academic_year_name),
    void_reason: str(base.void_reason),
    voided_at: str(base.voided_at),
    balance_after: toMoney(r.balance_after, p.currency),
  };
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export function useFamilyService() {
  const { apiClient } = useApiClientWithLoading();
  const waitForApiClientReady = useMemo(() => createWaitForApiClientReady(apiClient), [apiClient]);

  return useMemo(
    () => ({
      getStudents: async (): Promise<FamilyStudent[]> => {
        const client = await waitForApiClientReady();
        const resp = await client.get<unknown>(`${BASE}/students`);
        return list(resp).map(normaliseStudent).filter((s) => s.student_id);
      },

      getStatement: async (studentId: string, academicYearId?: string): Promise<FamilyStatement> => {
        const client = await waitForApiClientReady();
        const qs = academicYearId ? `?academic_year_id=${encodeURIComponent(academicYearId)}` : '';
        const resp = await client.get<unknown>(`${BASE}/accounts/${encodeURIComponent(studentId)}${qs}`);
        return normaliseStatement(resp, studentId);
      },

      getReceipt: async (paymentId: string): Promise<FamilyReceipt> => {
        const client = await waitForApiClientReady();
        const resp = await client.get<unknown>(`${BASE}/payments/${encodeURIComponent(paymentId)}`);
        return normaliseReceipt(resp);
      },
    }),
    [waitForApiClientReady]
  );
}

/** Plain words for a payment method. */
export function methodLabel(method: PaymentMethod): string {
  switch (method) {
    case 'cash':
      return 'Cash';
    case 'bank':
      return 'Bank';
    case 'mobile_money':
      return 'Mobile money';
    default:
      return method ? method.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase()) : '—';
  }
}
