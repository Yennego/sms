'use client';

// The teacher's own lessons from every timetable (phone first): today, then the week.

import * as React from 'react';
import { CalendarDays, CalendarX } from 'lucide-react';

import { useMySchedule } from '@/components/timetables/queries';
import { TimetablePrintStyles, TodayAndWeek, WeekGrid, type Lesson } from '@/components/timetables/timetable-ui';
import { errorMessage } from '@/components/students/format';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';

/** `printTitle` heads the printed week (the screen shows today first, paper shows the grid). */
export default function TeacherWeeklySchedule({ printTitle }: { printTitle: string }) {
  const schedule = useMySchedule();

  const lessons = React.useMemo<Lesson[]>(
    () =>
      (schedule.data ?? []).map((s, i) => ({
        id: `${s.id ?? ''}-${i}`,
        day: (s.day_of_week || '').toLowerCase(),
        start: s.start_time,
        end: s.end_time,
        title: s.subject_name || 'Lesson',
        detail: s.name || undefined, // the class
      })),
    [schedule.data]
  );

  if (schedule.isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }
  if (schedule.isError) {
    return (
      <EmptyState
        icon={CalendarX}
        description={`${errorMessage(schedule.error, "Your timetable didn't load.")} Check your connection and try again.`}
        action={
          <Button variant="outline" onClick={() => void schedule.refetch()}>
            Try again
          </Button>
        }
      />
    );
  }
  if (lessons.length === 0) {
    return (
      <EmptyState
        icon={CalendarDays}
        description="You have no lessons on the timetables yet. If that's wrong, ask the school office to add them."
      />
    );
  }
  return (
    <>
      <div className="flex flex-col gap-6 print:hidden">
        <TodayAndWeek lessons={lessons} />
      </div>
      <TimetablePrintStyles />
      <div className="timetable-print hidden space-y-4 print:block">
        <h2 className="text-xl font-semibold">{printTitle}</h2>
        <WeekGrid lessons={lessons} />
      </div>
    </>
  );
}
