'use client';

// One school's platform account (/platform/billing/schools/{id}): status, amount due and usage by
// month; its invoices with lines and payments; and the operator's actions: issue the invoice for a
// term, record or void a payment, void an invoice, set a grace date, mark it dormant or active.
import * as React from 'react';
import Link from 'next/link';
import type { ColumnDef } from '@tanstack/react-table';
import { ArrowLeft, Ban, CalendarClock, FilePlus2, FileSearch, Moon, Plus, Sun } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { DataTable } from '@/components/ui/data-table';
import { DropdownMenu } from '@/components/ui/dropdown-menu';
import { EmptyState } from '@/components/ui/empty-state';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { PageShell } from '@/components/ui/page-shell';
import { Skeleton } from '@/components/ui/skeleton';
import { notify } from '@/components/ui/toaster';
import { errorMessage, formatDate } from '@/components/students/format';
import { anyPositive, errorStatus, formatMoney } from '@/components/fees/money';
import { Amounts, inputClassName, LoadError, nativeSelectClassName } from '@/components/fees/shared';
import type {
  BillingSchoolDetail,
  PlatformInvoice,
  PlatformPayment,
  UsageMonth,
} from '@/services/api/billing-service';
import { formatMonth, STATUS_HINTS, statusLabel } from './format';
import { PlatformPaymentSheet } from './platform-payment-sheet';
import {
  useBillingSchool,
  useIssueInvoice,
  useUpdateSubscription,
  useVoidInvoice,
  useVoidPlatformPayment,
} from './queries';
import { BillingStatusBadge, InvoiceCard, ReasonDialog } from './shared';

const back = (
  <Link href="/platform/billing" className="inline-flex min-h-11 items-center gap-1 hover:text-foreground md:min-h-0">
    <ArrowLeft className="size-4" aria-hidden="true" />
    Billing
  </Link>
);

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="font-medium">{children}</dd>
    </div>
  );
}

