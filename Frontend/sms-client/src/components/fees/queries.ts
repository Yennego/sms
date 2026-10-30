// TanStack Query hooks for the Fees area. Every key starts with ['fees', school], so switching
// schools never shows another school's money, and one invalidation refreshes the whole area.
import * as React from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { roleNames } from '@/config/navigation';
import { useAuth } from '@/hooks/use-auth';
import { useTenant } from '@/hooks/use-tenant';
import {
  useFeesService,
  type AccountParams,
  type AdjustmentInput,
  type ExpenditureInput,
  type FeeCategoryInput,
  type FeeScheduleInput,
  type FinanceSettingsInput,
  type InstallmentPlanItem,
  type IssueInvoicesInput,
  type PaymentInput,
  type PaymentParams,
} from '@/services/api/fees-service';
import { todayIso } from './money';

export const feesKeys = {
  all: (school: string | null) => ['fees', school] as const,
  settings: (school: string | null) => [...feesKeys.all(school), 'settings'] as const,
  categories: (school: string | null) => [...feesKeys.all(school), 'categories'] as const,
  schedules: (school: string | null, yearId: string, semesterId: string) =>
    [...feesKeys.all(school), 'schedules', yearId, semesterId] as const,
  plan: (school: string | null, yearId: string, semesterId: string) =>
    [...feesKeys.all(school), 'installment-plan', yearId, semesterId] as const,
  accounts: (school: string | null, params: AccountParams) => [...feesKeys.all(school), 'accounts', params] as const,
  statement: (school: string | null, studentId: string, yearId: string) =>
    [...feesKeys.all(school), 'statement', studentId, yearId] as const,
  payments: (school: string | null, params: PaymentParams) => [...feesKeys.all(school), 'payments', params] as const,
  payment: (school: string | null, id: string) => [...feesKeys.all(school), 'payment', id] as const,
  receivers: (school: string | null, from: string, to: string) =>
    [...feesKeys.all(school), 'receivers', from, to] as const,
  collections: (school: string | null, from: string, to: string) =>
    [...feesKeys.all(school), 'collections', from, to] as const,
  arrears: (school: string | null, yearId: string, classId: string) =>
    [...feesKeys.all(school), 'arrears', yearId, classId] as const,
  expenses: (school: string | null) => [...feesKeys.all(school), 'expenses'] as const,
  expenseCategories: (school: string | null) => [...feesKeys.all(school), 'expense-categories'] as const,
};

/** Don't retry answers that won't change (no permission, not found, invalid). */
export function noRetryOnClientError(count: number, error: unknown) {
  const status = (error as { statusCode?: number } | null)?.statusCode;
  return !(status && status >= 400 && status < 500) && count < 2;
}

function useSchool() {
  return useTenant().tenantKey;
}

/** Invalidate everything in the Fees area (balances move together after any money change). */
function useInvalidateFees() {
  const qc = useQueryClient();
  const school = useSchool();
  return React.useCallback(() => qc.invalidateQueries({ queryKey: feesKeys.all(school) }), [qc, school]);
}

// ---- Permissions ---------------------------------------------------------------------------------

export interface FeesPermissions {
  view: boolean;
  setup: boolean;
  record: boolean;
  approve: boolean;
  manage: boolean;
}

/**
 * What the signed-in user may do (phase5-design.md section 4). School admins get everything (the
 * Phase 5 migration grants them the finance permissions). The server always has the last word.
 */
export function useFeesPermissions(): FeesPermissions {
  const { user } = useAuth();
  return React.useMemo(() => {
    const perms = new Set(user?.permissions ?? []);
    const admin = roleNames(user).some((r) => r === 'admin' || r === 'tenant-admin');
    const has = (p: string) => admin || perms.has(p);
    return {
      view: has('view_financial_data'),
      setup: has('create_invoices'),
      record: has('record_payments'),
      approve: has('approve_financial_transactions'),
      manage: has('manage_financial_data'),
    };
  }, [user]);
}

// ---- Settings ------------------------------------------------------------------------------------

export function useFinanceSettings() {
  const service = useFeesService();
  const school = useSchool();
  return useQuery({
    queryKey: feesKeys.settings(school),
    queryFn: () => service.getSettings(),
    enabled: Boolean(school),
    retry: noRetryOnClientError,
  });
}

export function useUpdateFinanceSettings() {
  const service = useFeesService();
  const school = useSchool();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (s: FinanceSettingsInput) => service.updateSettings(s),
    onSuccess: (data) => qc.setQueryData(feesKeys.settings(school), data),
  });
}

