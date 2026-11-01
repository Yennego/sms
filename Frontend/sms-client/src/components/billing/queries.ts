// TanStack Query hooks for platform billing. The school's own keys start with
// ['billing', school], so switching schools never shows another school's account; the operator's
// start with ['platform-billing'], and one invalidation refreshes the whole operator area (an
// invoice, a payment or a status change moves the summary, the lists and the school together).
import * as React from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useTenant } from '@/hooks/use-tenant';
import {
  usePlatformBillingService,
  useSchoolBillingService,
  type InvoiceListParams,
  type PaymentInput,
  type PriceListInput,
  type SchoolListParams,
  type SubscriptionInput,
} from '@/services/api/billing-service';
import { noRetryOnClientError } from '@/components/fees/queries';

/** The banner's status is cheap but changes at most daily: read it every few minutes. */
const STATUS_POLL_MS = 5 * 60 * 1000;

export const billingKeys = {
  school: (school: string | null) => ['billing', school] as const,
  status: (school: string | null) => [...billingKeys.school(school), 'status'] as const,
  invoices: (school: string | null) => [...billingKeys.school(school), 'invoices'] as const,
  invoice: (school: string | null, id: string) => [...billingKeys.school(school), 'invoice', id] as const,
  receipt: (school: string | null, id: string) => [...billingKeys.school(school), 'receipt', id] as const,

  platform: ['platform-billing'] as const,
  summary: () => [...billingKeys.platform, 'summary'] as const,
  schools: (params: SchoolListParams) => [...billingKeys.platform, 'schools', params] as const,
  schoolDetail: (tenantId: string) => [...billingKeys.platform, 'school', tenantId] as const,
  allInvoices: (params: InvoiceListParams) => [...billingKeys.platform, 'invoices', params] as const,
  platformInvoice: (id: string) => [...billingKeys.platform, 'invoice', id] as const,
  platformReceipt: (id: string) => [...billingKeys.platform, 'receipt', id] as const,
  prices: () => [...billingKeys.platform, 'prices'] as const,
  paymentDetails: () => [...billingKeys.platform, 'payment-details'] as const,
  schoolPaymentDetails: (school: string | null) => [...billingKeys.school(school), 'payment-details'] as const,
};

// ---- The school's own view -----------------------------------------------------------------------

/** GET /billing/status for the app shell's banner and the billing page (every school user). */
export function useBillingStatus(enabled = true) {
  const service = useSchoolBillingService();
  const school = useTenant().tenantKey;
  return useQuery({
    queryKey: billingKeys.status(school),
    queryFn: () => service.getStatus(),
    enabled: enabled && Boolean(school),
    staleTime: STATUS_POLL_MS,
    refetchInterval: STATUS_POLL_MS,
    refetchIntervalInBackground: false,
    retry: noRetryOnClientError,
  });
}

/** The school's invoices (school admins; others get 403). */
export function useSchoolInvoices(enabled = true) {
  const service = useSchoolBillingService();
  const school = useTenant().tenantKey;
  return useQuery({
    queryKey: billingKeys.invoices(school),
    queryFn: () => service.listInvoices(),
    enabled: enabled && Boolean(school),
    retry: noRetryOnClientError,
  });
}

export function useSchoolInvoice(invoiceId: string | undefined) {
  const service = useSchoolBillingService();
  const school = useTenant().tenantKey;
  return useQuery({
    queryKey: billingKeys.invoice(school, invoiceId ?? ''),
    queryFn: () => service.getInvoice(invoiceId!),
    enabled: Boolean(school && invoiceId),
    retry: noRetryOnClientError,
  });
}

export function useSchoolPaymentDetails(enabled = true) {
  const service = useSchoolBillingService();
  const school = useTenant().tenantKey;
  return useQuery({
    queryKey: billingKeys.schoolPaymentDetails(school),
    queryFn: () => service.getPaymentDetails(),
    enabled: Boolean(school) && enabled,
    retry: noRetryOnClientError,
  });
}

export function useSchoolReceipt(paymentId: string | undefined) {
  const service = useSchoolBillingService();
  const school = useTenant().tenantKey;
  return useQuery({
    queryKey: billingKeys.receipt(school, paymentId ?? ''),
    queryFn: () => service.getReceipt(paymentId!),
    enabled: Boolean(school && paymentId),
    retry: noRetryOnClientError,
  });
}

// ---- The operator's view -------------------------------------------------------------------------

