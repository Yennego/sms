'use client';

// Child results (phase4-design.md section 5): a parent picks one of their linked children
// (kept in ?child=) and sees that child's PUBLISHED results: summary, subject cards, full
// report card and Print. Phone-first, short words, big buttons.
import * as React from 'react';
import { AlertTriangle, CalendarX, RotateCcw, UserRound, Users } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

import { resultsKeys, useSchoolKey } from '@/components/report-cards/queries';
import { ResultsSkeleton, ResultsView } from '@/components/results/results-view';
import { useUrlParam } from '@/components/results/use-url-param';
import { useResultYears, YearSelect } from '@/components/results/year-select';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { PageShell } from '@/components/ui/page-shell';
import { cn } from '@/lib/utils';
import { useDailyAttendanceService } from '@/services/api/daily-attendance-service';
import type { ChildSummary } from '@/types/daily-attendance';

function useMyChildren() {
  const { getMyChildren } = useDailyAttendanceService();
  const school = useSchoolKey();
  return useQuery<ChildSummary[]>({
    queryKey: [...resultsKeys.all(school), 'my-children'],
    queryFn: () => getMyChildren(),
    enabled: Boolean(school),
    staleTime: 5 * 60 * 1000,
  });
}

function ChildSwitcher({
  items,
  value,
  onChange,
}: {
  items: ChildSummary[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div role="group" aria-label="Choose a child" className="flex flex-wrap gap-2">
      {items.map((c) => {
        const selected = c.student_id === value;
        return (
          <button
            key={c.student_id}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(c.student_id)}
            className={cn(
              'inline-flex min-h-11 max-w-full items-center gap-2 rounded-full border px-4 text-base font-medium outline-none transition-colors',
              'focus-visible:ring-[3px] focus-visible:ring-ring/50',
              selected
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-input bg-background text-foreground hover:bg-accent'
            )}
          >
            <UserRound className="size-4 shrink-0" aria-hidden="true" />
            <span className="truncate">{c.name}</span>
          </button>
        );
      })}
    </div>
  );
}

function RetryState({ onRetry }: { onRetry: () => void }) {
  return (
    <EmptyState
      icon={AlertTriangle}
      title="Results did not load"
      description="Check your internet connection and try again."
      action={
        <Button variant="outline" onClick={onRetry}>
          <RotateCcw aria-hidden="true" /> Try again
        </Button>
      }
    />
  );
}

function ParentResultsScreen() {
  const childrenQuery = useMyChildren();
  const kids = React.useMemo(() => childrenQuery.data ?? [], [childrenQuery.data]);
  const [childParam, setChildParam] = useUrlParam('child');
  const childId = kids.some((c) => c.student_id === childParam) ? childParam : (kids[0]?.student_id ?? '');
  const child = kids.find((c) => c.student_id === childId);

  const { years, yearId, setYearId, isLoading: yearsLoading, isError: yearsError, refetch: refetchYears } =
    useResultYears();

  let content: React.ReactNode;
  if (childrenQuery.isLoading || yearsLoading) {
    content = <ResultsSkeleton />;
  } else if (childrenQuery.isError) {
    content = <RetryState onRetry={() => void childrenQuery.refetch()} />;
  } else if (kids.length === 0) {
    content = (
      <EmptyState
        icon={Users}
        title="No children linked"
        description="No children are linked to your account. Please ask the school office."
      />
    );
  } else if (yearsError) {
    content = <RetryState onRetry={refetchYears} />;
  } else if (!yearId) {
    content = (
      <EmptyState icon={CalendarX} title="No school year yet" description="The school has not set up a school year yet." />
    );
  } else {
    content = (
      <>
        {kids.length > 1 ? <ChildSwitcher items={kids} value={childId} onChange={(id) => setChildParam(id)} /> : null}
        <YearSelect years={years} value={yearId} onChange={setYearId} />
        <ResultsView
          key={childId}
          studentId={childId}
          yearId={yearId}
          emptyMessage="Results appear here when the school publishes them."
        />
      </>
    );
  }

  return (
    <PageShell
      title="Results"
      description={
        child
          ? `${child.name}${child.class_name ? ` · ${child.class_name}` : ''}`
          : 'Your child’s marks, once the school publishes them.'
      }
    >
      {content}
    </PageShell>
  );
}

export default function ParentResultsPage() {
  return (
    <React.Suspense fallback={<ResultsSkeleton />}>
      <ParentResultsScreen />
    </React.Suspense>
  );
}
