'use client';

// The school's home for the admin and the principal (design brief section 6: "Admin home with setup
// checklist and today's numbers"): today's attendance and what is waiting, the school at a glance,
// and the school year's setup checklist with a link to whatever is still to do.

import * as React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowRight, CalendarDays, CheckCircle2, ClipboardCheck, FileText } from 'lucide-react';

import { CountTiles, DayNotices, rate, useAttendanceAccess } from '@/components/attendance/attendance-ui';
import { useAttendanceOverview } from '@/components/attendance/queries';
import { errorMessage, formatDate, isoDay } from '@/components/students/format';
import { useCurrentYear } from '@/components/students/queries';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { PageShell } from '@/components/ui/page-shell';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/ui/status-badge';
import { STEPS, completedCount } from '@/components/year-setup/steps';
import { useYearSetup } from '@/components/year-setup/use-year-setup';
import { useTenant } from '@/hooks/use-tenant';
import { useTenantFeatures } from '@/hooks/use-tenant-features';
import { useAdminDashboardStats } from '@/hooks/queries/dashboard';

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
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

function LinkButton({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Button asChild variant="outline" size="sm" className="min-h-11 md:min-h-9">
      <Link href={href}>
        {children}
        <ArrowRight aria-hidden="true" />
      </Link>
    </Button>
  );
}

function TodaySection({ base }: { base: string }) {
  const { runsSchool } = useAttendanceAccess();
  const overview = useAttendanceOverview('');
  const data = overview.data;

  return (
    <Section title="Today" action={<LinkButton href={`${base}/attendance`}>Open attendance</LinkButton>}>
      {overview.isLoading ? (
        <Skeleton className="h-28 w-full rounded-xl" />
      ) : overview.isError || !data ? (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage(overview.error, "Today's attendance didn't load.")} Reload the page to try again.
        </p>
      ) : (
        <>
          <DayNotices day={data.day} />
          {runsSchool && data.pending_excuses > 0 ? (
            <Link
              href={`${base}/attendance/excuses`}
              className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 hover:bg-amber-100"
            >
              <span className="flex items-center gap-3">
                <FileText className="size-5 shrink-0" aria-hidden="true" />
                {data.pending_excuses} absence {data.pending_excuses === 1 ? 'excuse is' : 'excuses are'} waiting for review
              </span>
              <span className="font-semibold">Review</span>
            </Link>
          ) : null}
          {data.day.is_school_day ? (
            <CountTiles
              className="lg:grid-cols-5"
              tiles={[
                { label: 'Present', value: data.totals.present, status: 'present' },
                { label: 'Late', value: data.totals.late, status: 'late' },
                { label: 'Absent', value: data.totals.absent, status: 'absent' },
                { label: 'Not marked yet', value: data.totals.unmarked, status: data.totals.unmarked ? 'pending' : undefined },
                { label: 'Attendance rate', value: rate(data.totals.attendance_rate) },
              ]}
            />
          ) : null}
        </>
      )}
    </Section>
  );
}

function SchoolSection({ base }: { base: string }) {
  // The numbers change slowly: once a minute is plenty (it used to poll every 3 seconds)
  const stats = useAdminDashboardStats({ refetchInterval: 60 * 1000 });
  const s = stats.data;
  return (
    <Section title="The school" action={<LinkButton href={`${base}/students`}>Open students</LinkButton>}>
      {stats.isLoading ? (
        <Skeleton className="h-28 w-full rounded-xl" />
      ) : stats.isError || !s ? (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage(stats.error, "The school's numbers didn't load.")} Reload the page to try again.
        </p>
      ) : (
        <CountTiles
          tiles={[
            {
              label: 'Students',
              value: (
                <>
                  {s.students.active}
                  {s.students.new_this_month ? (
                    <span className="ml-2 text-sm font-normal text-muted-foreground">+{s.students.new_this_month} this month</span>
                  ) : null}
                </>
              ),
            },
            { label: 'Teachers', value: s.teachers.active },
            { label: 'Classes', value: s.classes.active },
            { label: 'Signed in recently', value: s.users.recent_logins },
          ]}
        />
      )}
    </Section>
  );
}

