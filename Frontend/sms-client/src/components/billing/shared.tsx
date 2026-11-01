'use client';

// Building blocks shared by the school's billing page and the operator's billing screens: status
// badges, an invoice with its lines and payments, and the "give a reason" dialog for voids.
import * as React from 'react';
import Link from 'next/link';
import { FileText, Receipt as ReceiptIcon } from 'lucide-react';

import { cn } from '@/lib/utils';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { StatusBadge } from '@/components/ui/status-badge';
import { Textarea } from '@/components/ui/textarea';
import { notify } from '@/components/ui/toaster';
import { errorMessage, formatDate } from '@/components/students/format';
import { anyPositive, formatAmount, formatDateTime, formatMoney, todayIso } from '@/components/fees/money';
import { Amounts } from '@/components/fees/shared';
import type {
  PlatformInvoice,
  PlatformInvoiceDetail,
  PlatformPayment,
  SubscriptionStatus,
} from '@/services/api/billing-service';
import { LINE_KIND_LABELS, methodLabel, STATUS_LABELS, STATUS_TONES } from './format';

export function BillingStatusBadge({ status, size }: { status: SubscriptionStatus; size?: 'sm' | 'md' }) {
  return <StatusBadge status={STATUS_TONES[status] ?? 'neutral'} label={STATUS_LABELS[status] ?? status} size={size} />;
}

/** Void / overdue / owing / paid, always with text. */
export function InvoiceStatusBadge({ invoice }: { invoice: PlatformInvoice }) {
  if (invoice.status === 'void') return <StatusBadge status="neutral" label="Void" />;
  if (invoice.owing && invoice.due_date < todayIso()) return <StatusBadge status="danger" label="Overdue" />;
  if (invoice.owing) return <StatusBadge status="warning" label="Owing" />;
  if (!anyPositive(invoice.total)) return <StatusBadge status="success" label="Nothing to pay" />;
  return <StatusBadge status="success" label="Paid" />;
}

/** "Term 1 · 1 Sep 2026 to 31 Jan 2027" */
export function invoicePeriod(invoice: PlatformInvoice): string {
  const dates = `${formatDate(invoice.period_start)} to ${formatDate(invoice.period_end)}`;
  return invoice.semester_name ? `${invoice.semester_name} · ${dates}` : dates;
}

