'use client';

// A student's school-day attendance for the school year: the numbers, then every recorded day.
// Used by the student's own page, staff viewing one student, and the parent portal.

import * as React from 'react';
import { CalendarCheck, Paperclip } from 'lucide-react';

import { CountTiles, DailyStatusBadge, rate } from '@/components/attendance/attendance-ui';
import { SOURCE_LABELS } from '@/components/attendance/daily-status';
import { useStudentAttendanceHistory } from '@/components/attendance/queries';
import { errorMessage, formatDate, formatTime } from '@/components/students/format';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge, type StatusBadgeStatus } from '@/components/ui/status-badge';
import { notify } from '@/components/ui/toaster';
import { useDailyAttendanceService } from '@/services/api/daily-attendance-service';
import type { ExcuseStatus } from '@/types/daily-attendance';
import { openExcuseDocument } from '@/utils/excuse-documents';

const EXCUSE: Record<ExcuseStatus, { status: StatusBadgeStatus; label: string }> = {
  pending: { status: 'pending', label: 'Excuse waiting for review' },
  approved: { status: 'success', label: 'Excuse approved' },
  rejected: { status: 'danger', label: 'Excuse rejected' },
};

interface DailyAttendanceHistoryProps {
  studentId: string;
  refreshKey?: number; // bump to reload (e.g. after reporting an absence)
  showStudentName?: boolean; // staff viewing someone else's attendance
}

export function DailyAttendanceHistory({ studentId, refreshKey = 0, showStudentName = false }: DailyAttendanceHistoryProps) {
  const history = useStudentAttendanceHistory(studentId, refreshKey);
  const { getExcuseDocument } = useDailyAttendanceService();

  const viewDocument = async (dailyId: string) => {
    try {
      openExcuseDocument(await getExcuseDocument(dailyId));
    } catch (err) {
      notify.error(errorMessage(err, "The document couldn't be opened."));
    }
  };

  if (history.isLoading) return <Skeleton className="h-64 w-full rounded-xl" />;
  if (history.isError || !history.data) {
    return (
      <EmptyState
        icon={CalendarCheck}
        title="The attendance didn't load"
        description={`${errorMessage(history.error, 'The server didn’t answer.')} Check your connection and try again.`}
        action={<Button onClick={() => history.refetch()}>Try again</Button>}
      />
    );
  }

  const { summary, records } = history.data;
  return (
    <div className="space-y-4">
      {showStudentName && history.data.student_name ? (
        <h2 className="text-xl font-semibold">
          {history.data.student_name}
          {history.data.admission_number ? (
            <span className="ml-2 text-base font-normal text-muted-foreground">{history.data.admission_number}</span>
          ) : null}
        </h2>
      ) : null}
      <p className="text-sm text-muted-foreground">
        {formatDate(history.data.start_date)} to {formatDate(history.data.end_date)}
      </p>
      <CountTiles
        className="lg:grid-cols-6"
        tiles={[
          { label: 'Attendance rate', value: rate(summary.attendance_rate) },
          { label: 'School days', value: summary.school_days },
          { label: 'Present', value: summary.present, status: 'present' },
          { label: 'Late', value: summary.late, status: 'late' },
          { label: 'Absent', value: summary.absent, status: 'absent' },
          { label: 'Excused or sick', value: summary.excused + summary.sick, status: 'excused' },
        ]}
      />

      {records.length === 0 ? (
        <EmptyState icon={CalendarCheck} description="No attendance has been recorded yet this school year." />
      ) : (
        <ul className="divide-y rounded-xl border bg-card" aria-label="Days">
          {records.map((r) => (
            <li key={r.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="font-medium">{formatDate(r.date)}</p>
                <p className="text-sm text-muted-foreground">
                  {[
                    SOURCE_LABELS[r.source],
                    r.check_in_at ? `in ${formatTime(r.check_in_at)}` : '',
                    r.check_out_at ? `out ${formatTime(r.check_out_at)}` : '',
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
                {r.excuse_reason ? <p className="mt-1 max-w-xl text-sm text-muted-foreground">{r.excuse_reason}</p> : null}
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                {r.excuse_status ? (
                  <StatusBadge status={EXCUSE[r.excuse_status].status} label={EXCUSE[r.excuse_status].label} />
                ) : null}
                {r.excuse_document_url ? (
                  <Button variant="ghost" size="sm" className="min-h-11 md:min-h-9" onClick={() => viewDocument(r.id)}>
                    <Paperclip aria-hidden="true" />
                    Document
                  </Button>
                ) : null}
                <DailyStatusBadge status={r.status} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
