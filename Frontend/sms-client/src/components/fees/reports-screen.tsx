'use client';

// Fee reports (/{school}/finance/reports): collections for a date range (by day, method and
// receiver, each currency in its own column, never added together) and arrears by class.
import * as React from 'react';
import Link from 'next/link';
import { CheckCircle2, Printer } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { PageShell } from '@/components/ui/page-shell';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDate } from '@/components/students/format';
import { className as classLabel, useYearClasses } from '@/components/class-placement/queries';
import { LabeledSelect } from '@/components/class-placement/roster-controls';
import { useUrlState } from '@/components/class-placement/use-url-state';
import { YearSelect, useResultYears } from '@/components/results/year-select';
import { CURRENCIES, type CollectionRow, type PerCurrency } from '@/services/api/fees-service';
import { formatAmount, methodLabel } from './money';
import { useArrears, useCollections, useSchoolToday } from './queries';
import { Amounts, LoadError, SegmentTabs, StatTile } from './shared';

type View = 'collections' | 'arrears';

const th = 'px-3 py-2 text-left font-medium whitespace-nowrap text-muted-foreground';
const td = 'px-3 py-2';

function MoneyCells({ value }: { value: PerCurrency | undefined }) {
  return (
    <>
      {CURRENCIES.map((c) => (
        <td key={c} className={cn(td, 'text-right tabular-nums')}>
          {value?.[c] ? formatAmount(value[c]) : '—'}
        </td>
      ))}
    </>
  );
}