/**
 * Today in the school's time zone (GET /finance/settings), so "today's payments" match the
 * server's day. Falls back to the browser's date when settings can't be read. `ready` is false
 * until either answer is in, so callers fetch once with the right date.
 */
export function useSchoolToday() {
  const settings = useFinanceSettings();
  return {
    today: settings.data?.school_today ?? todayIso(),
    ready: settings.isSuccess || settings.isError,
  };
}

// ---- Categories ----------------------------------------------------------------------------------

export function useFeeCategories() {
  const service = useFeesService();
  const school = useSchool();
  return useQuery({
    queryKey: feesKeys.categories(school),
    queryFn: async () =>
      (await service.listCategories()).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })),
    enabled: Boolean(school),
    staleTime: 60 * 1000,
    retry: noRetryOnClientError,
  });
}

export function useSaveFeeCategory() {
  const service = useFeesService();
  const invalidate = useInvalidateFees();
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: FeeCategoryInput }) =>
      id ? service.updateCategory(id, input) : service.createCategory(input),
    onSuccess: invalidate,
  });
}

export function useDeleteFeeCategory() {
  const service = useFeesService();
  const invalidate = useInvalidateFees();
  return useMutation({ mutationFn: (id: string) => service.deleteCategory(id), onSuccess: invalidate });
}

// ---- Schedules and installment plans -------------------------------------------------------------

export function useFeeSchedules(yearId: string | undefined, semesterId: string | undefined) {
  const service = useFeesService();
  const school = useSchool();
  return useQuery({
    queryKey: feesKeys.schedules(school, yearId ?? '', semesterId ?? ''),
    queryFn: () => service.listSchedules(yearId as string, semesterId),
    enabled: Boolean(school && yearId && semesterId),
    retry: noRetryOnClientError,
  });
}

export function useSaveFeeSchedule() {
  const service = useFeesService();
  const invalidate = useInvalidateFees();
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: FeeScheduleInput }) =>
      id ? service.updateSchedule(id, input) : service.createSchedule(input),
    onSuccess: invalidate,
  });
}

export function useDeleteFeeSchedule() {
  const service = useFeesService();
  const invalidate = useInvalidateFees();
  return useMutation({ mutationFn: (id: string) => service.deleteSchedule(id), onSuccess: invalidate });
}

export function useInstallmentPlan(yearId: string | undefined, semesterId: string | undefined) {
  const service = useFeesService();
  const school = useSchool();
  return useQuery({
    queryKey: feesKeys.plan(school, yearId ?? '', semesterId ?? ''),
    queryFn: () => service.getInstallmentPlan(yearId as string, semesterId as string),
    enabled: Boolean(school && yearId && semesterId),
    retry: noRetryOnClientError,
  });
}

export function useSaveInstallmentPlan() {
  const service = useFeesService();
  const invalidate = useInvalidateFees();
  return useMutation({
    mutationFn: ({ yearId, semesterId, items }: { yearId: string; semesterId: string; items: InstallmentPlanItem[] }) =>
      service.saveInstallmentPlan(yearId, semesterId, items),
    onSuccess: invalidate,
  });
}

export function useIssueInvoices() {
  const service = useFeesService();
  const invalidate = useInvalidateFees();
  return useMutation({ mutationFn: (input: IssueInvoicesInput) => service.issueInvoices(input), onSuccess: invalidate });
}

// ---- Accounts, statements, adjustments -----------------------------------------------------------

export function useAccounts(params: AccountParams, enabled = true) {
  const service = useFeesService();
  const school = useSchool();
  return useQuery({
    queryKey: feesKeys.accounts(school, params),
    queryFn: () => service.listAccounts(params),
    enabled: Boolean(school) && enabled,
    placeholderData: keepPreviousData,
    staleTime: 30 * 1000,
    retry: noRetryOnClientError,
  });
}

export function useStatement(studentId: string | undefined, yearId: string | undefined) {
  const service = useFeesService();
  const school = useSchool();
  return useQuery({
    queryKey: feesKeys.statement(school, studentId ?? '', yearId ?? ''),
    queryFn: () => service.getStatement(studentId as string, yearId),
    enabled: Boolean(school && studentId),
    retry: noRetryOnClientError,
  });
}

export function useAddAdjustment() {
  const service = useFeesService();
  const invalidate = useInvalidateFees();
  return useMutation({
    mutationFn: ({ invoiceId, input }: { invoiceId: string; input: AdjustmentInput }) =>
      service.addAdjustment(invoiceId, input),
    onSuccess: invalidate,
  });
}

