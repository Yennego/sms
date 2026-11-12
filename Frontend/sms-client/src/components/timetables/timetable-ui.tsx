'use client';

// Shared pieces of the Timetable area: weekday names, lesson lists, and the phone-first "today, then
// the week" view used by the student's and the teacher's timetables.

import * as React from 'react';
import { CalendarDays } from 'lucide-react';

import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/utils';

export const WEEKDAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;

export function dayLabel(day: string): string {
  const d = (day || '').toLowerCase();
  return d ? d.charAt(0).toUpperCase() + d.slice(1) : '';
}

/** "08:00" from "08:00:00". */
export const hhmm = (t?: string | null) => (t || '').slice(0, 5);

/** Today's weekday ("monday") in the browser's time zone. */
export function todayKey(): string {
  return new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
}

export interface Lesson {
  id: string;
  /** "monday" … "sunday" */
  day: string;
  start: string;
  end: string;
  title: string;
  /** Second line, e.g. the teacher or the class */
  detail?: string;
}

const byStart = (a: Lesson, b: Lesson) => a.start.localeCompare(b.start);

/** Monday to Friday, plus Saturday and Sunday when they have lessons. */
export function daysToShow(lessons: Lesson[]): string[] {
  const used = new Set(lessons.map((l) => l.day));
  return WEEKDAYS.filter((d, i) => i < 5 || used.has(d));
}

export function LessonList({ lessons, className }: { lessons: Lesson[]; className?: string }) {
  return (
    <ol className={cn('divide-y rounded-xl border bg-card', className)}>
      {[...lessons].sort(byStart).map((l) => (
        <li key={l.id} className="flex items-start gap-4 px-4 py-3">
          <span className="w-28 shrink-0 pt-0.5 text-sm tabular-nums text-muted-foreground">
            {hhmm(l.start)} to {hhmm(l.end)}
          </span>
          <div className="min-w-0">
            <p className="font-medium">{l.title}</p>
            {l.detail ? <p className="text-sm text-muted-foreground">{l.detail}</p> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

/** The week as a time-by-day grid (desk and paper). */
export function WeekGrid({ lessons }: { lessons: Lesson[] }) {
  const days = daysToShow(lessons);
  const periods = [...new Set(lessons.map((l) => `${hhmm(l.start)}|${hhmm(l.end)}`))].sort();
  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">Lessons by time and day</caption>
        <thead className="bg-muted/50">
          <tr>
            <th scope="col" className="w-28 border-b p-2 text-left font-medium">
              Time
            </th>
            {days.map((d) => (
              <th key={d} scope="col" className="border-b border-l p-2 text-left font-medium">
                {dayLabel(d)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {periods.map((p) => {
            const [start, end] = p.split('|');
            return (
              <tr key={p} className="align-top">
                <th scope="row" className="border-b p-2 text-left font-normal tabular-nums text-muted-foreground">
                  {start} to {end}
                </th>
                {days.map((d) => (
                  <td key={d} className="border-b border-l p-2">
                    {lessons
                      .filter((l) => l.day === d && hhmm(l.start) === start && hhmm(l.end) === end)
                      .map((l) => (
                        <div key={l.id}>
                          <p className="font-medium">{l.title}</p>
                          {l.detail ? <p className="text-muted-foreground">{l.detail}</p> : null}
                        </div>
                      ))}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Printing: only what is inside `.timetable-print` goes on paper (the app's menus and bars don't).
 * Elements marked `.no-print` inside it are left out too.
 */
export function TimetablePrintStyles() {
  return (
    <style jsx global>{`
      @media print {
        body * {
          visibility: hidden;
        }
        .timetable-print,
        .timetable-print * {
          visibility: visible;
        }
        .timetable-print {
          position: absolute;
          inset: 0 auto auto 0;
          width: 100%;
          padding: 16px;
        }
        .timetable-print .no-print {
          display: none !important;
        }
      }
    `}</style>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3" aria-label={title}>
      <h2 className="text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

/** Today's lessons first, then the whole week day by day. */
export function TodayAndWeek({ lessons }: { lessons: Lesson[] }) {
  const today = todayKey();
  const todays = lessons.filter((l) => l.day === today);
  const days = daysToShow(lessons);
  return (
    <>
      <Section title={`Today, ${dayLabel(today)}`}>
        {todays.length === 0 ? (
          <EmptyState icon={CalendarDays} description="No lessons today." />
        ) : (
          <LessonList lessons={todays} />
        )}
      </Section>
      <Section title="This week">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {days.map((day) => {
            const dayLessons = lessons.filter((l) => l.day === day);
            return (
              <div key={day} className="space-y-2">
                <h3 className={cn('text-base font-semibold', day === today && 'text-primary')}>
                  {dayLabel(day)}
                  {day === today ? <span className="ml-2 text-sm font-normal text-muted-foreground">(today)</span> : null}
                </h3>
                {dayLessons.length === 0 ? (
                  <p className="rounded-xl border border-dashed px-4 py-3 text-sm text-muted-foreground">No lessons</p>
                ) : (
                  <LessonList lessons={dayLessons} />
                )}
              </div>
            );
          })}
        </div>
      </Section>
    </>
  );
}