function Figure({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}

/** The invoice's lines: each priced in USD and in LRD (two columns, never added together). */
export function InvoiceLines({ invoice }: { invoice: PlatformInvoiceDetail }) {
  if (invoice.lines.length === 0) return <p className="text-sm text-muted-foreground">No lines.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm" aria-label={`Lines of invoice ${invoice.number}`}>
        <thead>
          <tr className="border-b text-left text-xs text-muted-foreground">
            <th scope="col" className="py-2 pr-3 font-medium">Item</th>
            <th scope="col" className="py-2 pr-3 text-right font-medium">USD</th>
            <th scope="col" className="py-2 text-right font-medium">LRD</th>
          </tr>
        </thead>
        <tbody>
          {invoice.lines.map((l) => (
            <tr key={l.id} className="border-b last:border-0 align-top">
              <td className="py-2 pr-3">
                <p className="font-medium">{l.description || LINE_KIND_LABELS[l.kind] || l.kind}</p>
                {l.kind !== 'first_term_free' && l.kind !== 'adjustment' ? (
                  <p className="text-xs text-muted-foreground">
                    {String(l.quantity)} × USD {formatAmount(l.unit_usd)} / LRD {formatAmount(l.unit_lrd)}
                  </p>
                ) : null}
              </td>
              <td className="py-2 pr-3 text-right whitespace-nowrap tabular-nums">{formatAmount(l.amount_usd)}</td>
              <td className="py-2 text-right whitespace-nowrap tabular-nums">{formatAmount(l.amount_lrd)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t font-semibold">
            <th scope="row" className="py-2 pr-3 text-left">Total</th>
            <td className="py-2 pr-3 text-right whitespace-nowrap tabular-nums">{formatAmount(invoice.total.USD)}</td>
            <td className="py-2 text-right whitespace-nowrap tabular-nums">{formatAmount(invoice.total.LRD)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

/** One payment: receipt number, amount, method and reference; voided ones crossed out with the reason. */
export function PaymentRow({
  payment,
  receiptHref,
  actions,
}: {
  payment: PlatformPayment;
  receiptHref?: string;
  actions?: React.ReactNode;
}) {
  return (
    <li className="flex flex-wrap items-start justify-between gap-2 py-2">
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-2">
          {receiptHref ? (
            <Link href={receiptHref} className="font-mono text-sm font-medium text-primary underline-offset-4 hover:underline">
              {payment.receipt_number}
            </Link>
          ) : (
            <span className="font-mono text-sm font-medium">{payment.receipt_number}</span>
          )}
          {payment.voided ? <StatusBadge status="neutral" label="Void" /> : null}
        </p>
        <p className="text-xs text-muted-foreground">
          {formatDateTime(payment.received_at)} · {methodLabel(payment.method)}
          {payment.reference ? ` · ${payment.reference}` : ''}
          {payment.recorded_by_name ? ` · by ${payment.recorded_by_name}` : ''}
        </p>
        {payment.voided ? (
          <p className="text-xs text-muted-foreground">Void reason: {payment.void_reason || 'not given'}</p>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        <span className={cn('tabular-nums whitespace-nowrap', payment.voided ? 'text-muted-foreground line-through' : 'font-medium')}>
          {formatMoney(payment.amount, payment.currency)}
        </span>
        {actions}
      </div>
    </li>
  );
}

/**
 * An invoice as a card: number, term, dates, status, total / paid / balance, its lines and
 * payments. `actions` sit in the header (record payment, void); `paymentActions` on each payment.
 */
export function InvoiceCard({
  invoice,
  invoiceHref,
  receiptHref,
  actions,
  paymentActions,
}: {
  invoice: PlatformInvoiceDetail;
  invoiceHref?: string;
  receiptHref?: (payment: PlatformPayment) => string;
  actions?: React.ReactNode;
  paymentActions?: (payment: PlatformPayment) => React.ReactNode;
}) {
  const voided = invoice.status === 'void';
  return (
    <article className="flex min-w-0 flex-col gap-4 rounded-xl border bg-card p-4 text-card-foreground" aria-label={`Invoice ${invoice.number}`}>
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <h3 className="flex flex-wrap items-center gap-2 font-semibold">
            {invoiceHref ? (
              <Link href={invoiceHref} className="inline-flex items-center gap-1 font-mono text-primary underline-offset-4 hover:underline">
                <FileText className="size-4" aria-hidden="true" />
                {invoice.number}
              </Link>
            ) : (
              <span className="font-mono">{invoice.number}</span>
            )}
            <InvoiceStatusBadge invoice={invoice} />
          </h3>
          <p className="text-sm text-muted-foreground">{invoicePeriod(invoice)}</p>
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </header>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Figure label="Issued">{formatDate(invoice.issued_at)}</Figure>
        <Figure label="Due">{formatDate(invoice.due_date)}</Figure>
        <Figure label="Total">
          <Amounts value={invoice.total} locked={invoice.currency} />
        </Figure>
        <Figure label={voided ? 'Balance' : invoice.currency ? `Balance (pays in ${invoice.currency})` : 'Balance'}>
          {voided ? '—' : <Amounts value={invoice.balance} locked={invoice.currency} strong />}
        </Figure>
      </dl>
      {!voided && !invoice.currency && invoice.owing ? (
        <p className="text-sm text-muted-foreground">Pay in USD or LRD. The first payment fixes the currency.</p>
      ) : null}
      {voided ? (
        <p className="text-sm text-muted-foreground">
          Voided {formatDate(invoice.voided_at)}. Reason: {invoice.void_reason || 'not given'}.
        </p>
      ) : null}

      <details className="rounded-lg border px-3 [&_summary::-webkit-details-marker]:hidden">
        <summary className="flex min-h-11 cursor-pointer items-center text-sm font-medium">
          Lines ({invoice.lines.length})
        </summary>
        <div className="pb-3">
          <InvoiceLines invoice={invoice} />
        </div>
      </details>

      <section aria-label="Payments">
        <h4 className="flex items-center gap-2 text-sm font-medium">
          <ReceiptIcon className="size-4" aria-hidden="true" />
          Payments
        </h4>
        {invoice.payments.length === 0 ? (
          <p className="mt-1 text-sm text-muted-foreground">No payments yet.</p>
        ) : (
          <ul className="divide-y">
            {invoice.payments.map((p) => (
              <PaymentRow key={p.id} payment={p} receiptHref={receiptHref?.(p)} actions={paymentActions?.(p)} />
            ))}
          </ul>
        )}
      </section>
    </article>
  );
}

/**
 * Void something with a reason (an invoice or a payment). The record keeps its number and stays
 * visible, marked void. When the server refuses (an invoice with payments) its message is shown
 * as given and the dialog stays open.
 */
export function ReasonDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  placeholder,
  loading,
  onConfirm,
  successMessage,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: React.ReactNode;
  confirmLabel: string;
  placeholder?: string;
  loading?: boolean;
  onConfirm: (reason: string) => Promise<unknown>;
  successMessage: string;
}) {
  const [reason, setReason] = React.useState('');
  const [error, setError] = React.useState('');
  const id = React.useId();

  React.useEffect(() => {
    if (open) {
      setReason('');
      setError('');
    }
  }, [open]);

  const confirm = async () => {
    const text = reason.trim();
    if (text.length < 3) {
      setError('Say why, e.g. "Entered twice".');
      throw new Error('reason required');
    }
    try {
      await onConfirm(text);
      notify.success(successMessage);
    } catch (e) {
      const msg = errorMessage(e, "Couldn't do that. Check your connection and try again.");
      setError(msg);
      notify.error(msg);
      throw e;
    }
  };

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      confirmLabel={confirmLabel}
      destructive
      loading={loading}
      onConfirm={confirm}
    >
      <div className="grid gap-2">
        <label htmlFor={id} className="text-sm font-medium text-foreground">
          Reason <span className="text-destructive" aria-hidden="true">*</span>
        </label>
        <Textarea
          id={id}
          rows={3}
          value={reason}
          maxLength={500}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={(e) => {
            setReason(e.target.value);
            if (error) setError('');
          }}
          placeholder={placeholder}
        />
        {error ? (
          <p id={`${id}-error`} role="alert" className="text-sm font-medium text-destructive">
            {error}
          </p>
        ) : null}
      </div>
    </ConfirmDialog>
  );
}
