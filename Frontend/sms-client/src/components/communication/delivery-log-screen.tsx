'use client';

// Delivery log (/{school}/settings/deliveries, phase6-design.md section 6): every email (and SMS)
// copy of an alert, newest first, with its status. Admins with manage_tenant_settings can send a
// failed or skipped one again. Filters (status, channel, dates) and the page live in the URL; the
// counts follow the channel and dates, not the status. Render inside <Suspense>.
import * as React from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Loader2, MailCheck, RotateCcw, Search } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { PageShell } from '@/components/ui/page-shell';
import { Pagination } from '@/components/ui/pagination';
import { StatusBadge } from '@/components/ui/status-badge';
import { notify } from '@/components/ui/toaster';
import { LabeledSelect, PAGE_SIZES } from '@/components/class-placement/roster-controls';
import { positiveInt, useUrlState } from '@/components/class-placement/use-url-state';
import { LoadError, SegmentTabs } from '@/components/fees/shared';
import { errorMessage } from '@/components/students/format';
import {
  DELIVERY_CHANNELS,
  DELIVERY_STATUSES,
  type Delivery,
  type DeliveryChannel,
  type DeliveryParams,
  type DeliveryStatus,
} from '@/services/api/communication-service';

import { DELIVERY_STATUS_BADGES, eventLabel, formatDateTime } from './format';
import { useDeliveries, useRetryDelivery } from './queries';

const URL_DEFAULTS = { status: '', channel: '', from: '', to: '', page: '1', size: '25' };

const CHANNEL_LABELS: Record<DeliveryChannel, string> = { email: 'Email', sms: 'SMS' };

