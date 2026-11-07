'use client';

// The student's home (phone first): today's attendance, work due soon, and the way to their
// results, courses and timetable.

import * as React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Award, BookOpen, CalendarDays, CheckCircle2, FileText } from 'lucide-react';

import { CountTiles, DailyStatusBadge, rate } from '@/components/attendance/attendance-ui';
import { useSchoolToday, useStudentAttendanceHistory } from '@/components/attendance/queries';
import { errorMessage, formatDate, isoDay } from '@/components/students/format';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { PageShell } from '@/components/ui/page-shell';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/use-auth';
import { useTenant } from '@/hooks/use-tenant';
import { useTenantFeatures } from '@/hooks/use-tenant-features';
import { useAssignmentService } from '@/services/api/assignment-service';
import { useDashboardService } from '@/services/api/dashboard-service';
import { useEnrollmentService } from '@/services/api/enrollment-service';
import { useSubmissionService } from '@/services/api/submission-service';

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

/** Today's mark and the year's rate, from the student's own attendance. */
function AttendanceToday({ studentId, href }: { studentId: string; href: string }) {
  const { today } = useSchoolToday();
  const history = useStudentAttendanceHistory(studentId);
  if (history.isLoading) return <Skeleton className="h-24 w-full rounded-xl" />;
  if (history.isError || !history.data) {
    return (
      <p role="alert" className="text-sm text-destructive">
        {errorMessage(history.error, "Your attendance didn't load.")} Reload the page to try again.
      </p>
    );
  }
  const todays = history.data.records.find((r) => r.date === today);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4">
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">Today</p>
        <DailyStatusBadge status={todays?.status ?? null} size="md" />
      </div>
      <div className="space-y-1 text-right">
        <p className="text-sm text-muted-foreground">This year</p>
        <p className="text-2xl font-semibold tabular-nums">{rate(history.data.summary.attendance_rate)}</p>
      </div>
      <MoreLink href={href}>My attendance</MoreLink>
    </div>
  );
}

export default function StudentHomePage() {
  const { tenantDomain } = useParams<{ tenantDomain: string }>();
  const base = `/${tenantDomain}`;
  const { user } = useAuth();
  const { tenant } = useTenant();
  const dashboardService = useDashboardService();
  const assignmentService = useAssignmentService();
  const { getMySubmissions } = useSubmissionService();
  const { getCurrentEnrollment } = useEnrollmentService();
  const features = useTenantFeatures();
  const homeworkOn = !features.isLoading && features.isFeatureEnabled('enable_homework');
  const attendanceOn = !features.isLoading && features.isFeatureEnabled('enable_attendance');
  const timetableOn = !features.isLoading && features.isFeatureEnabled('enable_timetable');

  const stats = useQuery({
    queryKey: ['dashboard-stats', tenant?.id, user?.id],
    queryFn: () => dashboardService.getStats(),
    enabled: Boolean(user?.id),
  });

  // Published assignments for the student's class, due from today on and not handed in yet
  const due = useQuery({
    queryKey: ['upcoming-assignments', tenant?.id, user?.id],
    queryFn: async () => {
      const enrollment = await getCurrentEnrollment(user?.id as string);
      if (!enrollment) return [];
      const [assignments, submissions] = await Promise.all([
        assignmentService.getAssignments({ is_published: true, grade_id: enrollment.grade_id }),
        getMySubmissions().catch(() => []),
      ]);
      const submitted = new Set(submissions.map((sub) => sub.assignment_id));
      const today = isoDay(new Date());
      return assignments
        .filter((a) => !a.section_id || a.section_id === enrollment.section_id)
        .filter((a) => a.due_date.slice(0, 10) >= today && !submitted.has(a.id))
        .sort((a, b) => a.due_date.localeCompare(b.due_date))
        .slice(0, 5);
    },
    enabled: Boolean(user?.id) && homeworkOn, // the school may have Homework switched off
  });

  const s = stats.data?.student_stats;

  return (
    <PageShell
      title={user?.firstName ? `Hello, ${user.firstName}` : 'Home'}
      description={[tenant?.name, formatDate(isoDay(new Date()))].filter(Boolean).join(' · ')}
      primaryAction={
        <Button asChild className="min-h-11 md:min-h-9">
          <Link href={`${base}/student/grades`}>
            <Award aria-hidden="true" />
            My results
          </Link>
        </Button>
      }
    >
      {attendanceOn && user?.id ? (
        <Section title="Attendance">
          <AttendanceToday studentId={user.id} href={`${base}/student/attendance`} />
        </Section>
      ) : null}

      {homeworkOn ? (
        <Section title="Due soon" action={<MoreLink href={`${base}/academics/assignments`}>All assignments</MoreLink>}>
          {due.isLoading ? (
            <Skeleton className="h-24 w-full rounded-xl" />
          ) : due.isError ? (
            <p role="alert" className="text-sm text-destructive">
              {errorMessage(due.error, "Your assignments didn't load.")} Reload the page to try again.
            </p>
          ) : (due.data ?? []).length === 0 ? (
            <EmptyState icon={CheckCircle2} description="Nothing is due. You're all caught up." />
          ) : (
            <ul className="divide-y rounded-xl border bg-card">
              {(due.data ?? []).map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <FileText className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <div className="min-w-0">
                      <p className="truncate font-medium">{a.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {[a.subject_name, `due ${formatDate(a.due_date)}`].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                  </div>
                  <Button asChild variant="outline" size="sm" className="min-h-11 shrink-0 md:min-h-9">
                    <Link href={`${base}/academics/assignments`}>Hand in</Link>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Section>
      ) : null}

      <Section title="My school year">
        {stats.isLoading ? (
          <Skeleton className="h-24 w-full rounded-xl" />
        ) : stats.isError ? (
          <p role="alert" className="text-sm text-destructive">
            {errorMessage(stats.error, "Your numbers didn't load.")} Reload the page to try again.
          </p>
        ) : (
          <CountTiles
            tiles={[
              { label: 'Courses', value: s?.active_courses ?? 0 },
              ...(homeworkOn
                ? [{ label: 'Work to hand in', value: s?.pending_tasks ?? 0, status: s?.pending_tasks ? ('pending' as const) : undefined }]
                : []),
            ]}
          />
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <Link href={`${base}/student/courses`} className="flex min-h-11 items-center gap-3 rounded-xl border bg-card p-4 hover:bg-muted/50">
            <BookOpen className="size-5 text-muted-foreground" aria-hidden="true" />
            <span className="font-medium">My courses</span>
          </Link>
          {timetableOn ? (
            <Link href={`${base}/student/timetable`} className="flex min-h-11 items-center gap-3 rounded-xl border bg-card p-4 hover:bg-muted/50">
              <CalendarDays className="size-5 text-muted-foreground" aria-hidden="true" />
              <span className="font-medium">My timetable</span>
            </Link>
          ) : null}
        </div>
      </Section>
    </PageShell>
  );
}
