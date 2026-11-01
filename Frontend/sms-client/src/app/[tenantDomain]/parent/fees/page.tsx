'use client';

// Parent fees (phase5-design.md section 6): for the chosen child and school year, the balance in
// the child's currency (both currencies until the first payment sets one), the installments with
// their due dates and status in words, and the payments - each opens a printable receipt.
import * as React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { CalendarX, ChevronRight, Info, Receipt as ReceiptIcon, Wallet } from 'lucide-react';

import { ChildSwitcher, childLine, useSelectedChild } from '@/components/parent/child-switcher';
import { InstallmentBadge, OverdueBadge, VoidBadge } from '@/components/parent/fee-status';
import { formatDay, formatMoney, moneyLines } from '@/components/parent/money';
import { isReportCardHeld, statusOf, useFamilyStatement } from '@/components/parent/queries';
import { NoChildrenState, ParentSkeleton, RetryState } from '@/components/parent/states';
import { useStudentReportCard } from '@/components/report-cards/queries';
import { useResultYears, YearSelect } from '@/components/results/year-select';
import { EmptyState } from '@/components/ui/empty-state';
import { PageShell } from '@/components/ui/page-shell';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/ui/status-badge';
import { cn } from '@/lib/utils';
import { hasAmount, isZeroAmount, methodLabel, type FamilyStatement } from '@/services/api/family-service';

function Section({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  const id = React.useId();
  return (
    <section aria-labelledby={id} className={cn('flex min-w-0 flex-col gap-3', className)}>
      <h2 id={id} className="text-lg font-semibold text-foreground">
        {title}
      </h2>
      {children}
    </section>
  );
}

function HeldNote() {
  return (
    <div role="note" className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-blue-900">
      <Info className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
      <p className="text-base">Report cards are available once the overdue balance is paid.</p>
    </div>
  );
}

function BalanceCard({ statement }: { statement: FamilyStatement }) {
  const balance = moneyLines(statement.balance, statement.currency);
  const overdue = moneyLines(statement.overdue, statement.currency).filter(
    (l) => !isZeroAmount(statement.overdue[l.currency])
  );
  const owing = hasAmount(statement.balance);
  return (
    <div className="flex min-w-0 flex-col gap-3 rounded-xl border bg-card p-4">
      <p className="text-sm text-muted-foreground">Balance to pay</p>
      {owing ? (
        <div className="flex flex-col gap-1">
          {balance.map((b, i) => (
            <React.Fragment key={b.currency}>
              {i > 0 ? <p className="text-sm text-muted-foreground">or</p> : null}
              <p className="text-3xl font-bold tabular-nums break-words text-foreground">{b.text}</p>
            </React.Fragment>
          ))}
        </div>
      ) : (
        <StatusBadge status="success" label="Nothing to pay" size="md" className="text-base" />
      )}
      {owing && !statement.currency && balance.length > 1 ? (
        <p className="text-sm text-muted-foreground">
          Pay in USD or LRD. The first payment sets the currency for this school year.
        </p>
      ) : null}
      {overdue.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <OverdueBadge />
          <span className="text-base font-semibold tabular-nums text-red-800">
            {overdue.map((o) => o.text).join(' / ')} overdue
          </span>
        </div>
      ) : null}
    </div>
  );
}