function DateFilter({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const id = React.useId();
  return (
    <div className="flex w-full items-center gap-2 sm:w-auto">
      <label htmlFor={id} className="w-10 shrink-0 text-sm text-muted-foreground sm:w-auto">
        {label}
      </label>
      <Input id={id} type="date" value={value} onChange={(e) => onChange(e.target.value)} className="h-11 w-full sm:w-40 md:h-9" />
    </div>
  );
}

function RetryButton({ row }: { row: Delivery }) {
  const retry = useRetryDelivery();
  const onRetry = async () => {
    try {
      await retry.mutateAsync(row.id);
      notify.success('Queued again. It is sent within a few minutes.');
    } catch (error) {
      notify.error(errorMessage(error, "It wasn't queued again. Check your connection and try again."));
    }
  };
  return (
    <Button variant="outline" className="min-h-11 md:min-h-9" onClick={() => void onRetry()} disabled={retry.isPending}>
      {retry.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <RotateCcw aria-hidden="true" />}
      Retry
    </Button>
  );
}

export function DeliveryLogScreen() {
  const [url, setUrl] = useUrlState(URL_DEFAULTS);
  const status = (DELIVERY_STATUSES as readonly string[]).includes(url.status) ? (url.status as DeliveryStatus) : '';
  const channel = (DELIVERY_CHANNELS as readonly string[]).includes(url.channel) ? (url.channel as DeliveryChannel) : '';
  const page = positiveInt(url.page, 1);
  const pageSize = positiveInt(url.size, 25, PAGE_SIZES);

  const params = React.useMemo<DeliveryParams>(
    () => ({ status, channel, from: url.from || undefined, to: url.to || undefined, page, pageSize }),
    [status, channel, url.from, url.to, page, pageSize]
  );
  const q = useDeliveries(params);
  const data = q.data;
  const items = React.useMemo(() => data?.items ?? [], [data]);
  const counts = data?.counts;
  const all = counts ? DELIVERY_STATUSES.reduce((sum, s) => sum + (counts[s] ?? 0), 0) : null;

  const columns = React.useMemo<ColumnDef<Delivery>[]>(
    () => [
      {
        id: 'created',
        enableSorting: false,
        header: 'Created',
        cell: ({ row }) => <span className="whitespace-nowrap">{formatDateTime(row.original.created_at)}</span>,
      },
      {
        id: 'recipient',
        enableSorting: false,
        header: 'Recipient',
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="font-medium text-foreground">{row.original.recipient_name || '—'}</p>
            {row.original.recipient_email ? (
              <p className="text-xs break-all text-muted-foreground">{row.original.recipient_email}</p>
            ) : null}
          </div>
        ),
      },
      {
        id: 'alert',
        enableSorting: false,
        header: 'Alert',
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="break-words text-foreground">{row.original.title}</p>
            <p className="text-xs text-muted-foreground">{eventLabel(row.original.event)}</p>
          </div>
        ),
      },
      {
        id: 'channel',
        enableSorting: false,
        header: 'Channel',
        cell: ({ row }) => CHANNEL_LABELS[row.original.channel] ?? row.original.channel,
      },
      {
        id: 'status',
        enableSorting: false,
        header: 'Status',
        cell: ({ row }) => {
          const badge = DELIVERY_STATUS_BADGES[row.original.status] ?? { status: 'neutral' as const, label: row.original.status };
          return (
            <div className="flex min-w-0 flex-col gap-1">
              <StatusBadge status={badge.status} label={badge.label} />
              {row.original.status === 'sent' && row.original.sent_at ? (
                <span className="text-xs text-muted-foreground">{formatDateTime(row.original.sent_at)}</span>
              ) : null}
              {row.original.attempts > 0 && row.original.status !== 'sent' ? (
                <span className="text-xs text-muted-foreground">
                  {row.original.attempts} {row.original.attempts === 1 ? 'attempt' : 'attempts'}
                </span>
              ) : null}
              {row.original.last_error ? (
                <span className="max-w-xs text-xs break-words text-red-700">{row.original.last_error}</span>
              ) : null}
            </div>
          );
        },
      },
      {
        id: 'actions',
        enableSorting: false,
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) =>
          row.original.status === 'failed' || row.original.status === 'skipped' ? (
            <div className="flex justify-end">
              <RetryButton row={row.original} />
            </div>
          ) : null,
        meta: { label: 'Actions', className: 'text-right' },
      },
    ],
    []
  );

  const filtered = Boolean(status || channel || url.from || url.to);
  const clearFilters = () => setUrl({ status: null, channel: null, from: null, to: null, page: null });

  return (
    <PageShell
      title="Delivery log"
      description="Email and SMS copies of alerts and announcements. Skipped means email wasn’t set up when it was due; SMS copies are skipped until SMS is available."
    >
      <SegmentTabs
        label="Status"
        value={status || 'all'}
        onChange={(v) => setUrl({ status: v === 'all' ? null : v, page: null })}
        tabs={[
          { value: 'all', label: 'All', count: all },
          ...DELIVERY_STATUSES.map((s) => ({ value: s, label: DELIVERY_STATUS_BADGES[s].label, count: counts?.[s] ?? null })),
        ]}
      />

      <div className="flex flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-center">
        <LabeledSelect label="Channel" value={channel} onChange={(v) => setUrl({ channel: v, page: null })}>
          <option value="">All channels</option>
          {DELIVERY_CHANNELS.map((c) => (
            <option key={c} value={c}>
              {CHANNEL_LABELS[c]}
            </option>
          ))}
        </LabeledSelect>
        <DateFilter label="From" value={url.from} onChange={(v) => setUrl({ from: v, page: null })} />
        <DateFilter label="To" value={url.to} onChange={(v) => setUrl({ to: v, page: null })} />
        {filtered ? (
          <Button variant="ghost" className="min-h-11 md:min-h-9" onClick={clearFilters}>
            Clear filters
          </Button>
        ) : null}
      </div>

      {q.isError ? (
        <LoadError error={q.error} what="the delivery log" onRetry={() => void q.refetch()} />
      ) : (
        <div className={cn('flex flex-col gap-4 transition-opacity', q.isPlaceholderData && 'opacity-60')} aria-busy={q.isFetching || undefined}>
          <DataTable
            label="Deliveries"
            columns={columns}
            data={items}
            loading={q.isLoading}
            loadingRows={Math.min(pageSize, 10)}
            pageSize={0}
            getRowId={(d) => d.id}
            emptyState={
              filtered ? (
                <EmptyState
                  icon={Search}
                  title="No matches"
                  description="Nothing matches these filters. Try other dates or clear the filters."
                  action={
                    <Button variant="outline" onClick={clearFilters}>
                      Clear filters
                    </Button>
                  }
                />
              ) : (
                <EmptyState
                  icon={MailCheck}
                  title="Nothing sent yet"
                  description="Email copies of alerts and announcements appear here as they are sent."
                />
              )
            }
          />
          {data && data.total > 0 ? (
            <Pagination
              label="Delivery log pages"
              itemLabel="deliveries"
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
    </PageShell>
  );
}
