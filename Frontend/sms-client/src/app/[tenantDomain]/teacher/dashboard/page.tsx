'use client';

// The teacher's home (design brief section 6, phone first): their class today with the way to mark
// it, today's lessons, and what is waiting for them (marks to enter, assignments).

import * as React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, BookOpen, CalendarDays, ClipboardCheck } from 'lucide-react';

import { CountTiles, DayNotices } from '@/components/attendance/attendance-ui';
import { useAttendanceClasses, useClassRoster } from '@/components/attendance/queries';
import { errorMessage, formatDate, isoDay } from '@/components/students/format';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { PageShell } from '@/components/ui/page-shell';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/ui/status-badge';
import { useAuth } from '@/hooks/use-auth';
import { useTenant } from '@/hooks/use-tenant';
import { useTenantFeatures } from '@/hooks/use-tenant-features';
import { useDashboardService } from '@/services/api/dashboard-service';
import { useTeacherService } from '@/services/api/teacher-service';
import { useTimetableService, type Timetable } from '@/services/api/timetable-service';

interface Lesson {
  id: string;
  start: string;
  time: string;
  subject: string;
  className: string;
}

const hhmm = (t: string) => (t || '').slice(0, 5);

/** The teacher's slots on today's weekday, earliest first (a slot's class_id is the subject assignment). */
function lessonsToday(timetables: Timetable[], assignmentIds: Set<string>, teacherId: string): Lesson[] {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
  const seen = new Set<string>();
  const lessons: Lesson[] = [];
  for (const t of timetables) {
    if (!t.is_active || seen.has(t.id)) continue; // the teacher filter can return a timetable twice
    seen.add(t.id);
    for (const slot of t.time_slots) {
      if ((slot.day_of_week || '').toLowerCase() !== today) continue;
      const mine = (slot.class_id && assignmentIds.has(slot.class_id)) || slot.teacher_id === teacherId;
      if (!mine) continue;
      lessons.push({
        id: slot.id,
        start: slot.start_time,
        time: `${hhmm(slot.start_time)} to ${hhmm(slot.end_time)}`,
        subject: slot.subject_name || slot.name,
        className: [t.grade_name, t.section_name].filter(Boolean).join(' - ') || t.name,
      });
    }
  }
  return lessons.sort((a, b) => a.start.localeCompare(b.start));
}

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="space-y-3" aria-label={title}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function MoreLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Button asChild variant="outline" size="sm" className="min-h-11 md:min-h-9">
      <Link href={href}>
        {children}
        <ArrowRight aria-hidden="true" />
      </Link>
    </Button>
  );
}

/** Today in one class the teacher sponsors. */
function ClassToday({ classId, name, href }: { classId: string; name: string; href: string }) {
  const roster = useClassRoster(classId, '');
  const data = roster.data;
  if (roster.isLoading) return <Skeleton className="h-28 w-full rounded-xl" />;
  if (roster.isError || !data) {
    return (
      <p role="alert" className="text-sm text-destructive">
        {errorMessage(roster.error, `${name} didn't load.`)} Reload the page to try again.
      </p>
    );
  }
  const count = (...statuses: string[]) => data.entries.filter((e) => e.record && statuses.includes(e.record.status)).length;
  const unmarked = data.entries.filter((e) => !e.record).length;
  return (
    <div className="space-y-3 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-medium">{data.class_name ?? name}</p>
        {data.day.is_school_day ? (
          unmarked > 0 ? (
            <StatusBadge status="pending" label={`${unmarked} not marked yet`} />
          ) : (
            <StatusBadge status="success" label="Everyone is marked" />
          )
        ) : null}
      </div>
      <DayNotices day={data.day} />
      {data.day.is_school_day ? (
        <>
          <CountTiles
            className="grid-cols-2 sm:grid-cols-4 lg:grid-cols-4"
            tiles={[
              { label: 'Present', value: count('present', 'tardy'), status: 'present' },
              { label: 'Late', value: count('late'), status: 'late' },
              { label: 'Absent', value: count('absent'), status: 'absent' },
              { label: 'Excused or sick', value: count('excused', 'sick'), status: 'excused' },
            ]}
          />
          <Button asChild className="min-h-11 w-full sm:w-auto md:min-h-9">
            <Link href={href}>
              <ClipboardCheck aria-hidden="true" />
              {unmarked > 0 ? 'Mark my class' : 'Open my class'}
            </Link>
          </Button>
        </>
      ) : null}
    </div>
  );
}