function Installments({ statement }: { statement: FamilyStatement }) {
  if (statement.installments.length === 0) {
    return <p className="text-base text-muted-foreground">No due dates set yet.</p>;
  }
  return (
    <ul className="flex flex-col divide-y rounded-xl border bg-card">
      {statement.installments.map((it) => {
        const showOutstanding = it.status !== 'paid' && hasAmount(it.outstanding);
        const amounts = moneyLines(showOutstanding ? it.outstanding : it.amount, statement.currency);
        return (
          <li key={it.key} className="flex min-h-11 flex-wrap items-center justify-between gap-x-4 gap-y-2 p-4">
            <div className="min-w-0">
              <p className="text-base font-semibold text-foreground">By {formatDay(it.due_date)}</p>
              <p className="text-sm text-muted-foreground">{it.label}</p>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              {amounts.length > 0 ? (
                <span className="text-right text-base font-semibold tabular-nums text-foreground">
                  {amounts.map((a) => a.text).join(' / ')}
                  {showOutstanding ? <span className="block text-xs font-normal text-muted-foreground">left to pay</span> : null}
                </span>
              ) : null}
              <InstallmentBadge status={it.status} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function Payments({ statement, receiptHref }: { statement: FamilyStatement; receiptHref: (id: string) => string }) {
  if (statement.payments.length === 0) {
    return <p className="text-base text-muted-foreground">No payments yet this school year.</p>;
  }
  return (
    <ul className="flex flex-col divide-y rounded-xl border bg-card">
      {statement.payments.map((p) => (
        <li key={p.id || p.receipt_number}>
          <Link
            href={receiptHref(p.id)}
            className="flex min-h-11 items-center gap-3 p-4 outline-none transition-colors hover:bg-accent/50 focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-ring/50"
          >
            <ReceiptIcon className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className={cn('text-base font-semibold tabular-nums text-foreground', p.voided && 'line-through')}>
                {formatMoney(p.amount, p.currency)}
              </p>
              <p className="text-sm text-muted-foreground">
                {formatDay(p.received_at)} · {methodLabel(p.method)} · No. {p.receipt_number || '—'}
              </p>
            </div>
            {p.voided ? <VoidBadge /> : null}
            <span className="inline-flex shrink-0 items-center text-sm font-medium text-primary">
              Receipt <ChevronRight className="size-4" aria-hidden="true" />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function FeesBody({ childId, yearId, receiptHref }: { childId: string; yearId: string; receiptHref: (id: string) => string }) {
  const statement = useFamilyStatement(childId, yearId);
  const reportCard = useStudentReportCard(childId, yearId);
  const held = statement.data?.report_cards_held === true || (reportCard.isError && isReportCardHeld(reportCard.error));

  if (statement.isLoading) {
    return (
      <div className="flex flex-col gap-3" aria-busy="true" aria-label="Loading fees">
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-40 rounded-xl" />
      </div>
    );
  }
  if (statement.isError) {
    const status = statusOf(statement.error);
    if (status === 404) {
      return (
        <EmptyState icon={Wallet} title="No fees yet" description="Fees for this school year appear here once the school sends the bill." />
      );
    }
    if (status === 403) {
      return (
        <EmptyState icon={Wallet} title="Can't show these fees" description="Your account can't see these fees. Please ask the school office." />
      );
    }
    return <RetryState what="Fees" onRetry={() => void statement.refetch()} />;
  }
  const data = statement.data;
  if (!data) return null;

  return (
    <>
      {held ? <HeldNote /> : null}
      <BalanceCard statement={data} />
      <Section title="Due dates">
        <Installments statement={data} />
      </Section>
      <Section title="Payments">
        <Payments statement={data} receiptHref={receiptHref} />
      </Section>
    </>
  );
}

function ParentFeesScreen() {
  const { tenantDomain } = useParams<{ tenantDomain: string }>();
  const { query, kids, childId, child, setChildId } = useSelectedChild();
  const { years, yearId, setYearId, isLoading: yearsLoading, isError: yearsError, refetch: refetchYears } =
    useResultYears();

  const receiptHref = React.useCallback(
    (id: string) =>
      `/${tenantDomain}/parent/fees/receipts/${encodeURIComponent(id)}?child=${encodeURIComponent(childId)}`,
    [tenantDomain, childId]
  );

  let content: React.ReactNode;
  if (query.isLoading || yearsLoading) content = <ParentSkeleton label="Loading fees" />;
  else if (query.isError) content = <RetryState what="Your children" onRetry={() => void query.refetch()} />;
  else if (kids.length === 0) content = <NoChildrenState />;
  else if (yearsError) content = <RetryState what="School years" onRetry={refetchYears} />;
  else if (!yearId) {
    content = <EmptyState icon={CalendarX} title="No school year yet" description="The school has not set up a school year yet." />;
  } else {
    content = (
      <>
        <ChildSwitcher items={kids} value={childId} onChange={setChildId} />
        <YearSelect years={years} value={yearId} onChange={setYearId} />
        <FeesBody key={`${childId}-${yearId}`} childId={childId} yearId={yearId} receiptHref={receiptHref} />
      </>
    );
  }

  return (
    <PageShell title="Fees" description={childLine(child) ?? 'What is paid and what is still due.'}>
      {content}
    </PageShell>
  );
}

export default function ParentFeesPage() {
  return (
    <React.Suspense fallback={<ParentSkeleton label="Loading fees" />}>
      <ParentFeesScreen />
    </React.Suspense>
  );
}