export function useDeleteAdjustment() {
  const service = useFeesService();
  const invalidate = useInvalidateFees();
  return useMutation({ mutationFn: (id: string) => service.deleteAdjustment(id), onSuccess: invalidate });
}

export function useResetCurrency() {
  const service = useFeesService();
  const invalidate = useInvalidateFees();
  return useMutation({
    mutationFn: ({ studentId, yearId }: { studentId: string; yearId: string }) => service.resetCurrency(studentId, yearId),
    onSuccess: invalidate,
  });
}

export function useSetReportCardHold() {
  const service = useFeesService();
  const invalidate = useInvalidateFees();
  return useMutation({
    mutationFn: ({ studentId, yearId, override }: { studentId: string; yearId: string; override: boolean }) =>
      service.setReportCardHold(studentId, yearId, override),
    onSuccess: invalidate,
  });
}

// ---- Payments ------------------------------------------------------------------------------------

export function usePayments(params: PaymentParams, enabled = true) {
  const service = useFeesService();
  const school = useSchool();
  return useQuery({
    queryKey: feesKeys.payments(school, params),
    queryFn: () => service.listPayments(params),
    enabled: Boolean(school) && enabled,
    placeholderData: keepPreviousData,
    staleTime: 15 * 1000,
    retry: noRetryOnClientError,
  });
}

export function usePayment(id: string | undefined) {
  const service = useFeesService();
  const school = useSchool();
  return useQuery({
    queryKey: feesKeys.payment(school, id ?? ''),
    queryFn: () => service.getPayment(id as string),
    enabled: Boolean(school && id),
    retry: noRetryOnClientError,
  });
}

/** Who recorded payments (in the period, when given): the Payments screen's "Received by" filter. */
export function usePaymentReceivers(from?: string, to?: string) {
  const service = useFeesService();
  const school = useSchool();
  return useQuery({
    queryKey: feesKeys.receivers(school, from ?? '', to ?? ''),
    queryFn: () => service.listReceivers(from, to),
    enabled: Boolean(school),
    staleTime: 60 * 1000,
    retry: noRetryOnClientError,
  });
}

export function useRecordPayment() {
  const service = useFeesService();
  const invalidate = useInvalidateFees();
  return useMutation({ mutationFn: (input: PaymentInput) => service.recordPayment(input), onSuccess: invalidate });
}

export function useVoidPayment() {
  const service = useFeesService();
  const invalidate = useInvalidateFees();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => service.voidPayment(id, reason),
    onSuccess: invalidate,
  });
}

// ---- Reports -------------------------------------------------------------------------------------

export function useCollections(from: string, to: string, enabled = true) {
  const service = useFeesService();
  const school = useSchool();
  return useQuery({
    queryKey: feesKeys.collections(school, from, to),
    queryFn: () => service.getCollections(from, to),
    enabled: Boolean(school && from && to) && enabled,
    placeholderData: keepPreviousData,
    retry: noRetryOnClientError,
  });
}

export function useArrears(yearId: string | undefined, classId: string) {
  const service = useFeesService();
  const school = useSchool();
  return useQuery({
    queryKey: feesKeys.arrears(school, yearId ?? '', classId),
    queryFn: () => service.getArrears(yearId, classId || undefined),
    enabled: Boolean(school && yearId),
    placeholderData: keepPreviousData,
    retry: noRetryOnClientError,
  });
}

// ---- Expenses ------------------------------------------------------------------------------------

export function useExpenditures() {
  const service = useFeesService();
  const school = useSchool();
  return useQuery({
    queryKey: feesKeys.expenses(school),
    queryFn: () => service.listExpenditures(),
    enabled: Boolean(school),
    retry: noRetryOnClientError,
  });
}

export function useExpenseCategories() {
  const service = useFeesService();
  const school = useSchool();
  return useQuery({
    queryKey: feesKeys.expenseCategories(school),
    queryFn: () => service.listExpenseCategories(),
    enabled: Boolean(school),
    retry: noRetryOnClientError,
  });
}

export function useSaveExpenditure() {
  const service = useFeesService();
  const school = useSchool();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: ExpenditureInput }) =>
      id ? service.updateExpenditure(id, input) : service.createExpenditure(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: feesKeys.expenses(school) }),
  });
}

export function useDeleteExpenditure() {
  const service = useFeesService();
  const school = useSchool();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => service.deleteExpenditure(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: feesKeys.expenses(school) }),
  });
}
