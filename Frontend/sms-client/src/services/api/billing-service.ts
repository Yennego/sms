// Platform billing (phase7-design.md sections 5 and 8 "As built").
//
// Two sides of the same records:
// - the school's own view under /api/v1/billing (status for everyone; invoices, receipts and the
//   export for school admins), through the school's api client;
// - the operator's view under /api/v1/super-admin/billing, through the platform api client.
//
// Money arrives as decimal strings ("30.00") and is only formatted for display
// (components/fees/money.ts). USD and LRD are never added together: totals are currency maps
// ({USD: "30.00", LRD: "5700.00"}) listing only the currencies that apply.
import { useMemo } from 'react';

import { createWaitForApiClientReady, useApiClientWithLoading } from './api-client';
import type { Currency, Money, PerCurrency } from './fees-service';
import { useSuperAdminApiClient } from './super-admin-api-client';

// ---- Shared ------------------------------------------------------------------------------------

export const SUBSCRIPTION_STATUSES = ['trial', 'active', 'read_only', 'suspended', 'dormant'] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

/** What the app shell's banner shows (GET /billing/status). */
export type BillingBanner = 'none' | 'due_soon' | 'overdue' | 'read_only' | 'suspended' | 'dormant';

export const PLATFORM_PAYMENT_METHODS = ['bank', 'mobile_money', 'cash'] as const;
export type PlatformPaymentMethod = (typeof PLATFORM_PAYMENT_METHODS)[number];

export type InvoiceLineKind = 'staff' | 'family' | 'minimum' | 'first_term_free' | 'adjustment';

export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

// ---- Prices ------------------------------------------------------------------------------------

export interface PriceList {
  id: string;
  /** "2026-09-01" */
  effective_from: string;
  staff_per_month_usd: Money;
  staff_per_month_lrd: Money;
  family_per_month_usd: Money;
  family_per_month_lrd: Money;
  term_minimum_usd: Money;
  term_minimum_lrd: Money;
  created_by: string | null;
  created_by_name: string | null;
  created_at: string | null;
  /** The list that applies to invoices issued today. */
  in_force: boolean;
}

export interface PriceListInput {
  effective_from: string;
  staff_per_month_usd: Money;
  staff_per_month_lrd: Money;
  family_per_month_usd: Money;
  family_per_month_lrd: Money;
  term_minimum_usd: Money;
  term_minimum_lrd: Money;
}

// ---- Invoices and payments ---------------------------------------------------------------------

export interface PlatformInvoiceLine {
  id: string;
  kind: InvoiceLineKind;
  description: string;
  quantity: number | string;
  unit_usd: Money;
  unit_lrd: Money;
  /** The first_term_free line is negative. */
  amount_usd: Money;
  amount_lrd: Money;
}

export interface PlatformPayment {
  id: string;
  invoice_id: string;
  receipt_number: string;
  amount: Money;
  currency: Currency;
  method: PlatformPaymentMethod | 'online';
  reference: string | null;
  provider: string | null;
  provider_ref: string | null;
  received_at: string;
  recorded_by: string | null;
  recorded_by_name: string | null;
  voided: boolean;
  voided_at: string | null;
  voided_by_name: string | null;
  void_reason: string | null;
}

/** A payment's receipt (record payment, void payment, GET .../receipt). */
export interface PlatformReceipt extends PlatformPayment {
  amount_in_words: string;
  invoice_number: string;
  /** In the payment's currency. */
  invoice_total: Money;
  balance_now: PerCurrency;
  school: { id: string; name: string; code: string };
}

export interface PlatformInvoice {
  id: string;
  tenant_id: string;
  number: string;
  semester_id: string;
  semester_name: string | null;
  period_start: string;
  period_end: string;
  issued_at: string;
  due_date: string;
  /** null until the first payment fixes it. */
  currency: Currency | null;
  status: 'issued' | 'void';
  total: PerCurrency;
  paid: PerCurrency;
  /** Both currencies until the first payment, then only the locked one; {} when void. */
  balance: PerCurrency;
  owing: boolean;
  void_reason: string | null;
  voided_at: string | null;
  /** Only in the platform's list of all invoices. */
  school_name?: string | null;
}

export interface PlatformInvoiceDetail extends PlatformInvoice {
  lines: PlatformInvoiceLine[];
  payments: PlatformPayment[];
}

export interface PaymentInput {
  amount: Money;
  currency: Currency;
  method: PlatformPaymentMethod;
  reference?: string | null;
  /** ISO time; the server uses now when it's left out. */
  received_at?: string | null;
}

// ---- Schools -----------------------------------------------------------------------------------

export interface Subscription {
  tenant_id: string;
  status: SubscriptionStatus;
  status_since: string | null;
  status_reason: string | null;
  /** Inclusive: no status change gets worse until after this day. */
  grace_until: string | null;
  first_term_free_used: boolean;
}

export interface SubscriptionInput {
  grace_until?: string | null;
  dormant?: boolean;
}

export interface BillingSchool {
  tenant_id: string;
  name: string;
  code: string;
  domain: string | null;
  is_active: boolean;
  status: SubscriptionStatus;
  status_since: string | null;
  grace_until: string | null;
  amount_due: PerCurrency;
  oldest_due_date: string | null;
  staff_count: number;
  last_term_name: string | null;
  last_term_family_months: number;
}

export interface BillingSemester {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
}

export interface UsageMonth {
  /** First of the month, "2026-10-01" */
  month: string;
  staff_signed_in: number;
  family_signed_in: number;
}

export interface BillingSchoolDetail extends BillingSchool {
  subscription: Subscription;
  /** The last 12 months. */
  usage: UsageMonth[];
  current_semester: BillingSemester | null;
  semesters: BillingSemester[];
  price_in_force: PriceList | null;
  invoices: PlatformInvoiceDetail[];
}

