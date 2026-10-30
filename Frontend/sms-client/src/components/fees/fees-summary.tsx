'use client';

// The student profile's Fees tab: a read-only summary of the statement (balance, overdue, next
// installment, latest payments) with a link to the full statement in the Fees area.
import * as React from 'react';
import Link from 'next/link';
import { Receipt } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/ui/status-badge';
import { formatDate } from '@/components/students/format';
import { formatDateTime, formatMoney, formatPair, anyPositive, errorStatus } from './money';
import { useStatement } from './queries';
import { Amounts, LoadError, StatTile } from './shared';

export function FeesSummary({ school, studentId, yearId }: { school: string; studentId: string; yearId?: string }) {
  const q = useStatement(studentId, yearId);
  const statement = q.data;
  const fullHref = `/${school}/finance/accounts/${studentId}${yearId ? `?year=${yearId}` : ''}`;

  if (q.isError) {
    if (errorStatus(q.error) === 404) {
      return (
        <EmptyState
          icon={Receipt}
          title="No bill this school year"
          description="This student has no fee account for this year yet. Bills appear once invoices are issued for their class."
        />
      );
    }
    return <LoadError error={q.error} what="this student's fees" onRetry={() => q.refetch()} />;
  }
  if (!statement) {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
    );
  }

  const locked = statement.account.currency;
  const next = (statement.installments ?? [])
    .filter((i) => i.status !== 'paid')
    .sort((a, b) => a.due_date.localeCompare(b.due_date))[0];
  // The statement lists payments oldest first.
  const payments = [...(statement.payments ?? [])].reverse().slice(0, 3);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <StatTile label="Balance" tone={anyPositive(statement.balance) ? 'warning' : 'default'}>
          <Amounts value={statement.balance} locked={locked} />
        </StatTile>
        <StatTile label="Overdue" tone={anyPositive(statement.overdue) ? 'danger' : 'default'}>
          <Amounts value={statement.overdue} locked={locked} />
        </StatTile>
      </div>
      <p className="text-sm text-muted-foreground">
        {locked
          ? `This student pays in ${locked} this year.`
          : 'No payment yet this year, so amounts are shown in both currencies.'}
        {next
          ? ` ${next.status === 'overdue' ? 'Overdue: was due' : 'Next installment:'} ${formatDate(next.due_date)} (${formatPair(next.outstanding, locked)} left to pay).`
          : ''}
      </p>

      <section className="grid gap-2">
        <h3 className="text-sm font-semibold text-foreground">Latest payments</h3>
        {payments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No payments yet this year.</p>
        ) : (
          <ul className="divide-y rounded-xl border">
            {payments.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/${school}/finance/payments/${p.id}`}
                  className="flex min-h-11 flex-wrap items-center justify-between gap-2 px-4 py-2 hover:bg-muted/50"
                >
                  <span className="text-sm">
                    <span className="font-mono font-medium">{p.receipt_number}</span>
                    <span className="text-muted-foreground"> · {formatDateTime(p.received_at)}</span>
                  </span>
                  <span className="flex items-center gap-2">
                    {p.voided_at ? <StatusBadge status="neutral" label="Void" /> : null}
                    <span className={p.voided_at ? 'tabular-nums line-through text-muted-foreground' : 'font-medium tabular-nums'}>
                      {formatMoney(p.amount, p.currency)}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div>
        <Button asChild variant="outline" className="min-h-11 md:min-h-9">
          <Link href={fullHref}>Open full statement</Link>
        </Button>
      </div>
    </div>
  );
}