export default function TeacherHomePage() {
  const { tenantDomain } = useParams<{ tenantDomain: string }>();
  const base = `/${tenantDomain}`;
  const { user } = useAuth();
  const { tenant } = useTenant();
  const dashboardService = useDashboardService();
  const { getTeacherAssignments } = useTeacherService();
  const { getTimetables } = useTimetableService();
  const features = useTenantFeatures();
  const timetableOn = !features.isLoading && features.isFeatureEnabled('enable_timetable');
  const attendanceOn = !features.isLoading && features.isFeatureEnabled('enable_attendance');
  const homeworkOn = !features.isLoading && features.isFeatureEnabled('enable_homework');

  const sponsored = useAttendanceClasses(user?.id, Boolean(user?.id) && attendanceOn);
  const stats = useQuery({
    queryKey: ['dashboard-stats', tenant?.id, user?.id],
    queryFn: () => dashboardService.getStats(),
    enabled: Boolean(user?.id),
  });
  const lessons = useQuery({
    queryKey: ['teacher-today-lessons', tenant?.id, user?.id],
    queryFn: async () => {
      const teacherId = user?.id as string;
      const [assignments, timetables] = await Promise.all([
        getTeacherAssignments(teacherId),
        getTimetables({ teacher_id: teacherId }),
      ]);
      return lessonsToday(timetables, new Set(assignments.map((a: { id: string }) => a.id)), teacherId);
    },
    enabled: Boolean(user?.id) && timetableOn,
  });

  const t = stats.data?.teacher_stats;
  const myClasses = sponsored.data ?? [];

  return (
    <PageShell
      title={user?.firstName ? `Hello, ${user.firstName}` : 'Home'}
      description={[tenant?.name, formatDate(isoDay(new Date()))].filter(Boolean).join(' · ')}
      primaryAction={
        <Button asChild variant={attendanceOn && myClasses.length ? 'outline' : 'default'} className="min-h-11 md:min-h-9">
          <Link href={`${base}/academics/gradebook`}>
            <BookOpen aria-hidden="true" />
            Open gradebook
          </Link>
        </Button>
      }
    >
      {attendanceOn && (sponsored.isLoading || myClasses.length > 0) ? (
        <Section title="My class today">
          {sponsored.isLoading ? (
            <Skeleton className="h-28 w-full rounded-xl" />
          ) : (
            myClasses.map((c) => (
              <ClassToday
                key={c.id}
                classId={c.id}
                name={c.name}
                href={`${base}/teacher/attendance?classId=${c.id}`}
              />
            ))
          )}
        </Section>
      ) : null}

      {timetableOn ? (
        <Section title="Today's lessons" action={<MoreLink href={`${base}/academics/timetables`}>Full timetable</MoreLink>}>
          {lessons.isLoading ? (
            <Skeleton className="h-24 w-full rounded-xl" />
          ) : lessons.isError ? (
            <p role="alert" className="text-sm text-destructive">
              {errorMessage(lessons.error, "Today's lessons didn't load.")} Reload the page to try again.
            </p>
          ) : (lessons.data ?? []).length === 0 ? (
            <EmptyState icon={CalendarDays} description="You have no lessons on the timetable today." />
          ) : (
            <ol className="divide-y rounded-xl border bg-card">
              {(lessons.data ?? []).map((l) => (
                <li key={l.id} className="flex items-center gap-4 px-4 py-3">
                  <span className="w-28 shrink-0 text-sm tabular-nums text-muted-foreground">{l.time}</span>
                  <div className="min-w-0">
                    <p className="truncate font-medium">{l.subject}</p>
                    <p className="text-sm text-muted-foreground">{l.className}</p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Section>
      ) : null}

      <Section
        title="My work"
        action={homeworkOn ? <MoreLink href={`${base}/academics/assignments`}>Assignments</MoreLink> : undefined}
      >
        {stats.isLoading ? (
          <Skeleton className="h-28 w-full rounded-xl" />
        ) : stats.isError ? (
          <p role="alert" className="text-sm text-destructive">
            {errorMessage(stats.error, "Your numbers didn't load.")} Reload the page to try again.
          </p>
        ) : (
          <CountTiles
            tiles={[
              { label: 'Classes I teach', value: t?.assigned_classes ?? 0 },
              { label: 'Students', value: t?.total_students ?? 0 },
              {
                label: 'Marks to enter',
                value: t?.pending_grades ?? 0,
                status: t?.pending_grades ? 'pending' : undefined,
              },
              ...(homeworkOn ? [{ label: 'Open assignments', value: t?.active_assignments ?? 0 }] : []),
            ]}
          />
        )}
      </Section>
    </PageShell>
  );
}