/** Issue the term's invoice now (the daily job also does it). 409 when no price list is in force. */
function IssueInvoiceDialog({
  school,
  open,
  onOpenChange,
}: {
  school: BillingSchoolDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const issue = useIssueInvoice();
  const [semesterId, setSemesterId] = React.useState('');
  const [error, setError] = React.useState<React.ReactNode>(null);

  React.useEffect(() => {
    if (open) {
      setSemesterId(school.current_semester?.id ?? school.semesters[school.semesters.length - 1]?.id ?? '');
      setError(null);
    }
  }, [open, school]);

  const confirm = async () => {
    if (!semesterId) {
      setError('Choose the term to bill.');
      throw new Error('semester required');
    }
    try {
      const invoice = await issue.mutateAsync({ tenantId: school.tenant_id, semesterId });
      if (invoice.created) {
        notify.success(`Invoice ${invoice.number} issued`, {
          description: anyPositive(invoice.total) ? `Due ${formatDate(invoice.due_date)}.` : 'Nothing to pay: the first term is free.',
        });
      } else {
        notify.info(`This term already has invoice ${invoice.number}`, {
          description: 'Void it first to issue the term again.',
        });
      }
    } catch (e) {
      const msg = errorMessage(e, "Couldn't issue the invoice. Check your connection and try again.");
      if (errorStatus(e) === 409 && /price list/i.test(msg)) {
        setError(
          <>
            No price list is in force yet, so there is nothing to price the invoice with.{' '}
            <Link href="/platform/billing/prices" className="font-medium underline underline-offset-4">
              Add a price list
            </Link>{' '}
            that starts on or before today, then issue the invoice.
          </>
        );
      } else {
        setError(msg);
      }
      notify.error(msg);
      throw e;
    }
  };

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Issue an invoice to ${school.name}?`}
      description="Staff for the chosen term, plus the parents and students who signed in during the term before it. The price list in force today applies. Due in 30 days."
      confirmLabel="Issue invoice"
      loading={issue.isPending}
      onConfirm={confirm}
    >
      {school.semesters.length === 0 ? (
        <p className="text-sm text-muted-foreground">This school has no terms yet. It needs at least one semester first.</p>
      ) : (
        <FormField label="Term" error={typeof error === 'string' ? error : undefined}>
          <select
            className={nativeSelectClassName}
            value={semesterId}
            onChange={(e) => {
              setSemesterId(e.target.value);
              setError(null);
            }}
          >
            {school.semesters.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({formatDate(s.start_date)} to {formatDate(s.end_date)})
                {s.id === school.current_semester?.id ? ' · current' : ''}
              </option>
            ))}
          </select>
        </FormField>
      )}
      {error && typeof error !== 'string' ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </ConfirmDialog>
  );
}

/** A date until which the status can't get worse (inclusive); empty removes it. */
function GraceDialog({
  school,
  open,
  onOpenChange,
}: {
  school: BillingSchoolDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const update = useUpdateSubscription();
  const [day, setDay] = React.useState('');
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    if (open) {
      setDay(school.subscription.grace_until ?? '');
      setError('');
    }
  }, [open, school]);

  const confirm = async () => {
    try {
      await update.mutateAsync({ tenantId: school.tenant_id, input: { grace_until: day || null } });
      notify.success(day ? `Grace until ${formatDate(day)}` : 'Grace removed');
    } catch (e) {
      const msg = errorMessage(e, "Couldn't save the grace date. Check your connection and try again.");
      setError(msg);
      notify.error(msg);
      throw e;
    }
  };

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Give the school more time?"
      description="Until this day (included) the school won't become read-only or suspended for what it owes. Paying still restores access at once."
      confirmLabel={day ? 'Set grace' : 'Remove grace'}
      loading={update.isPending}
      onConfirm={confirm}
    >
      <FormField label="Grace until" error={error || undefined} description="Leave empty to remove the grace.">
        <Input type="date" value={day} onChange={(e) => setDay(e.target.value)} className={inputClassName} />
      </FormField>
    </ConfirmDialog>
  );
}

function DormantDialog({
  school,
  open,
  onOpenChange,
}: {
  school: BillingSchoolDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const update = useUpdateSubscription();
  const dormant = school.subscription.status === 'dormant';

  const confirm = async () => {
    try {
      const sub = await update.mutateAsync({ tenantId: school.tenant_id, input: { dormant: !dormant } });
      notify.success(dormant ? `${school.name} is active again` : `${school.name} is dormant`, {
        description: dormant ? `Status now: ${statusLabel(sub.status).toLowerCase()}.` : 'Free and read-only; its data is kept.',
      });
    } catch (e) {
      notify.error(errorMessage(e, "Couldn't change the status. Check your connection and try again."));
      throw e;
    }
  };

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={dormant ? `Make ${school.name} active again?` : `Mark ${school.name} dormant?`}
      description={
        dormant
          ? 'Its status is worked out again from its invoices: active, or read-only or suspended if it still owes.'
          : 'A dormant school pays nothing and is read-only: everyone can sign in and view, nobody can change anything. Its data is kept for a year.'
      }
      confirmLabel={dormant ? 'Make active' : 'Mark dormant'}
      destructive={!dormant}
      loading={update.isPending}
      onConfirm={confirm}
    />
  );
}

const usageColumns: ColumnDef<UsageMonth>[] = [
  { id: 'month', enableSorting: false, header: 'Month', cell: ({ row }) => formatMonth(row.original.month) },
  {
    id: 'staff',
    enableSorting: false,
    header: 'Staff signed in',
    cell: ({ row }) => <span className="tabular-nums">{row.original.staff_signed_in}</span>,
    meta: { className: 'text-right' },
  },
  {
    id: 'family',
    enableSorting: false,
    header: 'Parents and students signed in',
    cell: ({ row }) => <span className="tabular-nums">{row.original.family_signed_in}</span>,
    meta: { className: 'text-right' },
  },
];

export function PlatformSchoolScreen({ tenantId }: { tenantId: string }) {
  const q = useBillingSchool(tenantId);
  const school = q.data;
  const voidInvoice = useVoidInvoice();
  const voidPayment = useVoidPlatformPayment();

  const [issuing, setIssuing] = React.useState(false);
  const [grace, setGrace] = React.useState(false);
  const [dormant, setDormant] = React.useState(false);
  const [paying, setPaying] = React.useState<PlatformInvoice | null>(null);
  const [voidingInvoice, setVoidingInvoice] = React.useState<PlatformInvoice | null>(null);
  const [voidingPayment, setVoidingPayment] = React.useState<PlatformPayment | null>(null);

  if (q.isError) {
    return (
      <PageShell title="School billing" eyebrow={back}>
        {errorStatus(q.error) === 404 ? (
          <EmptyState icon={FileSearch} title="School not found" description="This school doesn't exist. Find it in the list." />
        ) : (
          <LoadError error={q.error} what="this school's billing" onRetry={() => q.refetch()} />
        )}
      </PageShell>
    );
  }
  if (!school) {
    return (
      <PageShell title="School billing" eyebrow={back}>
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </PageShell>
    );
  }

  const sub = school.subscription;
  const price = school.price_in_force;
  const isDormant = sub.status === 'dormant';

  return (
    <PageShell
      title={school.name}
      description={`${school.code}${school.domain ? ` · ${school.domain}` : ''} · ${school.staff_count} staff`}
      eyebrow={back}
      primaryAction={
        <Button onClick={() => setIssuing(true)}>
          <FilePlus2 aria-hidden="true" />
          Issue invoice
        </Button>
      }
      secondaryActions={
        <DropdownMenu
          label={`More actions for ${school.name}`}
          items={[
            { label: sub.grace_until ? 'Change grace' : 'Give more time', icon: CalendarClock, onSelect: () => setGrace(true) },
            isDormant
              ? { label: 'Make active again', icon: Sun, onSelect: () => setDormant(true) }
              : { label: 'Mark dormant', icon: Moon, destructive: true, onSelect: () => setDormant(true) },
          ]}
        />
      }
    >
      <section className="flex flex-col gap-4 rounded-xl border bg-card p-4 text-card-foreground" aria-labelledby="school-account">
        <div className="flex flex-wrap items-center gap-2">
          <h2 id="school-account" className="font-semibold">
            Account
          </h2>
          <BillingStatusBadge status={sub.status} size="md" />
          {sub.status_since ? <span className="text-sm text-muted-foreground">since {formatDate(sub.status_since)}</span> : null}
        </div>
        <p className="text-sm text-muted-foreground">
          {STATUS_HINTS[sub.status]}
          {sub.status_reason ? ` ${sub.status_reason}.` : ''}
        </p>
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Fact label="Amount due">{anyPositive(school.amount_due) ? <Amounts value={school.amount_due} strong /> : 'Nothing'}</Fact>
          <Fact label="Oldest due date">{formatDate(school.oldest_due_date) || '—'}</Fact>
          <Fact label="Grace until">{formatDate(sub.grace_until) || 'No grace'}</Fact>
          <Fact label="First term free">{sub.first_term_free_used ? 'Used' : 'Not used yet'}</Fact>
          <Fact label="Current term">{school.current_semester?.name ?? 'None'}</Fact>
          <Fact label={school.last_term_name ? `Family months (${school.last_term_name})` : 'Family months last term'}>
            {school.last_term_name ? school.last_term_family_months : '—'}
          </Fact>
          <Fact label="Price list in force">
            {price ? (
              <span className="text-sm font-normal">
                From {formatDate(price.effective_from)}: staff {formatMoney(price.staff_per_month_usd, 'USD')} /{' '}
                {formatMoney(price.staff_per_month_lrd, 'LRD')} a month
              </span>
            ) : (
              <Link href="/platform/billing/prices" className="text-primary underline underline-offset-4">
                None yet: add one
              </Link>
            )}
          </Fact>
        </dl>
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="school-usage">
        <h2 id="school-usage" className="font-semibold">
          Usage by month
        </h2>
        <DataTable
          columns={usageColumns}
          data={school.usage}
          label="Usage by month"
          pageSize={0}
          getRowId={(r) => r.month}
          emptyState={<EmptyState description="No sign-ins recorded in the last 12 months." />}
        />
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="school-invoices">
        <h2 id="school-invoices" className="font-semibold">
          Invoices
        </h2>
        {school.invoices.length === 0 ? (
          <EmptyState
            icon={FilePlus2}
            title="No invoices yet"
            description="The daily job issues one at the start of each term. You can issue the current term's now."
          />
        ) : (
          <div className="flex flex-col gap-3">
            {school.invoices.map((inv) => (
              <InvoiceCard
                key={inv.id}
                invoice={inv}
                invoiceHref={`/platform/billing/invoices/${inv.id}`}
                receiptHref={(p) => `/platform/billing/receipts/${p.id}`}
                actions={
                  inv.status === 'issued' ? (
                    <>
                      {inv.owing ? (
                        <Button size="sm" className="min-h-11 md:min-h-8" onClick={() => setPaying(inv)}>
                          <Plus aria-hidden="true" />
                          Record payment
                        </Button>
                      ) : null}
                      <DropdownMenu
                        label={`More actions for invoice ${inv.number}`}
                        items={[{ label: 'Void invoice', icon: Ban, destructive: true, onSelect: () => setVoidingInvoice(inv) }]}
                      />
                    </>
                  ) : undefined
                }
                paymentActions={(p) =>
                  p.voided ? null : (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="min-h-11 text-destructive md:min-h-8"
                      onClick={() => setVoidingPayment(p)}
                    >
                      Void
                      <span className="sr-only"> receipt {p.receipt_number}</span>
                    </Button>
                  )
                }
              />
            ))}
          </div>
        )}
      </section>

      <IssueInvoiceDialog school={school} open={issuing} onOpenChange={setIssuing} />
      <GraceDialog school={school} open={grace} onOpenChange={setGrace} />
      <DormantDialog school={school} open={dormant} onOpenChange={setDormant} />
      <PlatformPaymentSheet invoice={paying} schoolName={school.name} onOpenChange={(open) => !open && setPaying(null)} />
      <ReasonDialog
        open={Boolean(voidingInvoice)}
        onOpenChange={(open) => !open && setVoidingInvoice(null)}
        title={voidingInvoice ? `Void invoice ${voidingInvoice.number}?` : 'Void invoice?'}
        description="Nothing will be owed on it. It keeps its number and stays on record, marked void. An invoice with payments can't be voided: void its payments first."
        confirmLabel="Void invoice"
        placeholder="e.g. Issued for the wrong term."
        loading={voidInvoice.isPending}
        successMessage={voidingInvoice ? `Invoice ${voidingInvoice.number} voided` : 'Invoice voided'}
        onConfirm={(reason) => voidInvoice.mutateAsync({ id: voidingInvoice!.id, reason })}
      />
      <ReasonDialog
        open={Boolean(voidingPayment)}
        onOpenChange={(open) => !open && setVoidingPayment(null)}
        title={voidingPayment ? `Void receipt ${voidingPayment.receipt_number}?` : 'Void receipt?'}
        description={
          voidingPayment
            ? `${formatMoney(voidingPayment.amount, voidingPayment.currency)} will no longer count as paid. The receipt keeps its number and is marked VOID.`
            : undefined
        }
        confirmLabel="Void payment"
        placeholder="e.g. Entered twice; the school paid once."
        loading={voidPayment.isPending}
        successMessage={voidingPayment ? `Receipt ${voidingPayment.receipt_number} voided` : 'Payment voided'}
        onConfirm={(reason) => voidPayment.mutateAsync({ id: voidingPayment!.id, reason })}
      />
    </PageShell>
  );
}
