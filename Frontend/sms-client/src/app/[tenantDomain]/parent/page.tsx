'use client';

// Parent home (03-app-flow.md 4.8, phase5-design.md section 6): pick a child, then one card per
// area - today's attendance, latest results, fees - plus alerts such as absences with no reason.
// Each card opens its area. Phone first: short words, big targets, status in words and icons.
import * as React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  AlertTriangle,
  CalendarCheck,
  ChevronRight,
  Clock,
  GraduationCap,
  Lock,
  Wallet,
  type LucideIcon,
} from 'lucide-react';

import { ChildSwitcher, childLine, useSelectedChild } from '@/components/parent/child-switcher';
import { InstallmentBadge, OverdueBadge } from '@/components/parent/fee-status';
import { formatDay, formatTime, moneyLines } from '@/components/parent/money';
import {
  isReportCardHeld,
  statusOf,
  useFamilyStatement,
  useFamilyStudents,
  useRecentAttendance,
  useSchoolDay,
} from '@/components/parent/queries';
import { NoChildrenState, ParentSkeleton, RetryState } from '@/components/parent/states';
import { useStudentReportCard } from '@/components/report-cards/queries';
import { hasPublishedResults, overallAverage } from '@/components/results/results-helpers';
import { PageShell } from '@/components/ui/page-shell';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge, type StatusBadgeStatus } from '@/components/ui/status-badge';
import { useCurrentAcademicYearDetail } from '@/hooks/queries/academic-years';
import { cn } from '@/lib/utils';
import { hasAmount, isZeroAmount } from '@/services/api/family-service';
import { formatScore, isFailing } from '@/services/api/results-service';
import type { DailyStatus } from '@/types/daily-attendance';

// ---------------------------------------------------------------------------
// Card frame
// ---------------------------------------------------------------------------

function HomeCard({
  href,
  icon: Icon,
  title,
  subtitle,
  children,
  className,
}: {
  href: string;
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'group flex min-h-32 min-w-0 flex-col gap-3 rounded-xl border bg-card p-4 text-card-foreground outline-none transition-colors',
        'hover:bg-accent/50 focus-visible:ring-[3px] focus-visible:ring-ring/50',
        className
      )}
    >
      <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Icon className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
        </div>
        <span className="inline-flex shrink-0 items-center gap-0.5 text-sm font-medium text-primary">
          Open <ChevronRight className="size-4" aria-hidden="true" />
        </span>
      </div>
      <div className="flex min-w-0 flex-col gap-2">{children}</div>
    </Link>
  );
}

function CardLoading() {
  return <Skeleton className="h-8 w-40 rounded-md" />;
}

function CardProblem() {
  return <p className="text-base text-muted-foreground">Could not load. Tap to open.</p>;
}

// ---------------------------------------------------------------------------
// Today
// ---------------------------------------------------------------------------

const ATTENDANCE_BADGE: Record<DailyStatus, StatusBadgeStatus> = {
  present: 'present',
  late: 'late',
  tardy: 'late',
  absent: 'absent',
  excused: 'excused',
  sick: 'sick',
};

function TodayCard({ childId, href }: { childId: string; href: string }) {
  const day = useSchoolDay();
  const history = useRecentAttendance(day.isLoading ? undefined : childId, day.today);
  const record = history.data?.records.find((r) => r.date === day.today);
  const arrived = formatTime(record?.check_in_at);

  let body: React.ReactNode;
  if (day.isLoading || history.isLoading) body = <CardLoading />;
  else if (record) {
    body = (
      <>
        <StatusBadge status={ATTENDANCE_BADGE[record.status] ?? 'neutral'} size="md" className="text-base" />
        {arrived ? <p className="text-sm text-muted-foreground">Arrived {arrived}</p> : null}
      </>
    );
  } else if (day.isSchoolDay === false) {
    body = <StatusBadge status="neutral" label="No school today" size="md" className="text-base" />;
  } else if (history.isError) body = <CardProblem />;
  else body = <StatusBadge status="neutral" icon={Clock} label="Not yet marked" size="md" className="text-base" />;

  return (
    <HomeCard href={href} icon={CalendarCheck} title="Today" subtitle={formatDay(day.today)}>
      {body}
    </HomeCard>
  );
}

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------

function ResultsCard({ childId, yearId, yearLoading, href }: { childId: string; yearId: string | undefined; yearLoading: boolean; href: string }) {
  const query = useStudentReportCard(childId, yearId);

  let body: React.ReactNode;
  if (yearLoading || (yearId && query.isLoading)) body = <CardLoading />;
  else if (query.isError && isReportCardHeld(query.error)) {
    body = (
      <>
        <StatusBadge status="warning" icon={Lock} label="Held until fees are paid" size="md" />
        <p className="text-sm text-muted-foreground">Report cards are available once the overdue balance is paid.</p>
      </>
    );
  } else if (query.isError && statusOf(query.error) !== 404) body = <CardProblem />;
  else if (!yearId || !query.data || !hasPublishedResults(query.data)) {
    body = <p className="text-base text-muted-foreground">No results published yet.</p>;
  } else {
    const card = query.data;
    const average = overallAverage(card);
    const failing = isFailing(average.value, card.pass_mark);
    body = (
      <>
        <p className="text-sm text-muted-foreground">{average.label}</p>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-3xl font-bold tabular-nums text-foreground">{formatScore(average.value)}</span>
          {average.value !== null ? (
            <StatusBadge
              status={failing ? 'danger' : 'success'}
              label={failing ? 'Below pass mark' : 'Passing'}
              size="md"
            />
          ) : null}
        </div>
      </>
    );
  }

  return (
    <HomeCard href={href} icon={GraduationCap} title="Results">
      {body}
    </HomeCard>
  );
}

