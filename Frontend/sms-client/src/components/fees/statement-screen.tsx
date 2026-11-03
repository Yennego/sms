'use client';

// Statement (/{school}/finance/accounts/{studentId}): one student's school year in money —
// semester bills with their lines and discounts, the installment schedule (paid / due / overdue),
// payments with receipt links and the balance (both currencies until the student's currency is
// fixed, then only that one). Record payment, add a discount or scholarship, print the statement.
// With approve_financial_transactions: void a bill, reset the fixed currency and override the report
// card hold.
import * as React from 'react';
import Link from 'next/link';
import { ArrowLeft, BadgePercent, Ban, FileX, Plus, Printer, RotateCcw, Trash2 } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { PageShell } from '@/components/ui/page-shell';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge, type StatusBadgeStatus } from '@/components/ui/status-badge';
import { notify } from '@/components/ui/toaster';
import { errorMessage, formatDate } from '@/components/students/format';
import { usePrintRequest } from '@/components/report-cards/print-root';
import { YearSelect, useResultYears } from '@/components/results/year-select';
import {
  CURRENCIES,
  type Currency,
  type FeeAdjustment,
  type InstallmentState,
  type Invoice,
  type Statement,
} from '@/services/api/fees-service';
import { AdjustmentSheet } from './adjustment-sheet';
import {
  ADJUSTMENT_LABELS,
  anyPositive,
  errorStatus,
  formatAmount,
  formatDateTime,
  formatMoney,
  formatPercent,
  INSTALLMENT_LABELS,
  isPositive,
  methodLabel,
} from './money';
import {
  useDeleteAdjustment,
  useFeesPermissions,
  useResetCurrency,
  useSetReportCardHold,
  useStatement,
} from './queries';
import { useReceiptSchool } from './receipt-screen';
import { RecordPaymentSheet } from './record-payment-sheet';
import { Amounts, LoadError, PrintPortal, StatTile } from './shared';
import { VoidInvoiceDialog } from './void-invoice-dialog';

const STATEMENT_PAGE = '@page { size: A4 portrait; margin: 12mm; }';

const INSTALLMENT_BADGE: Record<InstallmentState, StatusBadgeStatus> = {
  paid: 'success',
  due: 'warning',
  overdue: 'danger',
  upcoming: 'neutral',
};

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-base font-semibold text-foreground print:text-sm">{children}</h2>;
}

const th = 'px-3 py-2 text-left font-medium whitespace-nowrap text-muted-foreground print:text-neutral-700';
const td = 'px-3 py-2 align-top';

function adjustmentAmount(a: FeeAdjustment, currencies: Currency[]): string {
  if (a.percent !== null && a.percent !== undefined && a.percent !== '') return formatPercent(a.percent);
  return currencies
    .filter((c) => (c === 'USD' ? a.amount_usd : a.amount_lrd) !== null)
    .map((c) => formatMoney(c === 'USD' ? a.amount_usd : a.amount_lrd, c))
    .join(' · ');
}