function CollectionTable({
  title,
  first,
  rows,
  label,
}: {
  title: string;
  first: string;
  rows: CollectionRow[];
  label: (r: CollectionRow) => React.ReactNode;
}) {
  return (
    <section className="grid gap-2 print:break-inside-avoid">
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No payments in this period.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr className="border-b">
                <th className={th}>{first}</th>
                <th className={cn(th, 'text-right')}>Payments</th>
                {CURRENCIES.map((c) => (
                  <th key={c} className={cn(th, 'text-right')}>
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-b last:border-0">
                  <td className={td}>{label(r)}</td>
                  <td className={cn(td, 'text-right tabular-nums')}>{r.count ?? '—'}</td>
                  <MoneyCells value={r.totals} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Collections({ from, to, onChange }: { from: string; to: string; onChange: (p: { from?: string; to?: string }) => void }) {
  const q = useCollections(from, to);
  const data = q.data;
  const ids = { from: React.useId(), to: React.useId() };
  const invalid = from > to;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end print:hidden">
        <div className="grid gap-1">
          <label htmlFor={ids.from} className="text-sm font-medium">
            From
          </label>
          <Input id={ids.from} type="date" value={from} max={to} onChange={(e) => onChange({ from: e.target.value })} className="h-11 sm:w-44 md:h-9" />
        </div>
        <div className="grid gap-1">
          <label htmlFor={ids.to} className="text-sm font-medium">
            To
          </label>
          <Input id={ids.to} type="date" value={to} min={from} onChange={(e) => onChange({ to: e.target.value })} className="h-11 sm:w-44 md:h-9" />
        </div>
      </div>
      {invalid ? (
        <p role="alert" className="text-sm text-destructive">
          The start date is after the end date. Choose a start date on or before {formatDate(to)}.
        </p>
      ) : q.isError ? (
        <LoadError error={q.error} what="collections" onRetry={() => q.refetch()} />
      ) : !data ? (
        <Skeleton className="h-48" />
      ) : (
        <div className={cn('flex flex-col gap-6', q.isPlaceholderData && 'opacity-60')}>
          <div className="grid gap-3 sm:grid-cols-2">
            <StatTile
              label={`Collected ${formatDate(from)} to ${formatDate(to)}`}
              footer={`${data.count.toLocaleString('en-US')} ${data.count === 1 ? 'payment' : 'payments'}. Voided receipts are not counted.`}
            >
              <Amounts value={data.totals} />
            </StatTile>
            {data.voided.count > 0 ? (
              <StatTile
                label="Voided in this period"
                footer={`${data.voided.count.toLocaleString('en-US')} ${data.voided.count === 1 ? 'receipt' : 'receipts'}, left out of every total.`}
              >
                <Amounts value={data.voided.totals} />
              </StatTile>
            ) : null}
          </div>
          <CollectionTable title="By day" first="Day" rows={data.by_day ?? []} label={(r) => formatDate(r.date)} />
          <CollectionTable title="By method" first="Method" rows={data.by_method ?? []} label={(r) => methodLabel(r.method)} />
          <CollectionTable title="By receiver" first="Received by" rows={data.by_receiver ?? []} label={(r) => r.received_by_name || 'Unknown'} />
        </div>
      )}
    </div>
  );
}

function Arrears({ school, classId, onClass }: { school: string; classId: string; onClass: (id: string) => void }) {
  const years = useResultYears();
  const classes = useYearClasses(years.yearId).data ?? [];
  const q = useArrears(years.yearId, classId);
  const data = q.data;
  // The server lists every class with fee accounts; arrears are the ones with something overdue.
  const rows = (data?.classes ?? []).filter((r) => r.students_overdue > 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end print:hidden">
        <YearSelect years={years.years} value={years.yearId} onChange={years.setYearId} />
        <LabeledSelect label="Class" value={classId} onChange={onClass}>
          <option value="">All classes</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {classLabel(c)}
            </option>
          ))}
        </LabeledSelect>
      </div>
      {q.isError ? (
        <LoadError error={q.error} what="arrears" onRetry={() => q.refetch()} />
      ) : !data ? (
        <Skeleton className="h-48" />
      ) : rows.length === 0 ? (
        <EmptyState icon={CheckCircle2} title="No arrears" description="No student has an overdue installment this school year." />
      ) : (
        <div className={cn('overflow-x-auto rounded-xl border', q.isPlaceholderData && 'opacity-60')}>
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr className="border-b">
                <th className={th}>Class</th>
                <th className={cn(th, 'text-right')}>Students overdue</th>
                {CURRENCIES.map((c) => (
                  <th key={c} className={cn(th, 'text-right')}>
                    Overdue ({c})
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.class_id ?? 'none'} className="border-b last:border-0">
                  <td className={td}>
                    {r.class_id ? (
                      <Link
                        href={`/${school}/finance/fees?tab=overdue&class=${r.class_id}${years.yearId ? `&year=${years.yearId}` : ''}`}
                        className="font-medium text-primary underline-offset-4 hover:underline"
                      >
                        {r.class_name || 'Unnamed class'}
                      </Link>
                    ) : (
                      r.class_name || 'No class'
                    )}
                  </td>
                  <td className={cn(td, 'text-right tabular-nums')}>{r.students_overdue}</td>
                  <MoneyCells value={r.overdue} />
                </tr>
              ))}
            </tbody>
            {data.totals ? (
              <tfoot>
                <tr className="border-t font-semibold">
                  <td className={td}>All classes</td>
                  <td className={cn(td, 'text-right tabular-nums')}>{data.totals.students_overdue ?? '—'}</td>
                  <MoneyCells value={data.totals.overdue} />
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
      )}
    </div>
  );
}

export function ReportsScreen({ school }: { school: string }) {
  const [url, setUrl] = useUrlState({ view: 'collections', from: '', to: '', class: '' });
  const view: View = url.view === 'arrears' ? 'arrears' : 'collections';
  // Default range: the school's current month so far.
  const { today, ready } = useSchoolToday();
  const from = url.from || `${today.slice(0, 8)}01`;
  const to = url.to || today;
  const panelId = React.useId();

  return (
    <PageShell
      title="Fee reports"
      description="Money collected and money overdue. USD and LRD are shown separately."
      secondaryActions={
        <Button variant="outline" onClick={() => window.print()}>
          <Printer aria-hidden="true" />
          Print report
        </Button>
      }
    >
      <SegmentTabs
        label="Report"
        tabs={[
          { value: 'collections' as View, label: 'Collections' },
          { value: 'arrears' as View, label: 'Arrears by class' },
        ]}
        value={view}
        onChange={(v) => setUrl({ view: v })}
        controls={panelId}
      />
      <div id={panelId} role="tabpanel">
        {view === 'collections' ? (
          ready ? (
            <Collections from={from} to={to} onChange={(p) => setUrl(p)} />
          ) : (
            <Skeleton className="h-48" />
          )
        ) : (
          <Arrears school={school} classId={url.class} onClass={(id) => setUrl({ class: id })} />
        )}
      </div>
    </PageShell>
  );
}
