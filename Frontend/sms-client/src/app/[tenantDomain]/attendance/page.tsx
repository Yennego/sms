'use client';

// Attendance today: the whole school's day, class by class. Admins and the principal and registrar
// (view_school_attendance) see it; everyone else goes to their own attendance screen.

import * as React from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import type { ColumnDef } from '@tanstack/react-table';
import { ClipboardCheck, FileText, RefreshCw, School } from 'lucide-react';

import {
  CountTiles,
  DateField,
  DayNotices,
  rate,
  useAttendanceAccess,
} from '@/components/attendance/attendance-ui';
import { useAttendanceOverview } from '@/components/attendance/queries';
import { navigationFor } from '@/config/navigation';
import { errorMessage, formatDate } from '@/components/students/format';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';
import { PageShell } from '@/components/ui/page-shell';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/ui/status-badge';
import type { ClassOverview } from '@/types/daily-attendance';

// Where people without the whole school's view go: their own attendance screen
const OWN_SCREEN: Record<string, string> = {
  teacher: '/teacher/attendance',
  student: '/student/attendance',
  parent: '/parent/attendance',
  'attendance-scanner': '/attendance/scan',
};

const num = (n: number, tone?: string) => <span className={`tabular-nums ${tone ?? ''}`}>{n}</span>;

export default function AttendanceTodayPage() {
  const { tenantDomain } = useParams<{ tenantDomain: string }>();
  const router = useRouter();
  const { user, isLoading, runsSchool, viewsSchool } = useAttendanceAccess();
  const [date, setDate] = React.useState('');
  const overview = useAttendanceOverview(date, viewsSchool);
  const base = `/${tenantDomain}`;

  React.useEffect(() => {
    if (isLoading || !user || viewsSchool) return;
    router.replace(`${base}${OWN_SCREEN[user.role ?? ''] ?? navigationFor(user).home}`);
  }, [isLoading, user, viewsSchool, router, base]);

  const data = overview.data;
  const day = data?.day;

  const columns = React.useMemo<ColumnDef<ClassOverview>[]>(
    () => [
      {
        accessorKey: 'class_name',
        header: 'Class',
        cell: ({ row }) => <span className="font-medium">{row.original.class_name ?? 'Unnamed class'}</span>,
      },
      {
        accessorKey: 'sponsor_name',
        header: 'Sponsor',
        cell: ({ row }) =>
          row.original.sponsor_name ?? <StatusBadge status="warning" label="No sponsor" />,
      },
      { accessorKey: 'enrolled', header: 'Enrolled', meta: { className: 'text-right' }, cell: ({ row }) => num(row.original.enrolled) },
      { accessorKey: 'present', header: 'Present', meta: { className: 'text-right' }, cell: ({ row }) => num(row.original.present, 'text-green-800') },
      { accessorKey: 'late', header: 'Late', meta: { className: 'text-right' }, cell: ({ row }) => num(row.original.late, 'text-orange-800') },
      { accessorKey: 'absent', header: 'Absent', meta: { className: 'text-right' }, cell: ({ row }) => num(row.original.absent, 'text-red-800') },
      {
        id: 'excused',
        accessorFn: (c) => c.excused + c.sick,
        header: 'Excused or sick',
        meta: { className: 'text-right' },
        cell: ({ row }) => num(row.original.excused + row.original.sick, 'text-blue-800'),
      },
      {
        accessorKey: 'unmarked',
        header: 'Not marked',
        meta: { className: 'text-right' },
        cell: ({ row }) =>
          row.original.unmarked ? (
            <span className="font-semibold tabular-nums text-amber-900">{row.original.unmarked}</span>
          ) : (
            num(0, 'text-muted-foreground')
          ),
      },
      { accessorKey: 'scanned', header: 'By card', meta: { className: 'text-right', hideOnMobile: true }, cell: ({ row }) => num(row.original.scanned) },
      {
        accessorKey: 'attendance_rate',
        header: 'Rate',
        meta: { className: 'text-right' },
        cell: ({ row }) => <span className="font-semibold tabular-nums">{rate(row.original.attendance_rate)}</span>,
      },
    ],
    []
  );

  if (isLoading || !user || !viewsSchool) {
    return (
      <PageShell title="Attendance today">
        <Skeleton className="h-48 w-full rounded-xl" />
      </PageShell>
    );
  }

  const totals = data?.totals;
  return (
    <PageShell
      title="Attendance today"
      description={day ? formatDate(day.date) : 'The whole school, class by class.'}
      primaryAction={
        runsSchool ? (
          <Button asChild className="min-h-11 md:min-h-9">
            <Link href={`${base}/attendance/daily`}>
              <ClipboardCheck aria-hidden="true" />
              Mark attendance
            </Link>
          </Button>
        ) : undefined
      }
      secondaryActions={
        <Button
          variant="outline"
          className="min-h-11 md:min-h-9"
          onClick={() => overview.refetch()}
          disabled={overview.isFetching}
        >
          <RefreshCw className={overview.isFetching ? 'animate-spin' : undefined} aria-hidden="true" />
          Refresh
        </Button>
      }
    >
      <DateField
        id="overview-date"
        label="Day"
        value={date || day?.date || ''}
        max={day?.today}
        onChange={(d) => d && setDate(d)}
        className="max-w-xs"
      />

      {overview.isError ? (
        <EmptyState
          icon={School}
          title="Today's attendance didn't load"
          description={`${errorMessage(overview.error, 'The server didn’t answer.')} Check your connection and try again.`}
          action={<Button onClick={() => overview.refetch()}>Try again</Button>}
        />
      ) : !data || !totals ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : (
        <>
          <DayNotices day={data.day} />
          {runsSchool && data.pending_excuses > 0 ? (
            <Link
              href={`${base}/attendance/excuses`}
              className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 hover:bg-amber-100"
            >
              <span className="flex items-center gap-3">
                <FileText className="size-5 shrink-0" aria-hidden="true" />
                {data.pending_excuses} absence {data.pending_excuses === 1 ? 'excuse is' : 'excuses are'} waiting for review
              </span>
              <span className="font-semibold">Review</span>
            </Link>
          ) : null}

          <CountTiles
            tiles={[
              { label: 'Enrolled', value: totals.enrolled },
              { label: 'Present', value: totals.present, status: 'present' },
              { label: 'Late', value: totals.late, status: 'late' },
              { label: 'Absent', value: totals.absent, status: 'absent' },
              { label: 'Excused or sick', value: totals.excused + totals.sick, status: 'excused' },
              { label: 'Not marked yet', value: totals.unmarked, status: totals.unmarked ? 'pending' : undefined },
              { label: 'Scanned in by card', value: totals.scanned },
              { label: 'Attendance rate', value: rate(totals.attendance_rate) },
            ]}
          />

          <DataTable
            label="Classes"
            columns={columns}
            data={data.classes}
            pageSize={0}
            getRowId={(c) => c.class_id}
            initialSorting={[{ id: 'class_name', desc: false }]}
            onRowClick={
              runsSchool
                ? (c) => router.push(`${base}/attendance/daily?classId=${c.class_id}&date=${data.day.date}`)
                : undefined
            }
            emptyState={
              <EmptyState
                icon={School}
                description="This school year has no active classes yet. Create them under Classes → Setup."
              />
            }
          />
          {runsSchool && data.classes.length > 0 ? (
            <p className="text-sm text-muted-foreground">Open a class to mark or correct its attendance.</p>
          ) : null}
        </>
      )}
    </PageShell>
  );
}
