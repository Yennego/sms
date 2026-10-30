'use client';

// Payments (/{school}/finance/payments): every receipt, newest first, a page at a time.
// Filters (dates, method, who received it, search) live in the URL. Void with a reason; when the
// server refuses (another cashier's payment, or not the same day) its message is shown.
import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ColumnDef } from '@tanstack/react-table';
import { Ban, Banknote, Plus, Receipt as ReceiptIcon, Search } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { DropdownMenu } from '@/components/ui/dropdown-menu';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { PageShell } from '@/components/ui/page-shell';
import { Pagination } from '@/components/ui/pagination';
import { StatusBadge } from '@/components/ui/status-badge';
import { LabeledSelect, PAGE_SIZES, SearchBox } from '@/components/class-placement/roster-controls';
import { positiveInt, useDebouncedSearch, useUrlState } from '@/components/class-placement/use-url-state';
import { PAYMENT_METHODS, type Payment, type PaymentMethod, type PaymentParams } from '@/services/api/fees-service';
import { formatDateTime, formatMoney, formatPair, METHOD_LABELS, methodLabel } from './money';
import { useFeesPermissions, usePaymentReceivers, usePayments } from './queries';
import { RecordPaymentSheet } from './record-payment-sheet';
import { LoadError } from './shared';
import { VoidPaymentDialog } from './void-payment-dialog';

const URL_DEFAULTS = { from: '', to: '', method: '', by: '', q: '', page: '1', size: '25' };

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