function SetupSection({ base }: { base: string }) {
  const year = useCurrentYear();
  const setup = useYearSetup(year.data?.id ?? null);
  const { isFeatureEnabled } = useTenantFeatures();

  if (year.isLoading || (year.data && setup.isLoading)) {
    return (
      <Section title="School year">
        <Skeleton className="h-40 w-full rounded-xl" />
      </Section>
    );
  }
  if (!year.data) {
    return (
      <Section title="School year">
        <EmptyState
          icon={CalendarDays}
          title="No current school year"
          description="Create the school year and mark it current, then set it up step by step."
          action={
            <Button asChild>
              <Link href={`${base}/academics/academic-years`}>Set up the school year</Link>
            </Button>
          }
        />
      </Section>
    );
  }
  // The principal and admins can open the setup; others see the year only
  if (setup.isError || !setup.data) {
    return (
      <Section title={`School year ${year.data.name}`}>
        <p className="text-sm text-muted-foreground">
          {formatDate(year.data.start_date)} to {formatDate(year.data.end_date)}
        </p>
      </Section>
    );
  }

  const data = setup.data;
  const done = completedCount(data);
  const extras = [
    { href: `${base}/academics/grading-schemas`, label: 'Grading settings', hint: 'How tests, quizzes and exams count.' },
    ...(isFeatureEnabled('enable_finance')
      ? [{ href: `${base}/finance/structures`, label: 'Fee setup', hint: 'Fee amounts and due dates for this year.' }]
      : []),
    ...(isFeatureEnabled('enable_attendance')
      ? [{ href: `${base}/attendance/id-cards`, label: 'ID cards', hint: 'Student cards for gate scanning.' }]
      : []),
  ];

  return (
    <Section
      title={`School year ${data.year.name}`}
      action={
        done < STEPS.length ? (
          <StatusBadge status="pending" label={`${done} of ${STEPS.length} steps done`} size="md" />
        ) : (
          <StatusBadge status="success" label="Set up" size="md" />
        )
      }
    >
      <ol className="divide-y rounded-xl border bg-card">
        {STEPS.map((step, i) => {
          const complete = data.steps[step.key].complete;
          return (
            <li key={step.key} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="flex min-w-0 items-start gap-3">
                <span
                  className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold"
                  aria-hidden="true"
                >
                  {complete ? <CheckCircle2 className="size-4 text-green-700" /> : i + 1}
                </span>
                <div className="min-w-0">
                  <p className="font-medium">{step.title}</p>
                  <p className="text-sm text-muted-foreground">{step.description}</p>
                </div>
              </div>
              {complete ? (
                <StatusBadge status="success" label="Done" />
              ) : (
                <LinkButton href={`${base}/academics/setup?year=${data.year.id}&step=${step.key}`}>Do this step</LinkButton>
              )}
            </li>
          );
        })}
      </ol>
      {done === STEPS.length ? (
        <div className="grid gap-3 sm:grid-cols-3">
          {extras.map((x) => (
            <Link
              key={x.href}
              href={x.href}
              className="flex min-h-11 flex-col rounded-xl border bg-card p-4 hover:bg-muted/50"
            >
              <span className="font-medium">{x.label}</span>
              <span className="text-sm text-muted-foreground">{x.hint}</span>
            </Link>
          ))}
        </div>
      ) : null}
    </Section>
  );
}

export default function AdminDashboard() {
  const { tenantDomain } = useParams<{ tenantDomain: string }>();
  const { tenant } = useTenant();
  const { isFeatureEnabled, isLoading: featuresLoading } = useTenantFeatures();
  const { viewsSchool } = useAttendanceAccess();
  const base = `/${tenantDomain}`;
  const showToday = !featuresLoading && isFeatureEnabled('enable_attendance') && viewsSchool;

  return (
    <PageShell
      title="Home"
      description={[tenant?.name, formatDate(isoDay(new Date()))].filter(Boolean).join(' · ')}
      primaryAction={
        showToday ? (
          <Button asChild className="min-h-11 md:min-h-9">
            <Link href={`${base}/attendance`}>
              <ClipboardCheck aria-hidden="true" />
              Today&apos;s attendance
            </Link>
          </Button>
        ) : undefined
      }
    >
      {showToday ? <TodaySection base={base} /> : null}
      <SchoolSection base={base} />
      <SetupSection base={base} />
    </PageShell>
  );
}
