'use client';

// One timetable's week: a time-by-day grid on desk (and on paper), day by day on a phone.

import * as React from 'react';
import { CalendarDays, Printer } from 'lucide-react';

import {
  dayLabel,
  daysToShow,
  LessonList,
  TimetablePrintStyles,
  WeekGrid,
  type Lesson,
} from '@/components/timetables/timetable-ui';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { useTenant } from '@/hooks/use-tenant';
import type { Timetable } from '@/services/api/timetable-service';

import { timetableClassName } from './TimetableList';

interface Props {
  timetable: Timetable | null;
  onClose: () => void;
}

export default function TimetableScheduleView({ timetable, onClose }: Props) {
  const { tenant } = useTenant();

  const lessons = React.useMemo<Lesson[]>(
    () =>
      (timetable?.time_slots ?? []).map((s, i) => ({
        id: `${s.id}-${i}`,
        day: (s.day_of_week || '').toLowerCase(),
        start: s.start_time,
        end: s.end_time,
        title: s.subject_name || s.name || 'Lesson',
        detail: s.teacher_name || undefined,
      })),
    [timetable]
  );

  if (!timetable) return null;
  const subtitle = [timetableClassName(timetable), timetable.academic_year].filter(Boolean).join(' · ');

  return (
    <Dialog open={Boolean(timetable)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
        <TimetablePrintStyles />
        <div className="timetable-print space-y-4">
          <DialogHeader>
            {tenant?.name ? <p className="text-sm text-muted-foreground">{tenant.name}</p> : null}
            <DialogTitle className="text-xl font-semibold text-foreground">{timetable.name}</DialogTitle>
            <DialogDescription>{subtitle}</DialogDescription>
          </DialogHeader>

          {lessons.length === 0 ? (
            <EmptyState icon={CalendarDays} description="This timetable has no lessons yet. Edit it to add them." />
          ) : (
            <>
              <div className="hidden md:block print:block">
                <WeekGrid lessons={lessons} />
              </div>
              <div className="space-y-4 md:hidden print:hidden">
                {daysToShow(lessons).map((d) => {
                  const dayLessons = lessons.filter((l) => l.day === d);
                  return (
                    <section key={d} className="space-y-2" aria-label={dayLabel(d)}>
                      <h3 className="font-semibold">{dayLabel(d)}</h3>
                      {dayLessons.length === 0 ? (
                        <p className="rounded-xl border border-dashed px-4 py-3 text-sm text-muted-foreground">No lessons</p>
                      ) : (
                        <LessonList lessons={dayLessons} />
                      )}
                    </section>
                  );
                })}
              </div>
            </>
          )}

          <div className="no-print flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <Button variant="outline" className="min-h-11 md:min-h-9" onClick={onClose}>
              Close
            </Button>
            {lessons.length > 0 ? (
              <Button className="min-h-11 md:min-h-9" onClick={() => window.print()}>
                <Printer aria-hidden="true" />
                Print or save as PDF
              </Button>
            ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
