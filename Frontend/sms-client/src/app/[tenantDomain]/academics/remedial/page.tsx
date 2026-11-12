'use client';

// Remedial work: students below the pass mark in a subject this year (schedule a session for
// them), and every remedial session with its result. Opening a session's student lets staff
// record results; when a Conditional student passes all their remedial work they move up a grade.

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import type { ColumnDef } from '@tanstack/react-table';
import { BookOpen, CalendarPlus, CalendarX, ClipboardCheck, RefreshCw, ShieldAlert } from 'lucide-react';

import { errorMessage, formatDate } from '@/components/students/format';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';
import { PageShell } from '@/components/ui/page-shell';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/ui/status-badge';
import { notify } from '@/components/ui/toaster';
import {
  useAtRiskStudents,
  useCurrentSchoolYear,
  useRefreshYearEnd,
  useRemedialSessions,
  useScheduleRemedial,
  type AtRiskItem,
  type RemedialSessionRow,
} from '@/components/year-end/queries';
import { RemedialSection } from '@/components/year-end/remedial-section';

export default function RemedialPage() {
  const { tenantDomain } = useParams<{ tenantDomain: string }>();
  const year = useCurrentSchoolYear();
  const yearId = year.data?.id ?? '';
  const atRisk = useAtRiskStudents(yearId);
  // The sessions list shows once the current year is known, as before
  const sessions = useRemedialSessions();
  const schedule = useScheduleRemedial();
  const refreshYearEnd = useRefreshYearEnd();
  const [scheduling, setScheduling] = useState<string | null>(null);
  const [openSession, setOpenSession] = useState<RemedialSessionRow | null>(null);

  const refreshing = atRisk.isFetching || sessions.isFetching;

  const handleSchedule = async (item: AtRiskItem) => {
    const key = `${item.enrollment_id}-${item.subject_id}`;
    setScheduling(key);
    try {
      await schedule.mutateAsync({ enrollmentId: item.enrollment_id, subjectId: item.subject_id });
      notify.success(`Remedial session in ${item.subject_name || 'the subject'} scheduled for ${item.student_name || 'the student'}.`);
    } catch (error) {
      notify.error(errorMessage(error, "The session wasn't scheduled. Try again."));
    } finally {
      setScheduling(null);
    }
  };

  const atRiskColumns = useMemo<ColumnDef<AtRiskItem>[]>(
    () => [
      {
        accessorKey: 'student_name',
        header: 'Student',
        cell: ({ row }) => <span className="font-medium">{row.original.student_name || 'Unknown student'}</span>,
      },
      { accessorKey: 'subject_name', header: 'Subject', cell: ({ row }) => row.original.subject_name || 'Unknown subject' },
      {
        accessorKey: 'current_grade',
        header: 'Grade now',
        cell: ({ row }) => (
          <StatusBadge
            status="danger"
            label={`${Number(row.original.current_grade).toFixed(1)}% (pass mark ${row.original.passing_mark}%)`}
          />
        ),
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        meta: { label: 'Actions', className: 'text-right' },
        cell: ({ row }) => {
          const key = `${row.original.enrollment_id}-${row.original.subject_id}`;
          return (
            <div className="flex justify-end">
              <Button
                size="sm"
                className="min-h-11 md:min-h-9"
                onClick={() => handleSchedule(row.original)}
                disabled={schedule.isPending}
              >
                <CalendarPlus aria-hidden="true" />
                {scheduling === key ? 'Scheduling…' : 'Schedule session'}
              </Button>
            </div>
          );
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [schedule.isPending, scheduling]
  );

  const sessionColumns = useMemo<ColumnDef<RemedialSessionRow>[]>(
    () => [
      {
        accessorKey: 'student_name',
        header: 'Student',
        cell: ({ row }) => <span className="font-medium">{row.original.student_name || 'Unknown student'}</span>,
      },
      { accessorKey: 'subject_name', header: 'Subject', cell: ({ row }) => row.original.subject_name || 'Unknown subject' },
      {
        accessorKey: 'scheduled_date',
        header: 'Date',
        cell: ({ row }) => formatDate(row.original.scheduled_date) || '–',
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) =>
          row.original.status === 'completed' ? (
            <StatusBadge status="success" label="Completed" />
          ) : (
            <StatusBadge status="pending" label="Scheduled" />
          ),
      },
      {
        id: 'result',
        header: 'Result',
        enableSorting: false,
        cell: ({ row }) => {
          const s = row.original;
          if (s.passed == null && s.new_score == null) return <span className="text-muted-foreground">–</span>;
          return (
            <div className="flex flex-wrap items-center gap-2">
              {s.new_score != null ? <span className="tabular-nums">{s.new_score}%</span> : null}
              {s.passed != null ? (
                <StatusBadge status={s.passed ? 'success' : 'danger'} label={s.passed ? 'Passed' : 'Failed'} />
              ) : null}
            </div>
          );
        },
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        meta: { label: 'Actions', className: 'text-right' },
        cell: ({ row }) =>
          row.original.enrollment_id ? (
            <div className="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                className="min-h-11 md:min-h-9"
                onClick={() => setOpenSession(row.original)}
              >
                <ClipboardCheck aria-hidden="true" />
                {row.original.status === 'completed' ? 'Open' : 'Record result'}
              </Button>
            </div>
          ) : null,
      },
    ],
    []
  );

  const refresh = () => {
    year.refetch();
    atRisk.refetch();
    sessions.refetch();
  };

  const header = (children: React.ReactNode) => (
    <PageShell
      title="Remedial work"
      description="Students below the pass mark get remedial sessions. Record each result: passing all of them moves a Conditional student up a grade."
      secondaryActions={
        <Button variant="outline" className="min-h-11 md:min-h-9" onClick={refresh} disabled={refreshing || !yearId}>
          <RefreshCw className={refreshing ? 'animate-spin' : undefined} aria-hidden="true" />
          Refresh lists
        </Button>
      }
    >
      {children}
    </PageShell>
  );

  if (year.isLoading) {
    return header(<Skeleton className="h-64 w-full rounded-xl" />);
  }
  if (year.isError) {
    return header(
      <EmptyState
        icon={BookOpen}
        title="Remedial work didn't load"
        description={`${errorMessage(year.error, 'The server didn’t answer.')} Check your connection and try again.`}
        action={<Button onClick={() => year.refetch()}>Try again</Button>}
      />
    );
  }
  if (!yearId) {
    return header(
      <EmptyState
        icon={CalendarX}
        description="There is no current school year. Set the current year to see who needs remedial work."
        action={
          <Button asChild>
            <Link href={`/${tenantDomain}/academics/academic-years`}>Go to school years</Link>
          </Button>
        }
      />
    );
  }

  return header(
    <>
      <section aria-labelledby="at-risk-heading" className="flex flex-col gap-3">
        <div>
          <h2 id="at-risk-heading" className="flex items-center gap-2 text-lg font-semibold">
            <ShieldAlert className="size-5 text-amber-600" aria-hidden="true" />
            Need remedial work
            {atRisk.data ? <span className="text-muted-foreground">({atRisk.data.length})</span> : null}
          </h2>
          <p className="text-sm text-muted-foreground">
            Students whose grade in a subject is below the pass mark in {year.data?.name}, with no session yet.
          </p>
        </div>
        {atRisk.isError ? (
          <EmptyState
            icon={ShieldAlert}
            title="This list didn't load"
            description={`${errorMessage(atRisk.error, 'The server didn’t answer.')} Check your connection and try again.`}
            action={<Button onClick={() => atRisk.refetch()}>Try again</Button>}
          />
        ) : (
          <DataTable
            label="Students who need remedial work"
            columns={atRiskColumns}
            data={atRisk.data ?? []}
            loading={atRisk.isLoading}
            loadingRows={3}
            pageSize={20}
            getRowId={(r) => `${r.enrollment_id}-${r.subject_id}`}
            emptyState={
              <EmptyState icon={ShieldAlert} description="No student needs a new remedial session right now." />
            }
          />
        )}
      </section>

      <section aria-labelledby="sessions-heading" className="flex flex-col gap-3">
        <div>
          <h2 id="sessions-heading" className="flex items-center gap-2 text-lg font-semibold">
            <BookOpen className="size-5 text-primary" aria-hidden="true" />
            Sessions
          </h2>
          <p className="text-sm text-muted-foreground">Scheduled and completed remedial sessions across the school.</p>
        </div>
        {sessions.isError ? (
          <EmptyState
            icon={BookOpen}
            title="The sessions didn't load"
            description={`${errorMessage(sessions.error, 'The server didn’t answer.')} Check your connection and try again.`}
            action={<Button onClick={() => sessions.refetch()}>Try again</Button>}
          />
        ) : (
          <DataTable
            label="Remedial sessions"
            columns={sessionColumns}
            data={sessions.data ?? []}
            loading={sessions.isLoading}
            searchable
            searchPlaceholder="Search by student or subject"
            pageSize={25}
            getRowId={(s) => s.id}
            initialSorting={[{ id: 'scheduled_date', desc: true }]}
            emptyState={
              <EmptyState
                icon={BookOpen}
                description="No remedial sessions yet. Schedule one for a student in the list above."
              />
            }
          />
        )}
      </section>

      {openSession?.enrollment_id ? (
        <RemedialSection
          key={openSession.enrollment_id}
          studentName={openSession.student_name || 'student'}
          enrollmentId={openSession.enrollment_id}
          onClose={() => {
            setOpenSession(null);
            refreshYearEnd(); // results recorded in the panel change these lists
          }}
        />
      ) : null}
    </>
  );
}
