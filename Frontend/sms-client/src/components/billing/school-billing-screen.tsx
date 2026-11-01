'use client';

// Settings → Billing (/{school}/settings/billing; billing reminders link here): the school's
// account with the platform (phase7-design.md section 6). Status and amount due, the invoices with
// their lines and payments (each payment opens its receipt), how to pay, and "Download export"
// (a zip of the school's data, available whatever the account's status).
//
// Everyone in the school may read the status; invoices, receipts and the export are for the
// school's admins (the server refuses others).
import * as React from 'react';
import Link from 'next/link';
import { ChevronDown, Download, FileText, Landmark, Loader2, ShieldAlert } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { PageShell } from '@/components/ui/page-shell';
import { Skeleton } from '@/components/ui/skeleton';
import { notify } from '@/components/ui/toaster';
import { errorMessage, formatDate } from '@/components/students/format';
import { anyPositive, todayIso } from '@/components/fees/money';
import { Amounts, LoadError } from '@/components/fees/shared';
import { useTenant } from '@/hooks/use-tenant';
import { useSchoolBillingService, type PlatformInvoice } from '@/services/api/billing-service';
import { STATUS_HINTS } from './format';
import { useBillingStatus, useSchoolInvoice, useSchoolInvoices } from './queries';
import { BillingStatusBadge, InvoiceLines, InvoiceStatusBadge, invoicePeriod, PaymentRow } from './shared';

function useDownloadExport() {
  const service = useSchoolBillingService();
  const { tenant } = useTenant();
  const [pending, setPending] = React.useState(false);

  const download = async () => {
    setPending(true);
    try {
      const blob = await service.downloadExport();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(tenant?.code || 'school').toLowerCase()}-export-${todayIso()}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      notify.success('Export downloaded', { description: 'Students, guardians, enrollments, results and fee payments.' });
    } catch (e) {
      notify.error(errorMessage(e, "Couldn't download the export. Check your connection and try again."));
    } finally {
      setPending(false);
    }
  };
  return { download, pending };
}

function HowToPay() {
  return (
    <section className="flex flex-col gap-2 rounded-xl border bg-card p-4 text-card-foreground" aria-labelledby="how-to-pay">
      <h2 id="how-to-pay" className="flex items-center gap-2 font-semibold">
        <Landmark className="size-4" aria-hidden="true" />
        How to pay
      </h2>
      <p className="text-sm">Contact the platform to pay.</p>
      <p className="text-sm text-muted-foreground">
        Give the invoice number when you pay. Pay in USD or in LRD: the first payment on an invoice fixes its
        currency. Your receipt shows here once the payment is recorded, and access comes back at once.
      </p>
    </section>
  );
}

/** One invoice: its summary, and its lines and payments when opened (loaded then). */
function InvoiceItem({ school, invoice, defaultOpen }: { school: string; invoice: PlatformInvoice; defaultOpen: boolean }) {
  const [open, setOpen] = React.useState(defaultOpen);
  const detail = useSchoolInvoice(open ? invoice.id : undefined);
  const panelId = React.useId();
  const voided = invoice.status === 'void';

  return (
    <li className="rounded-xl border bg-card text-card-foreground">
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <p className="flex flex-wrap items-center gap-2 font-semibold">
            <Link
              href={`/${school}/settings/billing/invoices/${invoice.id}`}
              className="inline-flex items-center gap-1 font-mono text-primary underline-offset-4 hover:underline"
            >
              <FileText className="size-4" aria-hidden="true" />
              {invoice.number}
            </Link>
            <InvoiceStatusBadge invoice={invoice} />
          </p>
          <p className="text-sm text-muted-foreground">{invoicePeriod(invoice)}</p>
          <p className="text-sm text-muted-foreground">
            Issued {formatDate(invoice.issued_at)} · due {formatDate(invoice.due_date)}
          </p>
        </div>
        <dl className="grid grid-cols-2 gap-3 text-sm sm:text-right">
          <div>
            <dt className="text-xs text-muted-foreground">Total</dt>
            <dd>
              <Amounts value={invoice.total} locked={invoice.currency} />
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Balance</dt>
            <dd>{voided ? '—' : <Amounts value={invoice.balance} locked={invoice.currency} strong />}</dd>
          </div>
        </dl>
      </div>
      {!voided && invoice.owing && !invoice.currency ? (
        <p className="px-4 pb-3 text-sm text-muted-foreground">Pay the USD amount or the LRD amount, not both.</p>
      ) : null}
      {voided ? (
        <p className="px-4 pb-3 text-sm text-muted-foreground">
          Voided {formatDate(invoice.voided_at)}. Reason: {invoice.void_reason || 'not given'}.
        </p>
      ) : null}

      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-11 w-full items-center justify-between gap-2 border-t px-4 text-sm font-medium outline-none hover:bg-muted/40 focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        Lines and payments
        <ChevronDown className={cn('size-4 transition-transform', open && 'rotate-180')} aria-hidden="true" />
      </button>
      {open ? (
        <div id={panelId} className="grid gap-4 border-t p-4">
          {detail.isError ? (
            <LoadError error={detail.error} what="this invoice" onRetry={() => detail.refetch()} />
          ) : !detail.data ? (
            <Skeleton className="h-32 w-full" />
          ) : (
            <>
              <InvoiceLines invoice={detail.data} />
              <section aria-label="Payments and receipts">
                <h3 className="text-sm font-medium">Payments and receipts</h3>
                {detail.data.payments.length === 0 ? (
                  <p className="mt-1 text-sm text-muted-foreground">No payments yet.</p>
                ) : (
                  <ul className="divide-y">
                    {detail.data.payments.map((p) => (
                      <PaymentRow key={p.id} payment={p} receiptHref={`/${school}/settings/billing/receipts/${p.id}`} />
                    ))}
                  </ul>
                )}
              </section>
            </>
          )}
        </div>
      ) : null}
    </li>
  );
}

