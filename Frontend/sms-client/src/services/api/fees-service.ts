// Fees (phase5-design.md section 5): /api/v1/finance.
//
// Money arrives as decimal strings ("1250.00") and is only ever formatted for display
// (components/fees/money.ts); the browser never adds amounts up. USD and LRD are kept apart:
// every amount pair is a PerCurrency object ({USD?: "...", LRD?: "..."}).
//
// The expense endpoints (/finance/expenses) are unchanged from before Phase 5 and live here too.
import { useMemo } from 'react';

import { createWaitForApiClientReady, useApiClientWithLoading } from './api-client';

// ---- Shared ------------------------------------------------------------------------------------

export const CURRENCIES = ['USD', 'LRD'] as const;
export type Currency = (typeof CURRENCIES)[number];

/** A decimal amount as the server sends it, e.g. "1250.00". */
export type Money = string;

/** One amount per currency; a missing key means "no amount in that currency". */
export type PerCurrency = Partial<Record<Currency, Money | null>>;

export const PAYMENT_METHODS = ['cash', 'bank', 'mobile_money'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

// ---- Settings and setup ------------------------------------------------------------------------

export interface FinanceSettings {
  hold_report_cards_on_arrears: boolean;
  /** Today in the school's time zone ("2026-10-30"). */
  school_today: string;
}

export interface FinanceSettingsInput {
  hold_report_cards_on_arrears: boolean;
}

export interface FeeCategory {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  /** Used by a fee schedule or an invoice line: it can't be deleted, only switched off. */
  in_use: boolean;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface FeeCategoryInput {
  name: string;
  description: string | null;
  is_active: boolean;
}

export interface FeeSchedule {
  id: string;
  academic_year_id: string;
  semester_id: string;
  semester_name: string | null;
  /** null = every grade level */
  grade_id: string | null;
  grade_name: string | null;
  category_id: string;
  category_name: string | null;
  amount_usd: Money | null;
  amount_lrd: Money | null;
  /** On an invoice already: only the amounts can change, and it can't be deleted. */
  invoiced: boolean;
}

export interface FeeScheduleInput {
  academic_year_id: string;
  semester_id: string;
  grade_id: string | null;
  category_id: string;
  amount_usd: Money | null;
  amount_lrd: Money | null;
}

export interface InstallmentPlanItem {
  id?: string;
  sequence?: number;
  due_date: string;
  /** Share of the semester bill, e.g. "50.00" */
  percent: Money | number;
}

/** One semester's installment plan (GET/PUT /finance/installment-plans). */
export interface SemesterPlan {
  semester_id: string;
  semester_name: string;
  semester_number: number;
  academic_year_id: string;
  start_date: string | null;
  end_date: string | null;
  installments: InstallmentPlanItem[];
  total_percent: Money;
  /** With no plan, the whole bill falls due on this date (the semester's end). */
  default_due_date: string | null;
}

export interface IssueInvoicesInput {
  academic_year_id: string;
  semester_id: string;
  grade_id?: string | null;
  class_id?: string | null;
}

/** What "Issue invoices" did. */
export interface IssueInvoicesResult {
  students: number;
  invoices_created: number;
  invoices_updated: number;
  lines_added: number;
  unchanged: number;
  skipped_void: number;
  no_schedule: number;
  problems: { student_id: string; student_name: string | null; detail: string }[];
}

// ---- Accounts and statements -------------------------------------------------------------------

export type AccountStatus = 'all' | 'owing' | 'overdue' | 'paid';
export type AccountSort = 'name' | 'admission_number' | 'class' | 'balance' | 'overdue' | 'last_payment';

export interface AccountParams {
  academicYearId?: string;
  classId?: string;
  status?: AccountStatus;
  q?: string;
  sort?: AccountSort;
  page?: number;
  pageSize?: number;
}

/** "none": no bill yet (nothing owed, nothing paid). */
export type AccountState = 'overdue' | 'owing' | 'paid' | 'none';

export interface AccountListItem {
  student_id: string;
  account_id: string;
  name: string;
  admission_number: string | null;
  class_id: string | null;
  class_name: string | null;
  /** Fixed by the first payment of the year; null until then. */
  currency: Currency | null;
  /** Currencies the bill is priced in. */
  currencies: Currency[];
  owed: PerCurrency;
  paid: PerCurrency;
  balance: PerCurrency;
  overdue: PerCurrency;
  status: AccountState;
  last_payment_at: string | null;
  report_card_hold_override: boolean;
}

export interface AccountTotals {
  owed: PerCurrency;
  paid: PerCurrency;
  balance: PerCurrency;
  overdue: PerCurrency;
}

export interface AccountsPage extends Paged<AccountListItem> {
  academic_year: { id: string; name: string };
  /** Follow every filter. A student whose currency isn't fixed counts in the bill's first currency. */
  totals: AccountTotals;
  /** Per tab; these ignore the status filter. */
  counts: Record<AccountStatus, number>;
}

export interface FeeAccount {
  id: string;
  academic_year_id: string;
  academic_year_name: string | null;
  currency: Currency | null;
  currency_locked_at: string | null;
  /** true: report cards are shown even while fees are overdue. */
  report_card_hold_override: boolean;
}

export interface StatementStudent {
  id: string;
  name: string;
  admission_number: string | null;
  class_id: string | null;
  class_name: string | null;
  grade_name: string | null;
}

/** Whether report cards are held: `held` = the setting is on, fees are overdue and there's no override. */
export interface ReportCardHold {
  setting_on: boolean;
  override: boolean;
  held: boolean;
}

export interface InvoiceLine {
  id: string;
  schedule_id: string | null;
  category_id: string;
  category_name?: string | null;
  description: string | null;
  amount_usd: Money | null;
  amount_lrd: Money | null;
}

export type AdjustmentKind = 'discount' | 'scholarship' | 'waiver';

export interface FeeAdjustment {
  id: string;
  kind: AdjustmentKind;
  percent: Money | null;
  amount_usd: Money | null;
  amount_lrd: Money | null;
  reason: string;
  approved_by: string | null;
  approved_by_name: string | null;
  created_at: string;
  /** What it takes off the bill, per currency (a percent too). */
  value: PerCurrency;
}

export interface Invoice {
  id: string;
  semester_id: string;
  semester_name: string | null;
  semester_number: number | null;
  status: 'issued' | 'void';
  issued_at: string | null;
  issued_by: string | null;
  issued_by_name: string | null;
  voided_at: string | null;
  voided_by_name: string | null;
  void_reason: string | null;
  lines: InvoiceLine[];
  adjustments: FeeAdjustment[];
  charged: PerCurrency;
  adjustments_total: PerCurrency;
  /** owed, paid, balance and overdue are empty for a void invoice. */
  owed: PerCurrency;
  paid: PerCurrency;
  balance: PerCurrency;
  overdue: PerCurrency;
}

export type InstallmentState = 'paid' | 'due' | 'overdue' | 'upcoming';

export interface StatementInstallment {
  invoice_id: string;
  semester_id: string;
  semester_number: number | null;
  semester_name: string | null;
  sequence: number;
  due_date: string;
  percent: Money;
  /** This installment's share of the bill. */
  amount_due: PerCurrency;
  /** Same as amount_due. */
  due: PerCurrency;
  paid: PerCurrency;
  outstanding: PerCurrency;
  overdue: PerCurrency;
  /** "due" marks the earliest unpaid installment not yet past its date. */
  status: InstallmentState;
}

export interface PaymentAllocation {
  invoice_id: string;
  semester_id: string;
  semester_name: string | null;
  amount: Money;
}

/** The school heading printed on a receipt. */
export interface ReceiptSchoolBlock {
  name: string | null;
  logo: string | null;
  address: string | null;
  motto: string | null;
  phone: string | null;
  email: string | null;
  seal: string | null;
}

export interface Payment {
  id: string;
  receipt_number: string;
  student_id: string;
  student_name?: string | null;
  admission_number?: string | null;
  class_name?: string | null;
  academic_year_id?: string;
  academic_year_name?: string | null;
  amount: Money;
  currency: Currency;
  method: PaymentMethod;
  reference: string | null;
  note: string | null;
  received_by: string | null;
  received_by_name: string | null;
  received_at: string;
  voided: boolean;
  voided_at: string | null;
  voided_by?: string | null;
  voided_by_name: string | null;
  void_reason: string | null;
  /** Balance in the payment's currency right after it was recorded (null for payments moved from the old app). */
  balance_after?: PerCurrency | null;
  /** The account's balance today (per currency). */
  balance_now?: PerCurrency;
  amount_in_words: string;
  /** Whether the signed-in user may void it. */
  can_void: boolean;
  allocations?: PaymentAllocation[];
  unallocated?: Money;
  /** Receipt and record-payment answers only. */
  receipt_year?: number;
  school?: ReceiptSchoolBlock;
}

export interface Statement {
  student: StatementStudent;
  academic_year: { id: string; name: string };
  account: FeeAccount;
  /** Currencies the bill is priced in (only the fixed one once it is fixed). */
  currencies: Currency[];
  invoices: Invoice[];
  installments: StatementInstallment[];
  payments: Payment[];
  owed: PerCurrency;
  paid: PerCurrency;
  balance: PerCurrency;
  overdue: PerCurrency;
  report_cards_held: boolean;
  report_card_hold: ReportCardHold;
  /** Today in the school's time zone. */
  today: string;
}

export interface AdjustmentInput {
  kind: AdjustmentKind;
  percent?: Money | null;
  amount_usd?: Money | null;
  amount_lrd?: Money | null;
  reason: string;
}

export interface PaymentInput {
  student_id: string;
  academic_year_id: string;
  amount: Money;
  currency: Currency;
  method: PaymentMethod;
  reference?: string | null;
  note?: string | null;
}

export type PaymentStatus = 'all' | 'valid' | 'void';

export interface PaymentParams {
  from?: string;
  to?: string;
  method?: PaymentMethod | '';
  receivedBy?: string;
  q?: string;
  status?: PaymentStatus;
  academicYearId?: string;
  studentId?: string;
  page?: number;
  pageSize?: number;
}

export interface PaymentsPage extends Paged<Payment> {
  /** Valid (not void) payments matching the filters, per currency. */
  totals: PerCurrency;
}

/** Someone who recorded payments (the Payments screen's "Received by" filter). */
export interface PaymentReceiver {
  user_id: string;
  name: string | null;
}

// ---- Reports -------------------------------------------------------------------------------------

export interface CollectionRow {
  /** by_day: "2026-10-20" */
  date?: string;
  /** by_method */
  method?: PaymentMethod;
  /** by_receiver */
  received_by?: string | null;
  received_by_name?: string | null;
  totals: PerCurrency;
  count?: number;
}

export interface CollectionsReport {
  from: string;
  to: string;
  totals: PerCurrency;
  count: number;
  by_day: CollectionRow[];
  by_method: CollectionRow[];
  by_receiver: CollectionRow[];
  /** Voided payments in the period; left out of everything else. */
  voided: { count: number; totals: PerCurrency };
}

export interface ArrearsRow {
  class_id: string | null;
  class_name: string | null;
  students: number;
  students_overdue: number;
  overdue: PerCurrency;
  balance: PerCurrency;
}

export interface ArrearsReport {
  academic_year: { id: string; name: string };
  today: string;
  /** Every class with fee accounts, including those with nothing overdue. */
  classes: ArrearsRow[];
  totals: { students: number; students_overdue: number; overdue: PerCurrency; balance: PerCurrency };
}

// ---- Expenses (unchanged endpoints) --------------------------------------------------------------

export interface Expenditure {
  id: string;
  expense_category_id: string;
  amount: Money;
  date: string;
  payee: string | null;
  description: string | null;
}

export interface ExpenditureInput {
  expense_category_id: string;
  amount: Money;
  date: string;
  payee?: string | null;
  description?: string | null;
}

export interface ExpenseCategory {
  id: string;
  name: string;
  description: string | null;
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

export function accountsQuery(p: AccountParams): string {
  return qs({
    academic_year_id: p.academicYearId,
    class_id: p.classId,
    status: p.status ?? 'all',
    q: p.q?.trim().slice(0, 100),
    sort: p.sort,
    page: p.page ?? 1,
    page_size: p.pageSize ?? 25,
  });
}

export function paymentsQuery(p: PaymentParams): string {
  return qs({
    from: p.from,
    to: p.to,
    method: p.method,
    received_by: p.receivedBy,
    q: p.q?.trim().slice(0, 100),
    status: p.status,
    academic_year_id: p.academicYearId,
    student_id: p.studentId,
    page: p.page ?? 1,
    page_size: p.pageSize ?? 25,
  });
}

function asList<T>(resp: T[] | { items?: T[] } | null | undefined): T[] {
  if (Array.isArray(resp)) return resp;
  return resp?.items ?? [];
}

const id = encodeURIComponent;

// ---- Service -------------------------------------------------------------------------------------

export function useFeesService() {
  const { apiClient } = useApiClientWithLoading();
  const ready = useMemo(() => createWaitForApiClientReady(apiClient), [apiClient]);

  return useMemo(
    () => ({
      // Settings
      getSettings: async () => (await ready()).get<FinanceSettings>('/finance/settings'),
      updateSettings: async (s: FinanceSettingsInput) =>
        (await ready()).put<FinanceSettings>('/finance/settings', {
          hold_report_cards_on_arrears: s.hold_report_cards_on_arrears,
        }),

      // Categories
      listCategories: async () =>
        asList((await (await ready()).get<FeeCategory[] | { items: FeeCategory[] }>('/finance/categories'))),
      createCategory: async (c: FeeCategoryInput) => (await ready()).post<FeeCategory>('/finance/categories', c),
      updateCategory: async (categoryId: string, c: FeeCategoryInput) =>
        (await ready()).put<FeeCategory>(`/finance/categories/${id(categoryId)}`, c),
      deleteCategory: async (categoryId: string) =>
        (await ready()).delete<unknown>(`/finance/categories/${id(categoryId)}`),

      // Schedules
      listSchedules: async (academicYearId: string, semesterId?: string, gradeId?: string) =>
        asList(
          await (await ready()).get<FeeSchedule[] | { items: FeeSchedule[] }>(
            `/finance/schedules${qs({ academic_year_id: academicYearId, semester_id: semesterId, grade_id: gradeId })}`
          )
        ),
      createSchedule: async (s: FeeScheduleInput) => (await ready()).post<FeeSchedule>('/finance/schedules', s),
      updateSchedule: async (scheduleId: string, s: FeeScheduleInput) =>
        (await ready()).put<FeeSchedule>(`/finance/schedules/${id(scheduleId)}`, s),
      deleteSchedule: async (scheduleId: string) =>
        (await ready()).delete<unknown>(`/finance/schedules/${id(scheduleId)}`),

      // Installment plans
      /** The semester's plan (the server answers with a list, one entry per semester). */
      getInstallmentPlan: async (academicYearId: string, semesterId: string) => {
        const plans = await (await ready()).get<SemesterPlan[]>(
          `/finance/installment-plans${qs({ academic_year_id: academicYearId, semester_id: semesterId })}`
        );
        return (Array.isArray(plans) ? plans : []).find((p) => p.semester_id === semesterId) ?? null;
      },
      /** Replaces the semester's plan. The body is a bare array; [] removes the plan. */
      saveInstallmentPlan: async (academicYearId: string, semesterId: string, items: InstallmentPlanItem[]) =>
        (await ready()).put<SemesterPlan>(
          `/finance/installment-plans${qs({ academic_year_id: academicYearId, semester_id: semesterId })}`,
          items.map((i) => ({ due_date: i.due_date, percent: i.percent }))
        ),

      // Invoices and adjustments
      issueInvoices: async (input: IssueInvoicesInput) =>
        (await ready()).post<IssueInvoicesResult>('/finance/invoices/issue', input),
      // These answer with the student's statement.
      voidInvoice: async (invoiceId: string, reason: string) =>
        (await ready()).post<Statement>(`/finance/invoices/${id(invoiceId)}/void`, { reason }),
      addAdjustment: async (invoiceId: string, input: AdjustmentInput) =>
        (await ready()).post<Statement>(`/finance/invoices/${id(invoiceId)}/adjustments`, input),
      deleteAdjustment: async (adjustmentId: string) =>
        (await ready()).delete<Statement>(`/finance/adjustments/${id(adjustmentId)}`),

      // Accounts
      listAccounts: async (params: AccountParams) =>
        (await ready()).get<AccountsPage>(`/finance/accounts${accountsQuery(params)}`),
      getStatement: async (studentId: string, academicYearId?: string) =>
        (await ready()).get<Statement>(
          `/finance/accounts/${id(studentId)}${qs({ academic_year_id: academicYearId })}`
        ),
      /** Unfixes the student's currency for the year; refused (409) while any payment isn't void. */
      resetCurrency: async (studentId: string, academicYearId: string) =>
        (await ready()).post<Statement>(
          `/finance/accounts/${id(studentId)}/reset-currency${qs({ academic_year_id: academicYearId })}`,
          {}
        ),
      /** override = true shows the student's report cards even while fees are overdue. */
      setReportCardHold: async (studentId: string, academicYearId: string, override: boolean) =>
        (await ready()).put<Statement>(
          `/finance/accounts/${id(studentId)}/report-card-hold${qs({ academic_year_id: academicYearId })}`,
          { override }
        ),

      // Payments
      recordPayment: async (input: PaymentInput) => (await ready()).post<Payment>('/finance/payments', input),
      listPayments: async (params: PaymentParams) =>
        (await ready()).get<PaymentsPage>(`/finance/payments${paymentsQuery(params)}`),
      listReceivers: async (from?: string, to?: string) =>
        (await ready()).get<PaymentReceiver[]>(`/finance/payments/receivers${qs({ from, to })}`),
      getPayment: async (paymentId: string) => (await ready()).get<Payment>(`/finance/payments/${id(paymentId)}`),
      voidPayment: async (paymentId: string, reason: string) =>
        (await ready()).post<Payment>(`/finance/payments/${id(paymentId)}/void`, { reason }),

      // Reports
      getCollections: async (from: string, to: string) =>
        (await ready()).get<CollectionsReport>(`/finance/reports/collections${qs({ from, to })}`),
      getArrears: async (academicYearId?: string, classId?: string) =>
        (await ready()).get<ArrearsReport>(
          `/finance/reports/arrears${qs({ academic_year_id: academicYearId, class_id: classId })}`
        ),

      // Expenses
      listExpenditures: async () =>
        asList(await (await ready()).get<Expenditure[] | { items: Expenditure[] }>('/finance/expenses')),
      createExpenditure: async (e: ExpenditureInput) => (await ready()).post<Expenditure>('/finance/expenses', e),
      updateExpenditure: async (expenditureId: string, e: ExpenditureInput) =>
        (await ready()).put<Expenditure>(`/finance/expenses/${id(expenditureId)}`, e),
      deleteExpenditure: async (expenditureId: string) =>
        (await ready()).delete<unknown>(`/finance/expenses/${id(expenditureId)}`),
      listExpenseCategories: async () =>
        asList(
          await (await ready()).get<ExpenseCategory[] | { items: ExpenseCategory[] }>('/finance/expenses/categories')
        ),
    }),
    [ready]
  );
}

export type FeesService = ReturnType<typeof useFeesService>;
