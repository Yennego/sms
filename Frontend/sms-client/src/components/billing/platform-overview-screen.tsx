'use client';

// Platform → Billing (/platform/billing): billed, collected and outstanding per currency, the
// schools per status, and every school with its status and amount due, a page at a time. Search,
// the status filter and the page live in the URL (nuqs).
import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ColumnDef } from '@tanstack/react-table';
import { parseAsInteger, parseAsString, parseAsStringLiteral, useQueryStates } from 'nuqs';
import { Banknote, CircleDollarSign, Clock, School, Wallet } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';
import { PageShell } from '@/components/ui/page-shell';
import { Pagination } from '@/components/ui/pagination';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDate } from '@/components/students/format';
import { anyPositive, formatMoney } from '@/components/fees/money';
import { Amounts, LoadError, StatTile } from '@/components/fees/shared';
import { LabeledSelect, PAGE_SIZES, SearchBox } from '@/components/class-placement/roster-controls';
import { SUBSCRIPTION_STATUSES, type BillingSchool, type SubscriptionStatus } from '@/services/api/billing-service';
import { STATUS_LABELS } from './format';
import { useBillingSchools, useBillingSummary } from './queries';
import { BillingStatusBadge } from './shared';

const STATUS_FILTERS = ['', ...SUBSCRIPTION_STATUSES] as const;

const urlState = {
  q: parseAsString.withDefault(''),
  status: parseAsStringLiteral(STATUS_FILTERS).withDefault(''),
  page: parseAsInteger.withDefault(1),
  size: parseAsInteger.withDefault(25),
};