export function SchoolBillingScreen({ school }: { school: string }) {
  const statusQ = useBillingStatus();
  const status = statusQ.data;
  const admin = Boolean(status?.is_admin);
  const invoicesQ = useSchoolInvoices(admin);
  const invoices = invoicesQ.data ?? [];
  const { download, pending } = useDownloadExport();

  if (statusQ.isError) {
    return (
      <PageShell title="Billing">
        <LoadError error={statusQ.error} what="your school's billing" onRetry={() => statusQ.refetch()} />
      </PageShell>
    );
  }
  if (!status) {
    return (
      <PageShell title="Billing">
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </PageShell>
    );
  }

  const due = status.amount_due;
  const owing = anyPositive(due);
  // Open the oldest invoice still owing, else the newest
  const openId = [...invoices].reverse().find((i) => i.owing)?.id ?? invoices[0]?.id;

  return (
    <PageShell
      title="Billing"
      description="Your school's account with the platform."
      primaryAction={
        admin ? (
          <Button variant="outline" onClick={download} disabled={pending}>
            {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Download aria-hidden="true" />}
            Download export
          </Button>
        ) : undefined
      }
    >
      <section className="flex flex-col gap-4 rounded-xl border bg-card p-4 text-card-foreground" aria-labelledby="account-status">
        <div className="flex flex-wrap items-center gap-2">
          <h2 id="account-status" className="font-semibold">
            Account
          </h2>
          <BillingStatusBadge status={status.status} size="md" />
          {status.status_since ? (
            <span className="text-sm text-muted-foreground">since {formatDate(status.status_since)}</span>
          ) : null}
        </div>
        <p className="text-sm text-muted-foreground">{STATUS_HINTS[status.status]}</p>

        {admin ? (
          <dl className="grid gap-4 sm:grid-cols-3">
            <div>
              <dt className="text-sm text-muted-foreground">Amount due</dt>
              <dd className="text-xl font-semibold">
                {owing ? <Amounts value={due} strong /> : 'Nothing is due'}
              </dd>
              {owing && due?.USD && due?.LRD ? (
                <p className="text-xs text-muted-foreground">Pay either amount, not both.</p>
              ) : null}
            </div>
            {status.oldest_due_date ? (
              <div>
                <dt className="text-sm text-muted-foreground">Oldest due date</dt>
                <dd className="font-medium">{formatDate(status.oldest_due_date)}</dd>
              </div>
            ) : null}
            {status.read_only_on && status.status !== 'read_only' && status.status !== 'suspended' ? (
              <div>
                <dt className="text-sm text-muted-foreground">Read-only from</dt>
                <dd className="font-medium">{formatDate(status.read_only_on)}</dd>
              </div>
            ) : status.suspended_on && status.status === 'read_only' ? (
              <div>
                <dt className="text-sm text-muted-foreground">Suspended from</dt>
                <dd className="font-medium">{formatDate(status.suspended_on)}</dd>
              </div>
            ) : null}
            {status.grace_until ? (
              <div>
                <dt className="text-sm text-muted-foreground">Grace until</dt>
                <dd className="font-medium">{formatDate(status.grace_until)}</dd>
              </div>
            ) : null}
          </dl>
        ) : null}
        {status.message ? <p className="text-sm">{status.message}</p> : null}
      </section>

      {admin ? <HowToPay /> : null}

      {!admin ? (
        <EmptyState
          icon={ShieldAlert}
          title="For the school's administrators"
          description="Only the school's administrators can see invoices and receipts. Ask the school office."
        />
      ) : (
        <section className="flex flex-col gap-3" aria-labelledby="invoices">
          <h2 id="invoices" className="font-semibold">
            Invoices
          </h2>
          {invoicesQ.isError ? (
            <LoadError error={invoicesQ.error} what="the invoices" onRetry={() => invoicesQ.refetch()} />
          ) : invoicesQ.isLoading ? (
            <Skeleton className="h-32 w-full rounded-xl" />
          ) : invoices.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No invoices yet"
              description="An invoice is issued at the start of each term. Your first term is free."
            />
          ) : (
            <ul className="flex flex-col gap-3">
              {invoices.map((inv) => (
                <InvoiceItem key={inv.id} school={school} invoice={inv} defaultOpen={inv.id === openId} />
              ))}
            </ul>
          )}
        </section>
      )}
    </PageShell>
  );
}
