'use client';

// My class: a class sponsor marks their own class (phone first). A sponsor of one class goes
// straight to it; ?classId= opens a given sponsored class.

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { Users } from 'lucide-react';

import { ClassPicker, DateField, useAttendanceAccess } from '@/components/attendance/attendance-ui';
import { DailyRosterPanel } from '@/components/attendance/DailyRosterPanel';
import { useAttendanceClasses, useSchoolToday } from '@/components/attendance/queries';
import { errorMessage, formatDate } from '@/components/students/format';
import { EmptyState } from '@/components/ui/empty-state';
import { PageShell } from '@/components/ui/page-shell';
import { Skeleton } from '@/components/ui/skeleton';

export default function MyClassAttendancePage() {
  const searchParams = useSearchParams();
  const { user } = useAttendanceAccess();
  const { today } = useSchoolToday();
  const classes = useAttendanceClasses(user?.id, Boolean(user?.id));
  const [picked, setPicked] = React.useState(searchParams.get('classId') ?? '');
  const [pickedDate, setPickedDate] = React.useState('');

  const list = classes.data ?? [];
  // A sponsor usually has one class: open it straight away
  const classId = picked || (list.length === 1 ? list[0].id : '');
  const date = pickedDate || today;
  const className = list.find((c) => c.id === classId)?.name;

  return (
    <PageShell
      title="Mark my class"
      description={[className, date ? formatDate(date) : ''].filter(Boolean).join(' · ') || 'Your class, one school day at a time.'}
    >
      {classes.isLoading ? (
        <Skeleton className="h-11 w-full max-w-md rounded-md" />
      ) : classes.isError ? (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage(classes.error, "Your classes didn't load.")} Reload the page to try again.
        </p>
      ) : list.length === 0 ? (
        <EmptyState
          icon={Users}
          title="You don't sponsor a class"
          description="Only a class's sponsor marks its attendance. If you should sponsor one, ask the school admin to set you as sponsor under Classes → Setup."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:max-w-2xl">
          {list.length > 1 ? (
            <ClassPicker id="my-class" value={classId} onChange={setPicked} classes={list} />
          ) : null}
          <DateField id="my-class-date" label="Day" value={date} max={today} onChange={(d) => d && setPickedDate(d)} />
        </div>
      )}

      {classId ? (
        <DailyRosterPanel classId={classId} date={date} />
      ) : list.length > 1 ? (
        <EmptyState icon={Users} description="Choose one of your classes to mark it." />
      ) : null}
    </PageShell>
  );
}
