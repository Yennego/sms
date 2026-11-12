'use client';

// The student's timetable (phone first): today's lessons, then the week day by day.

import * as React from 'react';
import { CalendarDays, CalendarX } from 'lucide-react';

import { enrollmentLabel, useMyEnrollment } from '@/components/teaching/queries';
import { useStudentTimetable } from '@/components/timetables/queries';
import { TodayAndWeek, type Lesson } from '@/components/timetables/timetable-ui';
import { errorMessage } from '@/components/students/format';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { PageShell } from '@/components/ui/page-shell';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/use-auth';

export default function StudentTimetablePage() {
  const { user } = useAuth();
  const enrollment = useMyEnrollment(user?.id ?? '');
  const timetable = useStudentTimetable(enrollment.data);

  const lessons = React.useMemo<Lesson[]>(
    () =>
      (timetable.data ?? []).map((s, i) => ({
        id: `${s.id}-${i}`,
        day: (s.day_of_week || '').toLowerCase(),
        start: s.start_time,
        end: s.end_time,
        title: s.subject_name || s.name || 'Lesson',
        detail: [s.teacher_name, s.subject_name && s.name && s.name !== s.subject_name ? s.name : '']
          .filter(Boolean)
          .join(' · '),
      })),
    [timetable.data]
  );

  const className = enrollmentLabel(enrollment.data);
  const loading = !user?.id || enrollment.isLoading || (Boolean(enrollment.data) && timetable.isLoading);
  const failed = enrollment.isError || timetable.isError;

  return (
    <PageShell title="My timetable" description={className ? `The lessons of ${className}.` : undefined}>
      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
      ) : failed ? (
        <EmptyState
          icon={CalendarX}
          description={`${errorMessage(enrollment.error ?? timetable.error, "Your timetable didn't load.")} Check your connection and try again.`}
          action={
            <Button
              variant="outline"
              onClick={() => {
                void enrollment.refetch();
                void timetable.refetch();
              }}
            >
              Try again
            </Button>
          }
        />
      ) : !enrollment.data ? (
        <EmptyState icon={CalendarDays} description="You aren't in a class this year yet. Ask the school office to enroll you." />
      ) : lessons.length === 0 ? (
        <EmptyState icon={CalendarDays} description="Your class has no timetable yet. Check again later." />
      ) : (
        <TodayAndWeek lessons={lessons} />
      )}
    </PageShell>
  );
}
