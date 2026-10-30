'use client';

// Fees overview (/{school}/finance): today's collections per currency, what is owed and overdue
// this year, today's payments, and "Record payment".
import * as React from 'react';
import Link from 'next/link';
import { AlertTriangle, Banknote, Plus, Wallet } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { PageShell } from '@/components/ui/page-shell';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/ui/status-badge';
import { useCurrentAcademicYearDetail } from '@/hooks/queries/academic-years';
import { formatMoney, formatDateTime, methodLabel } from './money';
import { useAccounts, useCollections, useFeesPermissions, usePayments, useSchoolToday } from './queries';
import { RecordPaymentSheet } from './record-payment-sheet';
import { Amounts, LoadError, StatTile } from './shared';

function count(n: number | undefined, one: string, many: string) {
  if (n === undefined) return null;
  return `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`;
}

export function OverviewScreen({ school }: { school: string }) {
  const perms = useFeesPermissions();
  const year = useCurrentAcademicYearDetail().data;
  // "Today" is the school's day, not the phone's.
  const { today, ready } = useSchoolToday();
  const collections = useCollections(today, today, ready);
  const owing = useAccounts({ academicYearId: year?.id, status: 'owing', page: 1, pageSize: 1 }, Boolean(year?.id));
  const overdue = useAccounts({ academicYearId: year?.id, status: 'overdue', page: 1, pageSize: 1 }, Boolean(year?.id));
  const todays = usePayments({ from: today, to: today, page: 1, pageSize: 10 }, ready);
  const [recording, setRecording] = React.useState(false);

  // Both summaries failing usually means no permission or no connection: say so once.
  if (collections.isError && owing.isError) {
    return (
      <PageShell title="Fees">
        <LoadError
          error={collections.error}
          what="fees"
          onRetry={() => {
            void collections.refetch();
            void owing.refetch();
          }}
        />
      </PageShell>
    );
  }

  const payments = todays.data?.items ?? [];

  return (
    <PageShell
      title="Fees"
      description={year ? `School year ${year.name}. Money is shown per currency; USD and LRD are never added together.` : undefined}
      primaryAction={
        perms.record ? (
          <Button onClick={() => setRecording(true)}>
            <Plus aria-hidden="true" />
            Record payment
          </Button>
        ) : undefined
      }
    >
      <div className="grid gap-3 md:grid-cols-3">
        <StatTile
          label="Collected today"
          icon={Banknote}
          footer={count(collections.data?.count, 'payment', 'payments')}
        >
          {collections.isLoading || !ready ? <Skeleton className="h-8 w-32" /> : <Amounts value={collections.data?.totals} />}
        </StatTile>
        <StatTile
          label="Still owed this year"
          icon={Wallet}
          tone="warning"
          footer={
            owing.data ? (
              <Link href={`/${school}/finance/fees`} className="underline-offset-4 hover:underline">
                {count(owing.data.total, 'student owes', 'students owe')}
              </Link>
            ) : null
          }
        >
          {owing.isLoading || !year ? <Skeleton className="h-8 w-32" /> : <Amounts value={owing.data?.totals?.balance} />}
        </StatTile>
        <StatTile
          label="Overdue"
          icon={AlertTriangle}
          tone="danger"
          footer={
            overdue.data ? (
              <Link href={`/${school}/finance/fees?tab=overdue`} className="underline-offset-4 hover:underline">
                {count(overdue.data.total, 'student overdue', 'students overdue')}
              </Link>
            ) : null
          }
        >
          {overdue.isLoading || !year ? <Skeleton className="h-8 w-32" /> : <Amounts value={overdue.data?.totals?.overdue} />}
        </StatTile>
      </div>

      <section className="grid gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-foreground">Today&apos;s payments</h2>
          <Button asChild variant="link" className="min-h-11 px-0 md:min-h-0">
            <Link href={`/${school}/finance/payments`}>See all payments</Link>
          </Button>
        </div>
        {todays.isLoading || !ready ? (
          <Skeleton className="h-32" />
        ) : todays.isError ? (
          <LoadError error={todays.error} what="today's payments" onRetry={() => todays.refetch()} />
        ) : payments.length === 0 ? (
          <EmptyState
            icon={Banknote}
            description="No payments recorded today yet."
            action={
              perms.record ? (
                <Button onClick={() => setRecording(true)}>
                  <Plus aria-hidden="true" />
                  Record payment
                </Button>
              ) : undefined
            }
          />
        ) : (
          <ul className="divide-y rounded-xl border">
            {payments.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/${school}/finance/payments/${p.id}`}
                  className="flex min-h-11 flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3 outline-none hover:bg-muted/50 focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  <span className="min-w-0">
                    <span className="block font-medium text-foreground">{p.student_name ?? 'Student'}</span>
                    <span className="block text-sm text-muted-foreground">
                      {[p.receipt_number, methodLabel(p.method), formatDateTime(p.received_at)].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    {p.voided_at ? <StatusBadge status="neutral" label="Void" /> : null}
                    <span className={p.voided_at ? 'tabular-nums line-through text-muted-foreground' : 'font-semibold tabular-nums'}>
                      {formatMoney(p.amount, p.currency)}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {perms.record ? (
        <RecordPaymentSheet school={school} open={recording} onOpenChange={setRecording} yearId={year?.id} />
      ) : null}
    </PageShell>
  );
}
