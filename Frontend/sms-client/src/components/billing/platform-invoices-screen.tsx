'use client';

// Platform → Billing → Invoices (/platform/billing/invoices): every school's invoices, newest
// first, a page at a time. Status and issue dates live in the URL (nuqs).
import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ColumnDef } from '@tanstack/react-table';
import { parseAsInteger, parseAsString, parseAsStringLiteral, useQueryStates } from 'nuqs';
import { FileText } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { PageShell } from '@/components/ui/page-shell';
import { Pagination } from '@/components/ui/pagination';
import { formatDate } from '@/components/students/format';
import { Amounts, LoadError } from '@/components/fees/shared';
import { LabeledSelect, PAGE_SIZES } from '@/components/class-placement/roster-controls';
import type { InvoiceStatusFilter, PlatformInvoice } from '@/services/api/billing-service';
import { useAllInvoices } from './queries';
import { InvoiceStatusBadge } from './shared';

const STATUSES = ['all', 'owing', 'paid', 'issued', 'void'] as const satisfies readonly InvoiceStatusFilter[];

const STATUS_OPTIONS: Record<InvoiceStatusFilter, string> = {
  all: 'All invoices',
  owing: 'Owing',
  paid: 'Paid',
  issued: 'Not void',
  void: 'Void',
};

const urlState = {
  status: parseAsStringLiteral(STATUSES).withDefault('all'),
  from: parseAsString.withDefault(''),
  to: parseAsString.withDefault(''),
  page: parseAsInteger.withDefault(1),
  size: parseAsInteger.withDefault(25),
};

function DateFilter({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const id = React.useId();
  return (
    <div className="flex w-full items-center gap-2 sm:w-auto">
      <label htmlFor={id} className="shrink-0 text-sm text-muted-foreground">
        {label}
      </label>
      <Input id={id} type="date" value={value} onChange={(e) => onChange(e.target.value)} className="h-11 w-full sm:w-40 md:h-9" />
    </div>
  );
}

export function PlatformInvoicesScreen() {
  const router = useRouter();
  const [url, setUrl] = useQueryStates(urlState);
  const pageSize = (PAGE_SIZES as readonly number[]).includes(url.size) ? url.size : 25;
  const page = Math.max(1, url.page);

  const q = useAllInvoices({ status: url.status, from: url.from || undefined, to: url.to || undefined, page, pageSize });
  const items = React.useMemo(() => q.data?.items ?? [], [q.data]);
  const total = q.data?.total ?? 0;
  const filtered = url.status !== 'all' || Boolean(url.from || url.to);

  const pages = Math.max(1, Math.ceil(total / pageSize));
  React.useEffect(() => {
    if (q.data && page > pages) setUrl({ page: pages });
  }, [q.data, page, pages, setUrl]);

  const columns = React.useMemo<ColumnDef<PlatformInvoice>[]>(
    () => [
      {
        id: 'number',
        enableSorting: false,
        header: 'Invoice',
        cell: ({ row }) => (
          <span className="inline-flex flex-wrap items-center gap-2">
            <Link
              href={`/platform/billing/invoices/${row.original.id}`}
              onClick={(e) => e.stopPropagation()}
              className="font-mono font-medium text-primary underline-offset-4 hover:underline"
            >
              {row.original.number}
            </Link>
            <InvoiceStatusBadge invoice={row.original} />
          </span>
        ),
      },
      {
        id: 'school',
        enableSorting: false,
        header: 'School',
        cell: ({ row }) => (
          <div className="min-w-0">
            <Link
              href={`/platform/billing/schools/${row.original.tenant_id}`}
              onClick={(e) => e.stopPropagation()}
              className="font-medium underline-offset-4 hover:underline"
            >
              {row.original.school_name ?? 'School'}
            </Link>
            {row.original.semester_name ? <p className="text-xs text-muted-foreground">{row.original.semester_name}</p> : null}
          </div>
        ),
      },
      {
        id: 'issued',
        enableSorting: false,
        header: 'Issued',
        cell: ({ row }) => <span className="whitespace-nowrap">{formatDate(row.original.issued_at)}</span>,
        meta: { hideOnMobile: true },
      },
      {
        id: 'due',
        enableSorting: false,
        header: 'Due',
        cell: ({ row }) => <span className="whitespace-nowrap">{formatDate(row.original.due_date)}</span>,
      },
      {
        id: 'total',
        enableSorting: false,
        header: 'Total',
        cell: ({ row }) => <Amounts value={row.original.total} locked={row.original.currency} />,
        meta: { className: 'text-right', hideOnMobile: true },
      },
      {
        id: 'balance',
        enableSorting: false,
        header: 'Balance',
        cell: ({ row }) =>
          row.original.status === 'void' ? '—' : <Amounts value={row.original.balance} locked={row.original.currency} strong />,
        meta: { className: 'text-right' },
      },
    ],
    []
  );

  return (
    <PageShell title="Invoices" description="Every school's platform invoices, newest first.">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <LabeledSelect
          label="Status"
          value={url.status}
          onChange={(v) => setUrl({ status: v === 'all' ? null : (v as InvoiceStatusFilter), page: null })}
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_OPTIONS[s]}
            </option>
          ))}
        </LabeledSelect>
        <DateFilter label="Issued from" value={url.from} onChange={(v) => setUrl({ from: v || null, page: null })} />
        <DateFilter label="to" value={url.to} onChange={(v) => setUrl({ to: v || null, page: null })} />
      </div>

      {q.isError ? (
        <LoadError error={q.error} what="the invoices" onRetry={() => q.refetch()} />
      ) : (
        <div className={cn('transition-opacity', q.isPlaceholderData && 'opacity-60')} aria-busy={q.isFetching || undefined}>
          <DataTable
            columns={columns}
            data={items}
            label="Platform invoices"
            loading={q.isLoading}
            pageSize={0}
            getRowId={(r) => r.id}
            onRowClick={(r) => router.push(`/platform/billing/schools/${r.tenant_id}`)}
            emptyState={
              <EmptyState
                icon={FileText}
                title={filtered ? 'No invoices match' : 'No invoices yet'}
                description={
                  filtered ? 'Try another status or other dates.' : 'Invoices are issued at the start of each term.'
                }
                action={
                  filtered ? (
                    <Button variant="outline" onClick={() => setUrl({ status: null, from: null, to: null, page: null })}>
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
          itemLabel="invoices"
          disabled={q.isFetching && q.isPlaceholderData}
        />
      ) : null}
    </PageShell>
  );
}
