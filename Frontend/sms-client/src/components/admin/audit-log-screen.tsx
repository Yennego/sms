'use client';

// Audit log (/{school}/admin/activity-logs): every change made at this school (added, changed,
// deleted), newest first, with who made it. Reads are not recorded. Filters (action, record type)
// and the page live in the URL. Render inside <Suspense>.
import * as React from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { History, Search } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';
import { PageShell } from '@/components/ui/page-shell';
import { Pagination } from '@/components/ui/pagination';
import { StatusBadge, type StatusBadgeStatus } from '@/components/ui/status-badge';
import { LabeledSelect, PAGE_SIZES } from '@/components/class-placement/roster-controls';
import { positiveInt, useUrlState } from '@/components/class-placement/use-url-state';
import { formatDateTime } from '@/components/communication/format';
import { LoadError } from '@/components/fees/shared';
import type { ActivityLog } from '@/services/api/activity-log-service';

import { useAuditLog } from './queries';

const URL_DEFAULTS = { action: '', entity: '', page: '1', size: '25' };

const ACTIONS: Record<string, { status: StatusBadgeStatus; label: string }> = {
  create: { status: 'success', label: 'Added' },
  update: { status: 'info', label: 'Changed' },
  delete: { status: 'danger', label: 'Deleted' },
};

// The record types the server names (core/middleware/audit_middleware.py), in plain words
const ENTITIES: Record<string, string> = {
  student: 'Students',
  teacher: 'Teachers',
  staff: 'Staff',
  parent: 'Parents',
  user: 'User accounts',
  role: 'Roles',
  academic_year: 'School years',
  academic_grade: 'Grade levels',
  section: 'Sections',
  subject: 'Subjects',
  enrollment: 'Enrollments',
  timetable: 'Timetables',
  attendance: 'Attendance',
  assignment: 'Assignments',
  exam: 'Exams',
  grade: 'Grades',
  grading_schema: 'Grading settings',
  published_results: 'Published results',
  announcement: 'Announcements',
  school_profile: 'School profile',
  signature: 'Signatures',
  tenant: 'School settings',
  system: 'Other',
};

const words = (key: string) => key.replace(/_/g, ' ');
const entityLabel = (key: string) => ENTITIES[key] ?? words(key).replace(/^./, (c) => c.toUpperCase());

function who(log: ActivityLog): { name: string; email?: string } {
  if (!log.user) return { name: 'System' };
  const name = [log.user.first_name, log.user.last_name].filter(Boolean).join(' ');
  return { name: name || log.user.email, email: log.user.email };
}

function summary(log: ActivityLog): string {
  if (log.action === 'create') return 'New record added';
  if (log.action === 'delete') return 'Record deleted';
  if (log.action === 'update') {
    const fields = Object.keys(log.new_values ?? {}).map(words);
    return fields.length ? `Changed ${fields.join(', ')}` : 'Record changed';
  }
  return words(log.action);
}