/** The statement itself; `interactive` adds the remove and void buttons (left out when printing). */
function StatementBody({
  statement,
  interactive,
  school,
  onRemoveAdjustment,
  onVoidInvoice,
}: {
  statement: Statement;
  interactive: boolean;
  school: string;
  onRemoveAdjustment?: (a: FeeAdjustment) => void;
  onVoidInvoice?: (inv: Invoice) => void;
}) {
  const locked = statement.account.currency;
  const currencies: Currency[] = locked
    ? [locked]
    : statement.currencies.length > 0
      ? statement.currencies
      : [...CURRENCIES];
  const invoices = statement.invoices ?? [];
  const installments = statement.installments ?? [];
  const payments = statement.payments ?? [];

  return (
    <div className="flex flex-col gap-6 print:gap-4">
      {/* Installments */}
      <section className="grid gap-3">
        <SectionTitle>Installments</SectionTitle>
        {installments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No installment dates are set for this year yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border print:rounded-none">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr className="border-b">
                  <th className={th}>Due date</th>
                  <th className={th}>Semester</th>
                  <th className={cn(th, 'text-right')}>Share</th>
                  {currencies.map((c) => (
                    <th key={c} className={cn(th, 'text-right')}>
                      Due ({c})
                    </th>
                  ))}
                  <th className={th}>Status</th>
                </tr>
              </thead>
              <tbody>
                {installments.map((i) => {
                  const state: InstallmentState = i.status;
                  return (
                    <tr key={`${i.invoice_id}-${i.sequence}`} className="border-b last:border-0">
                      <td className={cn(td, 'whitespace-nowrap')}>{formatDate(i.due_date)}</td>
                      <td className={td}>{i.semester_name || '—'}</td>
                      <td className={cn(td, 'text-right tabular-nums')}>{formatPercent(i.percent)}</td>
                      {currencies.map((c) => (
                        <td key={c} className={cn(td, 'text-right tabular-nums')}>
                          {formatAmount(i.due?.[c] ?? null)}
                          {isPositive(i.overdue?.[c]) ? (
                            <span className="block text-xs text-red-700">
                              {formatAmount(i.overdue?.[c])} overdue
                            </span>
                          ) : null}
                        </td>
                      ))}
                      <td className={td}>
                        <StatusBadge status={INSTALLMENT_BADGE[state]} label={INSTALLMENT_LABELS[state]} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Bills */}
      <section className="grid gap-3">
        <SectionTitle>Bills</SectionTitle>
        {invoices.length === 0 ? (
          <p className="text-sm text-muted-foreground">No bills issued for this year yet.</p>
        ) : (
          invoices.map((inv) => (
            <article key={inv.id} className="rounded-xl border print:break-inside-avoid print:rounded-none">
              <header className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2">
                <h3 className="font-medium text-foreground">{inv.semester_name || 'Semester bill'}</h3>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  {inv.issued_at ? <span>Issued {formatDate(inv.issued_at)}</span> : null}
                  {inv.status === 'void' ? <StatusBadge status="neutral" label="Void" /> : null}
                  {interactive && onVoidInvoice && inv.status !== 'void' ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="min-h-11 md:min-h-8"
                      onClick={() => onVoidInvoice(inv)}
                      aria-label={`Void the ${inv.semester_name || 'semester'} invoice`}
                    >
                      <Ban aria-hidden="true" />
                      Void invoice
                    </Button>
                  ) : null}
                </div>
              </header>
              {inv.status === 'void' ? (
                <p className="border-b px-3 py-2 text-sm text-muted-foreground">
                  Voided{inv.voided_at ? ` on ${formatDate(inv.voided_at)}` : ''}
                  {inv.voided_by_name ? ` by ${inv.voided_by_name}` : ''}. It no longer counts.
                  {inv.void_reason ? ` Reason: ${inv.void_reason}` : ''}
                </p>
              ) : null}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className={th}>Item</th>
                      {currencies.map((c) => (
                        <th key={c} className={cn(th, 'text-right')}>
                          {c}
                        </th>
                      ))}
                      {interactive && onRemoveAdjustment ? <th className={th}><span className="sr-only">Actions</span></th> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {inv.lines.map((l) => (
                      <tr key={l.id} className="border-b">
                        <td className={td}>{l.description || l.category_name || 'Fee'}</td>
                        {currencies.map((c) => (
                          <td key={c} className={cn(td, 'text-right tabular-nums')}>
                            {formatAmount(c === 'USD' ? l.amount_usd : l.amount_lrd)}
                          </td>
                        ))}
                        {interactive && onRemoveAdjustment ? <td /> : null}
                      </tr>
                    ))}
                    {inv.adjustments.map((a) => (
                      <tr key={a.id} className="border-b text-green-800">
                        <td className={td}>
                          {ADJUSTMENT_LABELS[a.kind] ?? a.kind}: {a.reason}
                          <span className="block text-xs text-muted-foreground">
                            {adjustmentAmount(a, currencies)}
                            {a.approved_by_name ? ` · approved by ${a.approved_by_name}` : ''}
                            {a.created_at ? ` · ${formatDate(a.created_at)}` : ''}
                          </span>
                        </td>
                        {currencies.map((c) => {
                          // What it takes off in this currency (worked out by the server, also for a percent).
                          const amount = a.value?.[c];
                          return (
                            <td key={c} className={cn(td, 'text-right tabular-nums')}>
                              {isPositive(amount) ? `-${formatAmount(amount)}` : ''}
                            </td>
                          );
                        })}
                        {interactive && onRemoveAdjustment ? (
                          <td className={cn(td, 'text-right')}>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-11 md:size-8"
                              onClick={() => onRemoveAdjustment(a)}
                              aria-label={`Remove ${ADJUSTMENT_LABELS[a.kind] ?? a.kind}: ${a.reason}`}
                            >
                              <Trash2 aria-hidden="true" />
                            </Button>
                          </td>
                        ) : null}
                      </tr>
                    ))}
                  </tbody>
                  {inv.status !== 'void' ? (
                    <tfoot>
                      {inv.owed ? (
                        <tr>
                          <td className={cn(td, 'font-medium')}>Total billed</td>
                          {currencies.map((c) => (
                            <td key={c} className={cn(td, 'text-right font-medium tabular-nums')}>
                              {formatAmount(inv.owed?.[c] ?? null)}
                            </td>
                          ))}
                          {interactive && onRemoveAdjustment ? <td /> : null}
                        </tr>
                      ) : null}
                      {inv.balance ? (
                        <tr>
                          <td className={cn(td, 'font-semibold')}>Still to pay</td>
                          {currencies.map((c) => (
                            <td key={c} className={cn(td, 'text-right font-semibold tabular-nums')}>
                              {formatAmount(inv.balance?.[c] ?? null)}
                            </td>
                          ))}
                          {interactive && onRemoveAdjustment ? <td /> : null}
                        </tr>
                      ) : null}
                    </tfoot>
                  ) : null}
                </table>
              </div>
            </article>
          ))
        )}
      </section>

      {/* Payments */}
      <section className="grid gap-3">
        <SectionTitle>Payments</SectionTitle>
        {payments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No payments yet this year.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border print:rounded-none">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr className="border-b">
                  <th className={th}>Receipt no.</th>
                  <th className={th}>Date</th>
                  <th className={cn(th, 'text-right')}>Amount</th>
                  <th className={th}>Method</th>
                  <th className={th}>Received by</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => {
                  const voided = Boolean(p.voided_at);
                  return (
                    <tr key={p.id} className={cn('border-b last:border-0', voided && 'text-muted-foreground')}>
                      <td className={cn(td, 'whitespace-nowrap')}>
                        {interactive ? (
                          <Link
                            href={`/${school}/finance/payments/${p.id}`}
                            className="font-mono font-medium text-primary underline-offset-4 hover:underline"
                          >
                            {p.receipt_number}
                          </Link>
                        ) : (
                          <span className="font-mono">{p.receipt_number}</span>
                        )}
                        {voided ? <StatusBadge status="neutral" label="Void" className="ml-2" /> : null}
                      </td>
                      <td className={cn(td, 'whitespace-nowrap')}>{formatDateTime(p.received_at)}</td>
                      <td className={cn(td, 'text-right whitespace-nowrap tabular-nums', voided && 'line-through')}>
                        {formatMoney(p.amount, p.currency)}
                      </td>
                      <td className={td}>
                        {methodLabel(p.method)}
                        {p.reference ? <span className="block text-xs text-muted-foreground">{p.reference}</span> : null}
                      </td>
                      <td className={td}>{p.received_by_name || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Summary({ statement }: { statement: Statement }) {
  const locked = statement.account.currency;
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <StatTile label="Balance" tone={anyPositive(statement.balance) ? 'warning' : 'default'}>
        <Amounts value={statement.balance} locked={locked} />
      </StatTile>
      <StatTile label="Overdue" tone={anyPositive(statement.overdue) ? 'danger' : 'default'}>
        <Amounts value={statement.overdue} locked={locked} />
      </StatTile>
      <StatTile label="Paid this year">
        <Amounts value={statement.paid} locked={locked} />
      </StatTile>
    </div>
  );
}

/** Where the report cards stand, in words (staff view of the hold, the setting and the override). */
function holdNote(statement: Statement): string {
  const { setting_on, override, held } = statement.report_card_hold;
  if (override) {
    return setting_on
      ? 'Report cards are released for this student: they show even while fees are overdue.'
      : "Report cards are released for this student. The school doesn't hold report cards for fees at the moment anyway.";
  }
  if (!setting_on) return "The school doesn't hold report cards for fees.";
  return held
    ? 'Report cards are held: this student has overdue fees. The student and their parents see a message to contact the school office.'
    : 'Report cards are not held: nothing is overdue. They will be held if an installment becomes overdue.';
}

function currencyNote(statement: Statement): string {
  const locked = statement.account.currency;
  if (locked) {
    return `This student pays in ${locked} this year${
      statement.account.currency_locked_at ? ` (since ${formatDate(statement.account.currency_locked_at)})` : ''
    }.`;
  }
  return 'Amounts are shown in both currencies until the first payment fixes the currency for the year.';
}

export function StatementScreen({ school, studentId }: { school: string; studentId: string }) {
  const years = useResultYears();
  const q = useStatement(studentId, years.yearId);
  const statement = q.data;
  const perms = useFeesPermissions();
  const receiptSchool = useReceiptSchool();
  const print = usePrintRequest();
  const removeAdjustment = useDeleteAdjustment();
  const resetCurrency = useResetCurrency();
  const setHold = useSetReportCardHold();
  const [recording, setRecording] = React.useState(false);
  const [adjusting, setAdjusting] = React.useState(false);
  const [removing, setRemoving] = React.useState<FeeAdjustment | null>(null);
  const [voiding, setVoiding] = React.useState<Invoice | null>(null);
  const [resetting, setResetting] = React.useState(false);
  /** The override being confirmed: true = release, false = follow the school setting. */
  const [holdChange, setHoldChange] = React.useState<boolean | null>(null);

  const studentName = statement?.student?.name ?? 'Student';
  const yearName =
    statement?.academic_year.name ?? years.years.find((y) => y.id === years.yearId)?.name ?? '';

  const back = (
    <Link
      href={`/${school}/finance/fees`}
      className="inline-flex min-h-11 items-center gap-1 hover:text-foreground md:min-h-0"
    >
      <ArrowLeft className="size-4" aria-hidden="true" />
      Student accounts
    </Link>
  );

  const yearPicker = (
    <YearSelect years={years.years} value={years.yearId} onChange={years.setYearId} />
  );

  if (q.isError) {
    const notFound = errorStatus(q.error) === 404;
    return (
      <PageShell title="Statement" eyebrow={back}>
        {yearPicker}
        {notFound ? (
          <EmptyState
            icon={FileX}
            title="No bill this school year"
            description="This student has no fee account for this year yet. Issue invoices for their class in Fee setup."
            action={
              perms.setup ? (
                <Button asChild variant="outline">
                  <Link href={`/${school}/finance/structures`}>Open fee setup</Link>
                </Button>
              ) : undefined
            }
          />
        ) : (
          <LoadError error={q.error} what="this statement" onRetry={() => q.refetch()} />
        )}
      </PageShell>
    );
  }

  if (!statement) {
    return (
      <PageShell title="Statement" eyebrow={back}>
        <div className="grid gap-3 sm:grid-cols-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-48" />
      </PageShell>
    );
  }

  const student = statement.student;
  const owes = anyPositive(statement.balance);
  const yearId = statement.academic_year.id;
  const locked = statement.account.currency;
  const hold = statement.report_card_hold;

  return (
    <PageShell
      title={studentName}
      eyebrow={back}
      description={[student?.class_name, student?.admission_number, yearName && `School year ${yearName}`]
        .filter(Boolean)
        .join(' · ')}
      primaryAction={
        perms.record && owes ? (
          <Button onClick={() => setRecording(true)}>
            <Plus aria-hidden="true" />
            Record payment
          </Button>
        ) : undefined
      }
      secondaryActions={
        <>
          {perms.approve && statement.invoices.some((i) => i.status !== 'void') ? (
            <Button variant="outline" onClick={() => setAdjusting(true)}>
              <BadgePercent aria-hidden="true" />
              Add discount or scholarship
            </Button>
          ) : null}
          {perms.approve && locked ? (
            <Button variant="outline" onClick={() => setResetting(true)}>
              <RotateCcw aria-hidden="true" />
              Reset currency
            </Button>
          ) : null}
          <Button variant="outline" onClick={print}>
            <Printer aria-hidden="true" />
            Print statement
          </Button>
        </>
      }
    >
      {yearPicker}
      <Summary statement={statement} />
      <p className="text-sm text-muted-foreground">{currencyNote(statement)}</p>

      <section
        aria-label="Report cards"
        className="flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold text-foreground">Report cards</h2>
            {hold.held ? <StatusBadge status="danger" label="Held for fees" /> : null}
            {hold.override ? <StatusBadge status="neutral" label="Released" /> : null}
          </div>
          <p className="text-sm text-muted-foreground">{holdNote(statement)}</p>
        </div>
        {perms.approve && (hold.setting_on || hold.override) ? (
          <Button
            variant="outline"
            className="min-h-11 shrink-0 md:min-h-9"
            onClick={() => setHoldChange(!hold.override)}
          >
            {hold.override ? 'Follow the school setting' : 'Release report cards'}
          </Button>
        ) : null}
      </section>

      <StatementBody
        statement={statement}
        interactive
        school={school}
        onRemoveAdjustment={perms.approve ? setRemoving : undefined}
        onVoidInvoice={perms.approve ? setVoiding : undefined}
      />

      <PrintPortal pageCss={STATEMENT_PAGE}>
        <div className="bg-white p-2 text-[12px] text-neutral-900">
          <header className="mb-4 flex items-center gap-3 border-b-2 border-neutral-800 pb-3">
            {receiptSchool.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={receiptSchool.logo} alt="" className="size-14 object-contain" />
            ) : null}
            <div className="flex-1">
              <p className="text-lg font-bold uppercase">{receiptSchool.name}</p>
              {receiptSchool.address ? <p className="text-xs">{receiptSchool.address}</p> : null}
            </div>
            <div className="text-right">
              <p className="text-base font-bold uppercase">Fee statement</p>
              <p className="text-xs">Printed {formatDate(new Date().toISOString())}</p>
            </div>
          </header>
          <div className="mb-4 grid grid-cols-2 gap-1">
            <p>
              <strong>Student:</strong> {studentName}
            </p>
            <p>
              <strong>School year:</strong> {yearName || '—'}
            </p>
            <p>
              <strong>Class:</strong> {student?.class_name || '—'}
            </p>
            <p>
              <strong>Admission no.:</strong> {student?.admission_number || '—'}
            </p>
          </div>
          <div className="mb-4 grid grid-cols-3 gap-2 border border-neutral-700 p-2">
            <div>
              <p className="text-[10px] font-semibold uppercase">Balance</p>
              <Amounts value={statement.balance} locked={statement.account.currency} strong />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase">Overdue</p>
              <Amounts value={statement.overdue} locked={statement.account.currency} strong />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase">Paid this year</p>
              <Amounts value={statement.paid} locked={statement.account.currency} strong />
            </div>
          </div>
          <p className="mb-4 text-xs">{currencyNote(statement)}</p>
          <StatementBody statement={statement} interactive={false} school={school} />
        </div>
      </PrintPortal>

      {perms.record ? (
        <RecordPaymentSheet
          school={school}
          open={recording}
          onOpenChange={setRecording}
          yearId={yearId}
          student={{
            student_id: studentId,
            name: studentName,
            class_name: student?.class_name,
            admission_number: student?.admission_number,
          }}
        />
      ) : null}
      {perms.approve ? (
        <AdjustmentSheet
          open={adjusting}
          onOpenChange={setAdjusting}
          invoices={statement.invoices}
          locked={locked}
          currencies={statement.currencies}
        />
      ) : null}
      {perms.approve ? (
        <VoidInvoiceDialog invoice={voiding} onOpenChange={(open) => !open && setVoiding(null)} />
      ) : null}
      {perms.approve ? (
        <ConfirmDialog
          open={resetting}
          onOpenChange={setResetting}
          title={`Reset ${studentName}'s currency?`}
          description={
            <>
              {studentName} pays in {locked ?? 'one currency'} this school year. Resetting unfixes it: amounts show in
              USD and LRD again, and the next payment fixes the currency. Use it when the first payment was recorded in
              the wrong currency and has been voided. It only works when none of this year&apos;s payments still count.
            </>
          }
          confirmLabel="Reset currency"
          loading={resetCurrency.isPending}
          onConfirm={async () => {
            try {
              await resetCurrency.mutateAsync({ studentId, yearId });
              notify.success('Currency reset', { description: 'The next payment fixes the currency for this year.' });
            } catch (error) {
              notify.error(errorMessage(error, "Couldn't reset the currency. Check your connection and try again."), {
                description:
                  errorStatus(error) === 409
                    ? 'Void the payments that still count first, then reset the currency.'
                    : undefined,
              });
              throw error;
            }
          }}
        />
      ) : null}
      {perms.approve ? (
        <ConfirmDialog
          open={holdChange !== null}
          onOpenChange={(open) => !open && setHoldChange(null)}
          title={holdChange ? `Release ${studentName}'s report cards?` : `Hold ${studentName}'s report cards again?`}
          description={
            holdChange
              ? 'The student and their parents can open and print report cards even while fees are overdue. You can undo this at any time.'
              : 'Report cards follow the school setting again: they are held whenever this student has overdue fees.'
          }
          confirmLabel={holdChange ? 'Release report cards' : 'Follow the school setting'}
          loading={setHold.isPending}
          onConfirm={async () => {
            if (holdChange === null) return;
            try {
              await setHold.mutateAsync({ studentId, yearId, override: holdChange });
              notify.success(holdChange ? 'Report cards released' : 'Report cards follow the school setting');
            } catch (error) {
              notify.error(errorMessage(error, "Couldn't change the report card hold. Check your connection and try again."));
              throw error;
            }
          }}
        />
      ) : null}
      <ConfirmDialog
        open={Boolean(removing)}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={removing ? `Remove this ${(ADJUSTMENT_LABELS[removing.kind] ?? 'adjustment').toLowerCase()}?` : 'Remove?'}
        description={
          removing ? `"${removing.reason}" will no longer lower this student's bill, so the balance goes up.` : undefined
        }
        confirmLabel="Remove from the bill"
        destructive
        loading={removeAdjustment.isPending}
        onConfirm={async () => {
          if (!removing) return;
          try {
            await removeAdjustment.mutateAsync(removing.id);
            notify.success('Removed from the bill');
          } catch (error) {
            notify.error(errorMessage(error, "Couldn't remove it. Check your connection and try again."));
            throw error;
          }
        }}
      />
    </PageShell>
  );
}