function useInvalidatePlatform() {
  const qc = useQueryClient();
  return React.useCallback(() => qc.invalidateQueries({ queryKey: billingKeys.platform }), [qc]);
}

export function useBillingSummary() {
  const service = usePlatformBillingService();
  return useQuery({ queryKey: billingKeys.summary(), queryFn: () => service.getSummary(), retry: noRetryOnClientError });
}

export function useBillingSchools(params: SchoolListParams) {
  const service = usePlatformBillingService();
  return useQuery({
    queryKey: billingKeys.schools(params),
    queryFn: () => service.listSchools(params),
    placeholderData: keepPreviousData,
    retry: noRetryOnClientError,
  });
}

export function useBillingSchool(tenantId: string | undefined) {
  const service = usePlatformBillingService();
  return useQuery({
    queryKey: billingKeys.schoolDetail(tenantId ?? ''),
    queryFn: () => service.getSchool(tenantId!),
    enabled: Boolean(tenantId),
    retry: noRetryOnClientError,
  });
}

export function useAllInvoices(params: InvoiceListParams) {
  const service = usePlatformBillingService();
  return useQuery({
    queryKey: billingKeys.allInvoices(params),
    queryFn: () => service.listInvoices(params),
    placeholderData: keepPreviousData,
    retry: noRetryOnClientError,
  });
}

export function usePlatformInvoice(invoiceId: string | undefined) {
  const service = usePlatformBillingService();
  return useQuery({
    queryKey: billingKeys.platformInvoice(invoiceId ?? ''),
    queryFn: () => service.getInvoice(invoiceId!),
    enabled: Boolean(invoiceId),
    retry: noRetryOnClientError,
  });
}

export function usePlatformReceipt(paymentId: string | undefined) {
  const service = usePlatformBillingService();
  return useQuery({
    queryKey: billingKeys.platformReceipt(paymentId ?? ''),
    queryFn: () => service.getReceipt(paymentId!),
    enabled: Boolean(paymentId),
    retry: noRetryOnClientError,
  });
}

export function usePriceLists() {
  const service = usePlatformBillingService();
  return useQuery({ queryKey: billingKeys.prices(), queryFn: () => service.listPrices(), retry: noRetryOnClientError });
}

export function usePaymentDetails() {
  const service = usePlatformBillingService();
  return useQuery({ queryKey: billingKeys.paymentDetails(), queryFn: () => service.getPaymentDetails(), retry: noRetryOnClientError });
}

export function useSetPaymentDetails() {
  const service = usePlatformBillingService();
  const invalidate = useInvalidatePlatform();
  return useMutation({ mutationFn: (instructions: string) => service.setPaymentDetails(instructions), onSuccess: invalidate });
}

export function useAddPriceList() {
  const service = usePlatformBillingService();
  const invalidate = useInvalidatePlatform();
  return useMutation({ mutationFn: (input: PriceListInput) => service.addPrice(input), onSuccess: invalidate });
}

export function useIssueInvoice() {
  const service = usePlatformBillingService();
  const invalidate = useInvalidatePlatform();
  return useMutation({
    mutationFn: ({ tenantId, semesterId }: { tenantId: string; semesterId: string }) =>
      service.issueInvoice(tenantId, semesterId),
    onSuccess: invalidate,
  });
}

export function useVoidInvoice() {
  const service = usePlatformBillingService();
  const invalidate = useInvalidatePlatform();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => service.voidInvoice(id, reason),
    onSuccess: invalidate,
  });
}

export function useRecordPlatformPayment() {
  const service = usePlatformBillingService();
  const invalidate = useInvalidatePlatform();
  return useMutation({
    mutationFn: ({ invoiceId, input }: { invoiceId: string; input: PaymentInput }) =>
      service.recordPayment(invoiceId, input),
    onSuccess: invalidate,
  });
}

export function useVoidPlatformPayment() {
  const service = usePlatformBillingService();
  const invalidate = useInvalidatePlatform();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => service.voidPayment(id, reason),
    onSuccess: invalidate,
  });
}

export function useUpdateSubscription() {
  const service = usePlatformBillingService();
  const invalidate = useInvalidatePlatform();
  return useMutation({
    mutationFn: ({ tenantId, input }: { tenantId: string; input: SubscriptionInput }) =>
      service.updateSubscription(tenantId, input),
    onSuccess: invalidate,
  });
}