export function AuditLogScreen() {
  const [url, setUrl] = useUrlState(URL_DEFAULTS);
  const action = url.action in ACTIONS ? url.action : '';
  const page = positiveInt(url.page, 1);
  const pageSize = positiveInt(url.size, 25, PAGE_SIZES);

  const params = React.useMemo(
    () => ({ action, entityType: url.entity, page, pageSize }),
    [action, url.entity, page, pageSize]
  );
  const q = useAuditLog(params);
  const data = q.data;
  const items = React.useMemo(() => data?.items ?? [], [data]);

  const columns = React.useMemo<ColumnDef<ActivityLog>[]>(
    () => [
      {
        id: 'when',
        enableSorting: false,
        header: 'When',
        accessorFn: (log) => formatDateTime(log.created_at),
        cell: ({ row }) => <span className="whitespace-nowrap">{formatDateTime(row.original.created_at)}</span>,
      },
      {
        id: 'who',
        enableSorting: false,
        header: 'Who',
        accessorFn: (log) => `${who(log).name} ${who(log).email ?? ''}`,
        cell: ({ row }) => {
          const person = who(row.original);
          return (
            <div className="min-w-0">
              <p className="font-medium text-foreground">{person.name}</p>
              {person.email ? <p className="text-xs break-all text-muted-foreground">{person.email}</p> : null}
            </div>
          );
        },
      },
      {
        id: 'action',
        enableSorting: false,
        header: 'Action',
        accessorFn: (log) => ACTIONS[log.action]?.label ?? log.action,
        cell: ({ row }) => {
          const badge = ACTIONS[row.original.action] ?? { status: 'neutral' as const, label: words(row.original.action) };
          return <StatusBadge status={badge.status} label={badge.label} />;
        },
      },
      {
        id: 'record',
        enableSorting: false,
        header: 'Record',
        accessorFn: (log) => entityLabel(log.entity_type),
        cell: ({ row }) => entityLabel(row.original.entity_type),
      },
      {
        id: 'details',
        enableSorting: false,
        header: 'Details',
        accessorFn: summary,
        cell: ({ row }) => <span className="max-w-xs break-words">{summary(row.original)}</span>,
      },
      {
        id: 'source',
        enableSorting: false,
        header: 'From',
        accessorFn: (log) => log.ip_address ?? '',
        cell: ({ row }) => (
          <div className="min-w-0 text-xs text-muted-foreground">
            <p>{row.original.ip_address || 'Unknown address'}</p>
            {row.original.user_agent ? (
              <p className="max-w-40 truncate" title={row.original.user_agent}>
                {row.original.user_agent.split(' ')[0]}
              </p>
            ) : null}
          </div>
        ),
        meta: { label: 'From', hideOnMobile: true },
      },
    ],
    []
  );

  const filtered = Boolean(action || url.entity);
  const clearFilters = () => setUrl({ action: null, entity: null, page: null });

  return (
    <PageShell
      title="Audit log"
      description="Every change made at your school: what was added, changed or deleted, by whom and when. Viewing records isn't logged."
    >
      <div className="flex flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-center">
        <LabeledSelect label="Action" value={action} onChange={(v) => setUrl({ action: v, page: null })}>
          <option value="">All actions</option>
          {Object.entries(ACTIONS).map(([value, { label }]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </LabeledSelect>
        <LabeledSelect label="Record type" value={url.entity} onChange={(v) => setUrl({ entity: v, page: null })}>
          <option value="">All records</option>
          {Object.entries(ENTITIES).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </LabeledSelect>
        {filtered ? (
          <Button variant="ghost" className="min-h-11 md:min-h-9" onClick={clearFilters}>
            Clear filters
          </Button>
        ) : null}
      </div>

      {q.isError ? (
        <LoadError error={q.error} what="the audit log" onRetry={() => void q.refetch()} />
      ) : (
        <div
          className={cn('flex flex-col gap-4 transition-opacity', q.isPlaceholderData && 'opacity-60')}
          aria-busy={q.isFetching || undefined}
        >
          <DataTable
            label="Audit log"
            columns={columns}
            data={items}
            loading={q.isLoading}
            loadingRows={Math.min(pageSize, 10)}
            pageSize={0}
            searchable
            searchPlaceholder="Search this page"
            getRowId={(log) => log.id}
            emptyState={
              filtered ? (
                <EmptyState
                  icon={Search}
                  title="No matches"
                  description="No changes match these filters. Try another action or record type, or clear the filters."
                  action={
                    <Button variant="outline" onClick={clearFilters}>
                      Clear filters
                    </Button>
                  }
                />
              ) : (
                <EmptyState
                  icon={History}
                  title="No changes yet"
                  description="Changes made at your school appear here as people add, change or delete records."
                />
              )
            }
          />
          {data && data.total > 0 ? (
            <Pagination
              label="Audit log pages"
              itemLabel="changes"
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