/** POST /schools/{id}/invoices: the invoice, and whether it was new. */
export interface IssueResult extends PlatformInvoiceDetail {
  created: boolean;
}

export interface BillingSummary {
  /** Invoices whose currency is fixed. */
  billed: PerCurrency;
  collected: PerCurrency;
  outstanding: PerCurrency;
  /** Invoices with a charge and no payment yet, priced in both currencies. */
  not_yet_paid: { invoices: number; USD: Money; LRD: Money };
  schools: Record<SubscriptionStatus, number>;
}

export type InvoiceStatusFilter = 'all' | 'issued' | 'void' | 'owing' | 'paid';

export interface SchoolListParams {
  status?: SubscriptionStatus | '';
  q?: string;
  page?: number;
  pageSize?: number;
}

export interface InvoiceListParams {
  status?: InvoiceStatusFilter;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

// ---- The school's own view ---------------------------------------------------------------------

export interface SchoolBillingStatus {
  status: SubscriptionStatus;
  status_since: string | null;
  grace_until: string | null;
  /** null for non-admins */
  amount_due: PerCurrency | null;
  oldest_due_date: string | null;
  read_only_on: string | null;
  suspended_on: string | null;
  banner: BillingBanner;
  is_admin: boolean;
  /** The banner's line; null when there is nothing to show. */
  message: string | null;
}

// ---- Query strings -------------------------------------------------------------------------------

function qs(params: Record<string, string | number | null | undefined>): string {
  const out = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    out.set(key, String(value));
  }
  const s = out.toString();
  return s ? `?${s}` : '';
}

const id = encodeURIComponent;
const PLATFORM = '/super-admin/billing';

// ---- Services ------------------------------------------------------------------------------------

/** The signed-in school's billing (/api/v1/billing). */
export function useSchoolBillingService() {
  const { apiClient } = useApiClientWithLoading();
  const ready = useMemo(() => createWaitForApiClientReady(apiClient), [apiClient]);

  return useMemo(
    () => ({
      getStatus: async () => (await ready()).get<SchoolBillingStatus>('/billing/status'),
      listInvoices: async () => (await ready()).get<PlatformInvoice[]>('/billing/invoices'),
      getInvoice: async (invoiceId: string) =>
        (await ready()).get<PlatformInvoiceDetail>(`/billing/invoices/${id(invoiceId)}`),
      getReceipt: async (paymentId: string) =>
        (await ready()).get<PlatformReceipt>(`/billing/payments/${id(paymentId)}/receipt`),
      /** A zip of CSVs (students, guardians, enrollments, results, fee payments). */
      downloadExport: async () => (await ready()).get<Blob>('/billing/export', { responseType: 'blob' }),
    }),
    [ready]
  );
}

/** The operator's billing (/api/v1/super-admin/billing). Platform routes are never blocked. */
export function usePlatformBillingService() {
  const client = useSuperAdminApiClient();

  return useMemo(
    () => ({
      getSummary: () => client.get<BillingSummary>(`${PLATFORM}/summary`),

      // Schools
      listSchools: (p: SchoolListParams) =>
        client.get<Paged<BillingSchool>>(
          `${PLATFORM}/schools${qs({
            status: p.status,
            q: p.q?.trim().slice(0, 100),
            page: p.page ?? 1,
            page_size: p.pageSize ?? 25,
          })}`
        ),
      getSchool: (tenantId: string) => client.get<BillingSchoolDetail>(`${PLATFORM}/schools/${id(tenantId)}`),
      updateSubscription: (tenantId: string, input: SubscriptionInput) =>
        client.put<Subscription>(`${PLATFORM}/schools/${id(tenantId)}/subscription`, input),
      /** Issue the school's invoice for a semester now; 409 "Set the platform price list first". */
      issueInvoice: (tenantId: string, semesterId: string) =>
        client.post<IssueResult>(`${PLATFORM}/schools/${id(tenantId)}/invoices`, { semester_id: semesterId }),

      // Invoices
      listInvoices: (p: InvoiceListParams) =>
        client.get<Paged<PlatformInvoice>>(
          `${PLATFORM}/invoices${qs({
            status: p.status && p.status !== 'all' ? p.status : undefined,
            from: p.from,
            to: p.to,
            page: p.page ?? 1,
            page_size: p.pageSize ?? 25,
          })}`
        ),
      getInvoice: (invoiceId: string) => client.get<PlatformInvoiceDetail>(`${PLATFORM}/invoices/${id(invoiceId)}`),
      /** 409 while the invoice has payments that aren't void. */
      voidInvoice: (invoiceId: string, reason: string) =>
        client.post<PlatformInvoiceDetail>(`${PLATFORM}/invoices/${id(invoiceId)}/void`, { reason }),

      // Payments
      /** Returns the receipt. 409 "Balance is USD 20.00" or "This invoice is being paid in USD". */
      recordPayment: (invoiceId: string, input: PaymentInput) =>
        client.post<PlatformReceipt>(`${PLATFORM}/invoices/${id(invoiceId)}/payments`, input),
      getReceipt: (paymentId: string) => client.get<PlatformReceipt>(`${PLATFORM}/payments/${id(paymentId)}/receipt`),
      voidPayment: (paymentId: string, reason: string) =>
        client.post<PlatformReceipt>(`${PLATFORM}/payments/${id(paymentId)}/void`, { reason }),

      // Prices
      listPrices: () => client.get<PriceList[]>(`${PLATFORM}/prices`),
      /** 409 when a list already starts on that date. */
      addPrice: (input: PriceListInput) => client.post<PriceList>(`${PLATFORM}/prices`, input),
    }),
    [client]
  );
}