// ---------------------------------------------------------------------------
// Fees
// ---------------------------------------------------------------------------

function FeesCard({ childId, yearId, yearLoading, href }: { childId: string; yearId: string | undefined; yearLoading: boolean; href: string }) {
  const students = useFamilyStudents();
  // Wait for the current year so the statement is fetched once.
  const statement = useFamilyStatement(yearLoading ? undefined : childId, yearId);
  const entry = students.data?.find((s) => s.student_id === childId);

  let body: React.ReactNode;
  if (students.isLoading) body = <CardLoading />;
  else if (students.isError) {
    const status = statusOf(students.error);
    body =
      status === 404 || status === 403 ? (
        <p className="text-base text-muted-foreground">Fees are not shown yet.</p>
      ) : (
        <CardProblem />
      );
  } else if (!entry) body = <p className="text-base text-muted-foreground">No fees for this child yet.</p>;
  else {
    const balance = moneyLines(entry.balance, entry.currency);
    const overdue = moneyLines(entry.overdue, entry.currency).filter((l) => !isZeroAmount(entry.overdue[l.currency]));
    const next = statement.data?.installments.find((i) => i.status !== 'paid');
    const nextAmount = next ? moneyLines(hasAmount(next.outstanding) ? next.outstanding : next.amount, statement.data?.currency ?? entry.currency) : [];
    body = (
      <>
        {balance.length === 0 || !hasAmount(entry.balance) ? (
          <StatusBadge status="success" label="Nothing to pay" size="md" />
        ) : (
          <div>
            <p className="text-sm text-muted-foreground">Balance</p>
            {balance.map((b) => (
              <p key={b.currency} className="text-2xl font-bold tabular-nums break-words text-foreground">
                {b.text}
              </p>
            ))}
            {!entry.currency && balance.length > 1 ? (
              <p className="text-xs text-muted-foreground">Pay in one currency. The first payment sets it.</p>
            ) : null}
          </div>
        )}
        {overdue.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            <OverdueBadge />
            <span className="text-base font-semibold tabular-nums text-red-800">
              {overdue.map((o) => o.text).join(' / ')}
            </span>
          </div>
        ) : null}
        {next && nextAmount.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2 text-sm text-foreground">
            <InstallmentBadge status={next.status} size="sm" />
            <span>
              {next.status === 'overdue' ? 'Was due' : 'Next'} {formatDay(next.due_date)}:{' '}
              <span className="font-semibold tabular-nums">{nextAmount.map((a) => a.text).join(' / ')}</span>
            </span>
          </div>
        ) : null}
      </>
    );
  }

  return (
    <HomeCard href={href} icon={Wallet} title="Fees">
      {body}
    </HomeCard>
  );
}

// ---------------------------------------------------------------------------
// Alerts
// ---------------------------------------------------------------------------

function AbsenceAlert({ childId, href }: { childId: string; href: string }) {
  const day = useSchoolDay();
  const history = useRecentAttendance(day.isLoading ? undefined : childId, day.today);
  const unexcused = (history.data?.records ?? []).filter((r) => r.status === 'absent' && !r.excuse_status);
  if (unexcused.length === 0) return null;
  const days = unexcused.length === 1 ? '1 day' : `${unexcused.length} days`;
  return (
    <Link
      href={href}
      className="flex min-h-11 items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-900 outline-none transition-colors hover:bg-red-100 focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      <AlertTriangle className="size-6 shrink-0" aria-hidden="true" />
      <span className="min-w-0 flex-1 text-base font-semibold">
        Absent without excuse on {days}: report a reason
      </span>
      <ChevronRight className="size-5 shrink-0" aria-hidden="true" />
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

function ParentHomeScreen() {
  const { tenantDomain } = useParams<{ tenantDomain: string }>();
  const { query, kids, childId, child, setChildId } = useSelectedChild();
  const year = useCurrentAcademicYearDetail();
  const yearId = year.data?.id;

  const base = `/${tenantDomain}/parent`;
  const withChild = (path: string) => `${base}${path}?child=${encodeURIComponent(childId)}`;

  let content: React.ReactNode;
  if (query.isLoading) content = <ParentSkeleton label="Loading your children" />;
  else if (query.isError) content = <RetryState what="Your children" onRetry={() => void query.refetch()} />;
  else if (kids.length === 0) content = <NoChildrenState />;
  else {
    content = (
      <>
        <ChildSwitcher items={kids} value={childId} onChange={setChildId} />
        <section aria-label="Alerts" className="empty:hidden">
          <AbsenceAlert key={`alert-${childId}`} childId={childId} href={withChild('/attendance')} />
        </section>
        <div className="grid min-w-0 gap-3 sm:grid-cols-2">
          <TodayCard key={`today-${childId}`} childId={childId} href={withChild('/attendance')} />
          <ResultsCard
            key={`results-${childId}`}
            childId={childId}
            yearId={yearId}
            yearLoading={year.isLoading}
            href={withChild('/results')}
          />
          <FeesCard
            key={`fees-${childId}`}
            childId={childId}
            yearId={yearId}
            yearLoading={year.isLoading}
            href={withChild('/fees')}
          />
        </div>
      </>
    );
  }

  return (
    <PageShell title="Home" description={childLine(child) ?? 'Your children at school.'}>
      {content}
    </PageShell>
  );
}

export default function ParentHomePage() {
  return (
    <React.Suspense fallback={<ParentSkeleton />}>
      <ParentHomeScreen />
    </React.Suspense>
  );
}
