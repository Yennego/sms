'use client';

// Student accounts (/{school}/finance/fees): who owes what this school year.
// The server filters, searches, sorts and pages (GET /finance/accounts); tab, class, search, sort,
// page, page size and year live in the URL (same pattern as class placement). Row → statement.
import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ColumnDef } from '@tanstack/react-table';
import { CheckCircle2, Plus, Search, Wallet } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';
import { PageShell } from '@/components/ui/page-shell';
import { Pagination } from '@/components/ui/pagination';
import { formatDate } from '@/components/students/format';
import { className as classLabel, useYearClasses } from '@/components/class-placement/queries';
import { LabeledSelect, PAGE_SIZES, SearchBox } from '@/components/class-placement/roster-controls';
import { positiveInt, useDebouncedSearch, useUrlState } from '@/components/class-placement/use-url-state';
import { YearSelect, useResultYears } from '@/components/results/year-select';
import type { AccountListItem, AccountParams, AccountSort, AccountStatus } from '@/services/api/fees-service';
import { anyPositive } from './money';
import { useAccounts, useFeesPermissions } from './queries';
import { RecordPaymentSheet, type PaymentStudent } from './record-payment-sheet';
import { AccountStatusBadge, Amounts, LoadError, SegmentTabs, StatTile } from './shared';

const TABS: { value: AccountStatus; label: string }[] = [
  { value: 'owing', label: 'Owing' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'paid', label: 'Paid up' },
  { value: 'all', label: 'All' },
];

const SORTS: { value: AccountSort; label: string }[] = [
  { value: 'name', label: 'Name' },
  { value: 'admission_number', label: 'Admission no.' },
  { value: 'class', label: 'Class' },
  { value: 'balance', label: 'Balance (largest first)' },
  { value: 'overdue', label: 'Overdue (largest first)' },
  { value: 'last_payment', label: 'Last payment' },
];

const URL_DEFAULTS = { tab: 'owing', class: '', q: '', sort: 'name', page: '1', size: '25', year: '' };

