'use client';

// Mark attendance (admins): any class, any past school day. ?classId=&date= open a class straight
// from the Today page. Close day records everyone still not marked as absent.

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { CalendarCheck, Lock, Users } from 'lucide-react';

import { ClassPicker, DateField, useAttendanceAccess } from '@/components/attendance/attendance-ui';
import { DailyRosterPanel } from '@/components/attendance/DailyRosterPanel';
import { useAttendanceClasses, useCloseDay, useSchoolToday } from '@/components/attendance/queries';
import { errorMessage, formatDate } from '@/components/students/format';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { PageShell } from '@/components/ui/page-shell';
import { Skeleton } from '@/components/ui/skeleton';
import { notify } from '@/components/ui/toaster';

export default function MarkAttendancePage() {
  const searchParams = useSearchParams();
  const { isLoading, runsSchool } = useAttendanceAccess();
  const { today } = useSchoolToday();
  const classes = useAttendanceClasses(undefined, runsSchool);
  const closeDay = useCloseDay();

  const [classId, setClassId] = React.useState(searchParams.get('classId') ?? '');
  const [pickedDate, setPickedDate] = React.useState(searchParams.get('date') ?? '');
  const [confirmClose, setConfirmClose] = React.useState(false);
  const date = pickedDate || today;

  if (isLoading) {
    return (
      <PageShell title="Mark attendance">
        <Skeleton className="h-48 w-full rounded-xl" />
      </PageShell>
    );
  }
  if (!runsSchool) {
    return (
      <PageShell title="Mark attendance">
        <EmptyState
          icon={Lock}
          title="Only the school's admins mark any class"
          description="Class sponsors mark their own class under Attendance → My class."
        />
      </PageShell>
    );
  }

  return (
    <PageShell
      title="Mark attendance"
      description={date ? formatDate(date) : 'Choose a class and a day.'}
      secondaryActions={
        <Button variant="outline" className="min-h-11 md:min-h-9" onClick={() => setConfirmClose(true)} disabled={!date}>
          <CalendarCheck aria-hidden="true" />
          Close the day
        </Button>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:max-w-2xl">
        <ClassPicker
          id="mark-class"
          value={classId}
          onChange={setClassId}
          classes={classes.data ?? []}
          loading={classes.isLoading}
        />
        <DateField id="mark-date" label="Day" value={date} max={today} onChange={(d) => d && setPickedDate(d)} />
      </div>

      {classes.isError ? (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage(classes.error, "The classes didn't load.")} Reload the page to try again.
        </p>
      ) : null}

      {classId ? (
        <DailyRosterPanel classId={classId} date={date} />
      ) : (
        <EmptyState icon={Users} description="Choose a class to see its students and mark them." />
      )}

      <ConfirmDialog
        open={confirmClose}
        onOpenChange={setConfirmClose}
        title={`Close ${date ? formatDate(date) : 'the day'}?`}
        description="Every student in every class who has no mark for this day is recorded absent. You can still correct any student afterwards."
        confirmLabel="Mark the rest absent"
        loading={closeDay.isPending}
        onConfirm={async () => {
          try {
            const result = await closeDay.mutateAsync(date);
            notify.success(
              `${formatDate(result.date)} is closed: ${result.marked_absent} ${result.marked_absent === 1 ? 'student' : 'students'} marked absent.`
            );
          } catch (err) {
            notify.error(errorMessage(err, "The day wasn't closed. Try again."));
            throw err;
          }
        }}
      />
    </PageShell>
  );
}
