'use client';

// Attendance reports: per student for one class over a period (empty dates = the school year so
// far). Admins, the principal and the registrar choose any class; a sponsor, the classes they
// sponsor.

import * as React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import type { ColumnDef } from '@tanstack/react-table';
import { BarChart3, Download } from 'lucide-react';

import { ClassPicker, CountTiles, DateField, rate, useAttendanceAccess } from '@/components/attendance/attendance-ui';
import { useAttendanceClasses, useClassReport } from '@/components/attendance/queries';
import { errorMessage, formatDate } from '@/components/students/format';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';
import { PageShell } from '@/components/ui/page-shell';
import { Skeleton } from '@/components/ui/skeleton';
import type { ClassAttendanceReport, StudentReportRow } from '@/types/daily-attendance';

function downloadCsv(report: ClassAttendanceReport) {
  const header = ['Student', 'Admission number', 'Present', 'Late', 'Absent', 'Excused', 'Sick', 'Not marked', 'Rate (%)'];
  const rows = report.rows.map((r) => [
    r.student_name, r.admission_number ?? '', r.present, r.late, r.absent, r.excused, r.sick, r.unmarked,
    r.attendance_rate ?? '',
  ]);
  const cell = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const csv = [header, ...rows].map((line) => line.map(cell).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `attendance-${(report.class_name ?? 'class').replace(/\s+/g, '-')}-${report.start_date}-to-${report.end_date}.csv`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

const n = (value: number, tone = '') => <span className={`tabular-nums ${tone}`}>{value}</span>;

export default function AttendanceReportsPage() {
  const { tenantDomain } = useParams<{ tenantDomain: string }>();
  const { user, viewsSchool } = useAttendanceAccess();
  // The whole school for admins, the principal and the registrar; a sponsor's own classes otherwise
  const classes = useAttendanceClasses(viewsSchool ? undefined : user?.id, Boolean(user?.id));
  const [picked, setPicked] = React.useState('');
  const [start, setStart] = React.useState('');
  const [end, setEnd] = React.useState('');
  const list = classes.data ?? [];
  const classId = picked || (list.length === 1 ? list[0].id : '');
  const report = useClassReport(classId, start, end);
  const data = report.data;

  const columns = React.useMemo<ColumnDef<StudentReportRow>[]>(
    () => [
      {
        accessorKey: 'student_name',
        header: 'Student',
        cell: ({ row }) => (
          <div>
            <Link
              href={`/${tenantDomain}/attendance/students/${row.original.student_id}`}
              className="font-medium text-primary underline-offset-4 hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {row.original.student_name}
            </Link>
            <p className="text-sm text-muted-foreground">{row.original.admission_number}</p>
          </div>
        ),
      },
      { accessorKey: 'present', header: 'Present', meta: { className: 'text-right' }, cell: ({ row }) => n(row.original.present, 'text-green-800') },
      { accessorKey: 'late', header: 'Late', meta: { className: 'text-right' }, cell: ({ row }) => n(row.original.late, 'text-orange-800') },
      { accessorKey: 'absent', header: 'Absent', meta: { className: 'text-right' }, cell: ({ row }) => n(row.original.absent, 'text-red-800') },
      { accessorKey: 'excused', header: 'Excused', meta: { className: 'text-right' }, cell: ({ row }) => n(row.original.excused, 'text-blue-800') },
      { accessorKey: 'sick', header: 'Sick', meta: { className: 'text-right' }, cell: ({ row }) => n(row.original.sick, 'text-blue-800') },
      {
        accessorKey: 'unmarked',
        header: 'Not marked',
        meta: { className: 'text-right', hideOnMobile: true },
        cell: ({ row }) => n(row.original.unmarked, row.original.unmarked ? 'text-amber-900' : 'text-muted-foreground'),
      },
      {
        accessorKey: 'attendance_rate',
        header: 'Rate',
        meta: { className: 'text-right' },
        cell: ({ row }) => <span className="font-semibold tabular-nums">{rate(row.original.attendance_rate)}</span>,
      },
    ],
    [tenantDomain]
  );

  return (
    <PageShell
      title="Attendance reports"
      description="Each student's attendance in a class. Leave the dates empty for the school year so far."
      primaryAction={
        data ? (
          <Button className="min-h-11 md:min-h-9" onClick={() => downloadCsv(data)}>
            <Download aria-hidden="true" />
            Download as CSV
          </Button>
        ) : undefined
      }
    >
      <div className="grid gap-4 sm:grid-cols-3 lg:max-w-3xl">
        <ClassPicker
          id="report-class"
          value={classId}
          onChange={setPicked}
          classes={list}
          loading={classes.isLoading}
          placeholder={list.length === 0 && !classes.isLoading ? 'No classes to report on' : 'Choose a class'}
        />
        <DateField id="report-from" label="From" value={start} max={end || undefined} onChange={setStart} />
        <DateField id="report-to" label="To" value={end} onChange={setEnd} />
      </div>

      {!classId ? (
        <EmptyState icon={BarChart3} description="Choose a class to see its report." />
      ) : report.isLoading ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : report.isError || !data ? (
        <EmptyState
          icon={BarChart3}
          title="The report didn't load"
          description={`${errorMessage(report.error, 'The server didn’t answer.')} Check the dates and try again.`}
          action={<Button onClick={() => report.refetch()}>Try again</Button>}
        />
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {data.class_name} · {formatDate(data.start_date)} to {formatDate(data.end_date)} · {data.school_days}{' '}
            {data.school_days === 1 ? 'school day' : 'school days'}
          </p>
          <CountTiles
            tiles={[
              { label: 'Class rate', value: rate(data.totals.attendance_rate) },
              { label: 'Present', value: data.totals.present, status: 'present' },
              { label: 'Late', value: data.totals.late, status: 'late' },
              { label: 'Absent', value: data.totals.absent, status: 'absent' },
            ]}
          />
          <DataTable
            label={`Attendance in ${data.class_name ?? 'the class'}`}
            columns={columns}
            data={data.rows}
            searchable
            searchPlaceholder="Search students"
            getRowId={(r) => r.student_id}
            initialSorting={[{ id: 'student_name', desc: false }]}
            emptyState={<EmptyState icon={BarChart3} description="No students are enrolled in this class." />}
          />
        </>
      )}
    </PageShell>
  );
}