export function AccountsScreen({ school }: { school: string }) {
  const router = useRouter();
  const perms = useFeesPermissions();
  const [url, setUrl] = useUrlState(URL_DEFAULTS);
  const years = useResultYears();
  const tab = TABS.some((t) => t.value === url.tab) ? (url.tab as AccountStatus) : 'owing';
  const sort = SORTS.some((s) => s.value === url.sort) ? (url.sort as AccountSort) : 'name';
  const pageSize = positiveInt(url.size, 25, PAGE_SIZES);
  const page = positiveInt(url.page, 1);

  const commitSearch = React.useCallback((q: string) => setUrl({ q, page: null }), [setUrl]);
  const [searchText, setSearchText] = useDebouncedSearch(url.q, commitSearch);

  const params = React.useMemo<AccountParams>(
    () => ({
      academicYearId: years.yearId,
      status: tab,
      classId: url.class || undefined,
      q: url.q || undefined,
      sort,
      page,
      pageSize,
    }),
    [years.yearId, tab, url.class, url.q, sort, page, pageSize]
  );

  const accounts = useAccounts(params, Boolean(years.yearId) || !years.isLoading);
  const data = accounts.data;
  const items = React.useMemo(() => data?.items ?? [], [data]);
  const classes = useYearClasses(years.yearId).data ?? [];

  const [payFor, setPayFor] = React.useState<PaymentStudent | null>(null);
  const [payOpen, setPayOpen] = React.useState(false);
  const openPayment = React.useCallback((s: PaymentStudent | null) => {
    setPayFor(s);
    setPayOpen(true);
  }, []);

  // A page past the end: go to the last page.
  React.useEffect(() => {
    if (!data || accounts.isPlaceholderData) return;
    if (data.items.length === 0 && page > 1) setUrl({ page: data.pages > 1 ? data.pages : null });
  }, [data, accounts.isPlaceholderData, page, setUrl]);

  const statementHref = React.useCallback(
    (s: AccountListItem) => `/${school}/finance/accounts/${s.student_id}${years.yearId ? `?year=${years.yearId}` : ''}`,
    [school, years.yearId]
  );

  const columns = React.useMemo<ColumnDef<AccountListItem>[]>(
    () => [
      {
        id: 'name',
        enableSorting: false,
        header: 'Student',
        cell: ({ row }) => (
          <div className="min-w-0">
            <Link
              href={statementHref(row.original)}
              onClick={(e) => e.stopPropagation()}
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              {row.original.name}
            </Link>
            {row.original.admission_number ? (
              <p className="text-xs text-muted-foreground">{row.original.admission_number}</p>
            ) : null}
          </div>
        ),
      },
      {
        id: 'class',
        enableSorting: false,
        header: 'Class',
        cell: ({ row }) => row.original.class_name || <span className="text-muted-foreground">No class</span>,
      },
      {
        id: 'balance',
        enableSorting: false,
        header: 'Balance',
        cell: ({ row }) => <Amounts value={row.original.balance} locked={row.original.currency} />,
        meta: { className: 'text-right' },
      },
      {
        id: 'overdue',
        enableSorting: false,
        header: 'Overdue',
        cell: ({ row }) => (
          <Amounts
            value={row.original.overdue}
            locked={row.original.currency}
            className={cn(anyPositive(row.original.overdue) && 'text-red-700')}
          />
        ),
        meta: { className: 'text-right' },
      },
      {
        id: 'status',
        enableSorting: false,
        header: 'Status',
        cell: ({ row }) => (
          <AccountStatusBadge status={row.original.status} balance={row.original.balance} overdue={row.original.overdue} />
        ),
      },
      {
        id: 'last',
        enableSorting: false,
        header: 'Last payment',
        cell: ({ row }) =>
          row.original.last_payment_at ? formatDate(row.original.last_payment_at) : <span className="text-muted-foreground">None</span>,
        meta: { hideOnMobile: true },
      },
      ...(perms.record
        ? ([
            {
              id: 'action',
              enableSorting: false,
              header: () => <span className="sr-only">Actions</span>,
              cell: ({ row }) => (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="min-h-11 md:min-h-8"
                  onClick={(e) => {
                    e.stopPropagation();
                    openPayment({
                      student_id: row.original.student_id,
                      name: row.original.name,
                      class_name: row.original.class_name,
                      admission_number: row.original.admission_number,
                    });
                  }}
                  aria-label={`Record payment for ${row.original.name}`}
                >
                  Record payment
                </Button>
              ),
              meta: { label: 'Actions', className: 'text-right' },
            },
          ] as ColumnDef<AccountListItem>[])
        : []),
    ],
    [perms.record, openPayment, statementHref]
  );

  const filtered = Boolean(url.q || url.class);
  const clearFilters = () => {
    setSearchText('');
    setUrl({ q: null, class: null, page: null });
  };

  const emptyState = filtered ? (
    <EmptyState
      icon={Search}
      title="No matches"
      description="No student matches your search or class. Try another search, or show everyone."
      action={
        <Button variant="outline" onClick={clearFilters}>
          Clear search and filters
        </Button>
      }
    />
  ) : tab === 'owing' || tab === 'overdue' ? (
    <EmptyState
      icon={CheckCircle2}
      title={tab === 'owing' ? 'Nobody owes anything' : 'Nothing overdue'}
      description={
        tab === 'owing'
          ? 'Every student with a bill this year is paid up. If bills are missing, issue invoices in Fee setup.'
          : 'No installment is past due and unpaid.'
      }
      action={
        <Button variant="outline" onClick={() => setUrl({ tab: 'all', page: null })}>
          Show all students
        </Button>
      }
    />
  ) : (
    <EmptyState
      icon={Wallet}
      title="No fee accounts yet"
      description="Set fees for the semester and issue invoices; each student then gets an account here."
      action={
        perms.setup ? (
          <Button asChild>
            <Link href={`/${school}/finance/structures`}>Open fee setup</Link>
          </Button>
        ) : undefined
      }
    />
  );

  const listId = React.useId();
  const totals = data?.totals;

  return (
    <PageShell
      title="Student accounts"
      description="What each student owes this school year. Choose a student to see the statement."
      primaryAction={
        perms.record ? (
          <Button onClick={() => openPayment(null)}>
            <Plus aria-hidden="true" />
            Record payment
          </Button>
        ) : undefined
      }
    >
      <YearSelect years={years.years} value={years.yearId} onChange={(id) => setUrl({ year: id, page: null })} />

      {accounts.isError ? (
        <LoadError error={accounts.error} what="student accounts" onRetry={() => accounts.refetch()} />
      ) : (
        <>
          {totals ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <StatTile label={tab === 'all' ? 'Balance of all students' : 'Balance of students listed'}>
                <Amounts value={totals.balance} />
              </StatTile>
              <StatTile label="Overdue of students listed" tone="danger">
                <Amounts value={totals.overdue} />
              </StatTile>
            </div>
          ) : null}

          <SegmentTabs
            label="Accounts"
            tabs={TABS.map((t) => ({ ...t, count: data?.counts?.[t.value] ?? null }))}
            value={tab}
            onChange={(v) => setUrl({ tab: v, page: null })}
            controls={listId}
          />

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <SearchBox value={searchText} onChange={setSearchText} placeholder="Search by name or admission no." />
            <LabeledSelect label="Class" value={url.class} onChange={(v) => setUrl({ class: v, page: null })}>
              <option value="">All classes</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {classLabel(c)}
                </option>
              ))}
            </LabeledSelect>
            <div className="sm:ml-auto">
              <LabeledSelect label="Sort by" hideLabel={false} value={sort} onChange={(v) => setUrl({ sort: v, page: null })}>
                {SORTS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </LabeledSelect>
            </div>
          </div>

          <div
            id={listId}
            role="tabpanel"
            aria-busy={accounts.isFetching || undefined}
            className={cn('flex flex-col gap-4 transition-opacity', accounts.isPlaceholderData && 'opacity-60')}
          >
            <DataTable
              label="Student accounts"
              columns={columns}
              data={items}
              loading={accounts.isLoading || (!data && accounts.isFetching)}
              loadingRows={Math.min(pageSize, 10)}
              pageSize={0}
              getRowId={(s) => s.student_id}
              onRowClick={(s) => router.push(statementHref(s))}
              emptyState={emptyState}
              mobileCard={(s) => (
                <div className="flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium break-words text-foreground">{s.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {[s.class_name, s.admission_number].filter(Boolean).join(' · ') || 'No class'}
                      </p>
                    </div>
                    <AccountStatusBadge status={s.status} balance={s.balance} overdue={s.overdue} />
                  </div>
                  <dl className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <dt className="text-muted-foreground">Balance</dt>
                      <dd>
                        <Amounts value={s.balance} locked={s.currency} />
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Overdue</dt>
                      <dd>
                        <Amounts value={s.overdue} locked={s.currency} />
                      </dd>
                    </div>
                  </dl>
                  {perms.record ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="min-h-11"
                      onClick={(e) => {
                        e.stopPropagation();
                        openPayment({
                          student_id: s.student_id,
                          name: s.name,
                          class_name: s.class_name,
                          admission_number: s.admission_number,
                        });
                      }}
                    >
                      Record payment
                    </Button>
                  ) : null}
                </div>
              )}
            />

            {data && data.total > 0 ? (
              <Pagination
                label="Account pages"
                itemLabel="students"
                page={page}
                pageSize={pageSize}
                total={data.total}
                onPageChange={(p) => setUrl({ page: p })}
                onPageSizeChange={(size) => setUrl({ size, page: null })}
                pageSizeOptions={PAGE_SIZES}
              />
            ) : null}
          </div>
        </>
      )}

      {perms.record ? (
        <RecordPaymentSheet
          school={school}
          open={payOpen}
          onOpenChange={setPayOpen}
          student={payFor}
          yearId={years.yearId}
        />
      ) : null}
    </PageShell>
  );
}