export function PaymentsScreen({ school }: { school: string }) {
  const router = useRouter();
  const perms = useFeesPermissions();
  const [url, setUrl] = useUrlState(URL_DEFAULTS);
  const pageSize = positiveInt(url.size, 25, PAGE_SIZES);
  const page = positiveInt(url.page, 1);
  const method = (PAYMENT_METHODS as readonly string[]).includes(url.method) ? (url.method as PaymentMethod) : '';

  const commitSearch = React.useCallback((q: string) => setUrl({ q, page: null }), [setUrl]);
  const [searchText, setSearchText] = useDebouncedSearch(url.q, commitSearch);

  const params = React.useMemo<PaymentParams>(
    () => ({
      from: url.from || undefined,
      to: url.to || undefined,
      method,
      receivedBy: url.by || undefined,
      q: url.q || undefined,
      page,
      pageSize,
    }),
    [url.from, url.to, method, url.by, url.q, page, pageSize]
  );
  const receivers = usePaymentReceivers(url.from || undefined, url.to || undefined).data ?? [];

  const q = usePayments(params);
  const data = q.data;
  const items = React.useMemo(() => data?.items ?? [], [data]);
  const [voiding, setVoiding] = React.useState<Payment | null>(null);
  const [recording, setRecording] = React.useState(false);

  const columns = React.useMemo<ColumnDef<Payment>[]>(
    () => [
      {
        id: 'receipt',
        enableSorting: false,
        header: 'Receipt no.',
        cell: ({ row }) => (
          <span className="inline-flex flex-wrap items-center gap-2">
            <Link
              href={`/${school}/finance/payments/${row.original.id}`}
              onClick={(e) => e.stopPropagation()}
              className="font-mono font-medium text-primary underline-offset-4 hover:underline"
            >
              {row.original.receipt_number}
            </Link>
            {row.original.voided_at ? <StatusBadge status="neutral" label="Void" /> : null}
          </span>
        ),
      },
      {
        id: 'date',
        enableSorting: false,
        header: 'Date',
        cell: ({ row }) => <span className="whitespace-nowrap">{formatDateTime(row.original.received_at)}</span>,
      },
      {
        id: 'student',
        enableSorting: false,
        header: 'Student',
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="font-medium text-foreground">{row.original.student_name ?? '—'}</p>
            {row.original.class_name ? <p className="text-xs text-muted-foreground">{row.original.class_name}</p> : null}
          </div>
        ),
      },
      {
        id: 'amount',
        enableSorting: false,
        header: 'Amount',
        cell: ({ row }) => (
          <span className={cn('whitespace-nowrap tabular-nums', row.original.voided_at ? 'text-muted-foreground line-through' : 'font-medium')}>
            {formatMoney(row.original.amount, row.original.currency)}
          </span>
        ),
        meta: { className: 'text-right' },
      },
      {
        id: 'method',
        enableSorting: false,
        header: 'Method',
        cell: ({ row }) => (
          <div>
            {methodLabel(row.original.method)}
            {row.original.reference ? <p className="text-xs break-all text-muted-foreground">{row.original.reference}</p> : null}
          </div>
        ),
      },
      {
        id: 'by',
        enableSorting: false,
        header: 'Received by',
        cell: ({ row }) => row.original.received_by_name || '—',
        meta: { hideOnMobile: true },
      },
      {
        id: 'actions',
        enableSorting: false,
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => (
          <div onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()} className="flex justify-end">
            <DropdownMenu
              label={`Actions for receipt ${row.original.receipt_number}`}
              items={[
                { label: 'Open receipt', icon: ReceiptIcon, href: `/${school}/finance/payments/${row.original.id}` },
                ...(row.original.can_void
                  ? [{ label: 'Void payment', icon: Ban, destructive: true, onSelect: () => setVoiding(row.original) }]
                  : []),
              ]}
            />
          </div>
        ),
        meta: { label: 'Actions', className: 'text-right' },
      },
    ],
    [school]
  );

  const filtered = Boolean(url.from || url.to || method || url.by || url.q);
  const clearFilters = () => {
    setSearchText('');
    setUrl({ from: null, to: null, method: null, by: null, q: null, page: null });
  };

  return (
    <PageShell
      title="Payments"
      description="Every receipt issued. Voided receipts stay on the list, marked Void."
      primaryAction={
        perms.record ? (
          <Button onClick={() => setRecording(true)}>
            <Plus aria-hidden="true" />
            Record payment
          </Button>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-center">
        <SearchBox value={searchText} onChange={setSearchText} placeholder="Search by receipt no. or student" />
        <DateFilter label="From" value={url.from} onChange={(v) => setUrl({ from: v, page: null })} />
        <DateFilter label="To" value={url.to} onChange={(v) => setUrl({ to: v, page: null })} />
        <LabeledSelect label="Method" value={method} onChange={(v) => setUrl({ method: v, page: null })}>
          <option value="">All methods</option>
          {PAYMENT_METHODS.map((m) => (
            <option key={m} value={m}>
              {METHOD_LABELS[m]}
            </option>
          ))}
        </LabeledSelect>
        <LabeledSelect label="Received by" value={url.by} onChange={(v) => setUrl({ by: v, page: null })}>
          <option value="">Received by anyone</option>
          {receivers.map((r) => (
            <option key={r.user_id} value={r.user_id}>
              {r.name || 'Unnamed user'}
            </option>
          ))}
          {url.by && !receivers.some((r) => r.user_id === url.by) ? (
            <option value={url.by}>Chosen person (no payments in these dates)</option>
          ) : null}
        </LabeledSelect>
        {filtered ? (
          <Button variant="ghost" className="min-h-11 md:min-h-9" onClick={clearFilters}>
            Clear filters
          </Button>
        ) : null}
      </div>

      {q.isError ? (
        <LoadError error={q.error} what="payments" onRetry={() => q.refetch()} />
      ) : (
        <div className={cn('flex flex-col gap-4 transition-opacity', q.isPlaceholderData && 'opacity-60')} aria-busy={q.isFetching || undefined}>
          {data && data.total > 0 ? (
            <p className="text-sm text-muted-foreground">
              Total of these payments, voided ones left out:{' '}
              <span className="font-medium text-foreground tabular-nums">{formatPair(data.totals)}</span>
            </p>
          ) : null}
          <DataTable
            label="Payments"
            columns={columns}
            data={items}
            loading={q.isLoading}
            loadingRows={Math.min(pageSize, 10)}
            pageSize={0}
            getRowId={(p) => p.id}
            onRowClick={(p) => router.push(`/${school}/finance/payments/${p.id}`)}
            emptyState={
              filtered ? (
                <EmptyState
                  icon={Search}
                  title="No matches"
                  description="No payment matches these filters. Try other dates or clear the filters."
                  action={
                    <Button variant="outline" onClick={clearFilters}>
                      Clear filters
                    </Button>
                  }
                />
              ) : (
                <EmptyState icon={Banknote} title="No payments yet" description="Payments appear here as soon as they are recorded." />
              )
            }
          />
          {data && data.total > 0 ? (
            <Pagination
              label="Payment pages"
              itemLabel="payments"
              page={page}
              pageSize={pageSize}
              total={data.total}
              onPageChange={(p) => setUrl({ page: p })}
              onPageSizeChange={(size) => setUrl({ size, page: null })}
              pageSizeOptions={PAGE_SIZES}
            />
          ) : null}
        </div>
      )}

      <VoidPaymentDialog payment={voiding} onOpenChange={(open) => !open && setVoiding(null)} />
      {perms.record ? <RecordPaymentSheet school={school} open={recording} onOpenChange={setRecording} /> : null}
    </PageShell>
  );
}