function Summary({ onStatus, current }: { onStatus: (s: SubscriptionStatus | '') => void; current: string }) {
  const q = useBillingSummary();
  const s = q.data;
  if (q.isError) return <LoadError error={q.error} what="the billing summary" onRetry={() => q.refetch()} />;
  if (!s) return <Skeleton className="h-32 w-full rounded-xl" />;

  const none = (v: Record<string, unknown> | undefined) => !v || Object.keys(v).length === 0;
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Billed" icon={Wallet} footer="Invoices whose currency is fixed">
          {none(s.billed) ? '—' : <Amounts value={s.billed} />}
        </StatTile>
        <StatTile label="Collected" icon={Banknote}>
          {none(s.collected) ? '—' : <Amounts value={s.collected} />}
        </StatTile>
        <StatTile label="Outstanding" icon={CircleDollarSign} tone={anyPositive(s.outstanding) ? 'warning' : 'default'}>
          {none(s.outstanding) ? '—' : <Amounts value={s.outstanding} />}
        </StatTile>
        <StatTile
          label="Not paid yet"
          icon={Clock}
          footer={`${s.not_yet_paid.invoices.toLocaleString('en-US')} invoice${s.not_yet_paid.invoices === 1 ? '' : 's'}, payable in either currency`}
        >
          {s.not_yet_paid.invoices === 0 ? (
            '—'
          ) : (
            <span className="flex flex-col text-base tabular-nums md:text-lg">
              <span>{formatMoney(s.not_yet_paid.USD, 'USD')}</span>
              <span className="text-sm font-normal text-muted-foreground">or {formatMoney(s.not_yet_paid.LRD, 'LRD')}</span>
            </span>
          )}
        </StatTile>
      </div>

      <div role="group" aria-label="Schools by status" className="flex flex-wrap gap-2">
        {SUBSCRIPTION_STATUSES.map((st) => (
          <button
            key={st}
            type="button"
            aria-pressed={current === st}
            onClick={() => onStatus(current === st ? '' : st)}
            className={cn(
              'inline-flex min-h-11 items-center gap-2 rounded-full border px-3 text-sm outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 md:min-h-9',
              current === st ? 'border-primary bg-primary/5 font-medium' : 'hover:bg-accent'
            )}
          >
            {STATUS_LABELS[st]}
            <span className="tabular-nums text-muted-foreground">{(s.schools[st] ?? 0).toLocaleString('en-US')}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function PlatformOverviewScreen() {
  const router = useRouter();
  const [url, setUrl] = useQueryStates(urlState);
  const pageSize = (PAGE_SIZES as readonly number[]).includes(url.size) ? url.size : 25;
  const page = Math.max(1, url.page);

  // Search waits until typing stops, then starts again from page 1
  const [searchText, setSearchText] = React.useState(url.q);
  React.useEffect(() => setSearchText(url.q), [url.q]);
  React.useEffect(() => {
    const value = searchText.trim();
    if (value === url.q) return;
    const timer = setTimeout(() => setUrl({ q: value || null, page: null }), 300);
    return () => clearTimeout(timer);
  }, [searchText, url.q, setUrl]);

  const q = useBillingSchools({ status: url.status, q: url.q, page, pageSize });
  const items = React.useMemo(() => q.data?.items ?? [], [q.data]);
  const total = q.data?.total ?? 0;
  const filtered = Boolean(url.q || url.status);

  // A page past the end (e.g. after the filter changed): go to the last page
  const pages = Math.max(1, Math.ceil(total / pageSize));
  React.useEffect(() => {
    if (q.data && page > pages) setUrl({ page: pages });
  }, [q.data, page, pages, setUrl]);

  const columns = React.useMemo<ColumnDef<BillingSchool>[]>(
    () => [
      {
        id: 'school',
        enableSorting: false,
        header: 'School',
        cell: ({ row }) => (
          <div className="min-w-0">
            <Link
              href={`/platform/billing/schools/${row.original.tenant_id}`}
              onClick={(e) => e.stopPropagation()}
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              {row.original.name}
            </Link>
            <p className="text-xs text-muted-foreground">
              {row.original.code}
              {row.original.is_active ? '' : ' · switched off'}
            </p>
          </div>
        ),
      },
      {
        id: 'status',
        enableSorting: false,
        header: 'Status',
        cell: ({ row }) => (
          <div className="flex flex-col gap-1">
            <BillingStatusBadge status={row.original.status} />
            {row.original.grace_until ? (
              <span className="text-xs text-muted-foreground">Grace until {formatDate(row.original.grace_until)}</span>
            ) : null}
          </div>
        ),
      },
      {
        id: 'due',
        enableSorting: false,
        header: 'Amount due',
        cell: ({ row }) =>
          anyPositive(row.original.amount_due) ? <Amounts value={row.original.amount_due} strong /> : '—',
        meta: { className: 'text-right' },
      },
      {
        id: 'oldest',
        enableSorting: false,
        header: 'Oldest due date',
        cell: ({ row }) => formatDate(row.original.oldest_due_date) || '—',
      },
      {
        id: 'staff',
        enableSorting: false,
        header: 'Staff',
        cell: ({ row }) => <span className="tabular-nums">{row.original.staff_count}</span>,
        meta: { className: 'text-right', hideOnMobile: true },
      },
      {
        id: 'family',
        enableSorting: false,
        header: 'Family months last term',
        cell: ({ row }) =>
          row.original.last_term_name ? (
            <span className="tabular-nums">
              {row.original.last_term_family_months}
              <span className="block text-xs text-muted-foreground">{row.original.last_term_name}</span>
            </span>
          ) : (
            '—'
          ),
        meta: { className: 'text-right', hideOnMobile: true },
      },
    ],
    []
  );

  return (
    <PageShell
      title="Billing"
      description="What schools owe the platform and what they have paid. Invoices are issued at the start of each term."
      secondaryActions={
        <Button asChild variant="outline">
          <Link href="/platform/billing/prices">Price list</Link>
        </Button>
      }
    >
      <Summary current={url.status} onStatus={(status) => setUrl({ status: status || null, page: null })} />

      <section className="flex flex-col gap-4" aria-labelledby="billing-schools">
        <h2 id="billing-schools" className="flex items-center gap-2 text-lg font-semibold">
          <School className="size-5" aria-hidden="true" />
          Schools
        </h2>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <SearchBox value={searchText} onChange={setSearchText} placeholder="Search by name, code or address" />
          <LabeledSelect
            label="Status"
            value={url.status}
            onChange={(v) => setUrl({ status: (v as SubscriptionStatus) || null, page: null })}
          >
            <option value="">All statuses</option>
            {SUBSCRIPTION_STATUSES.map((st) => (
              <option key={st} value={st}>
                {STATUS_LABELS[st]}
              </option>
            ))}
          </LabeledSelect>
        </div>

        {q.isError ? (
          <LoadError error={q.error} what="the schools" onRetry={() => q.refetch()} />
        ) : (
          <div className={cn('transition-opacity', q.isPlaceholderData && 'opacity-60')} aria-busy={q.isFetching || undefined}>
            <DataTable
              columns={columns}
              data={items}
              label="Schools and what they owe"
              loading={q.isLoading}
              pageSize={0}
              getRowId={(r) => r.tenant_id}
              onRowClick={(r) => router.push(`/platform/billing/schools/${r.tenant_id}`)}
              emptyState={
                <EmptyState
                  icon={School}
                  title={filtered ? 'No schools match' : 'No schools yet'}
                  description={filtered ? 'Try a different search or status.' : 'Schools appear here once they are added.'}
                  action={
                    filtered ? (
                      <Button
                        variant="outline"
                        onClick={() => {
                          setSearchText('');
                          setUrl({ q: null, status: null, page: null });
                        }}
                      >
                        Clear filters
                      </Button>
                    ) : undefined
                  }
                />
              }
            />
          </div>
        )}
        {total > 0 ? (
          <Pagination
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={(p) => setUrl({ page: p })}
            onPageSizeChange={(size) => setUrl({ size, page: null })}
            pageSizeOptions={PAGE_SIZES}
            itemLabel="schools"
            disabled={q.isFetching && q.isPlaceholderData}
          />
        ) : null}
      </section>
    </PageShell>
  );
}
