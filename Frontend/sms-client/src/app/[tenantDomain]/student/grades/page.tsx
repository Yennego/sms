'use client';

// My results (phase4-design.md section 5): the signed-in student's PUBLISHED results for a school
// year. Summary first (phone), then one card per subject, then the full report card and Print.
import * as React from 'react';
import { AlertTriangle, CalendarX, RotateCcw } from 'lucide-react';

import { ResultsSkeleton, ResultsView } from '@/components/results/results-view';
import { useResultYears, YearSelect } from '@/components/results/year-select';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { PageShell } from '@/components/ui/page-shell';
import { useAuth } from '@/hooks/use-auth';

function MyResultsScreen() {
  const { user } = useAuth();
  const { years, yearId, setYearId, isLoading, isError, refetch } = useResultYears();

  let content: React.ReactNode;
  if (isLoading) {
    content = <ResultsSkeleton />;
  } else if (isError) {
    content = (
      <EmptyState
        icon={AlertTriangle}
        title="Results did not load"
        description="Check your internet connection and try again."
        action={
          <Button variant="outline" onClick={refetch}>
            <RotateCcw aria-hidden="true" /> Try again
          </Button>
        }
      />
    );
  } else if (!yearId) {
    content = (
      <EmptyState icon={CalendarX} title="No school year yet" description="Your school has not set up a school year yet." />
    );
  } else {
    content = (
      <>
        <YearSelect years={years} value={yearId} onChange={setYearId} />
        <ResultsView
          studentId={user?.id}
          yearId={yearId}
          emptyMessage="Your results appear here when your school publishes them."
        />
      </>
    );
  }

  return (
    <PageShell title="My results" description="Your marks, once your school publishes them.">
      {content}
    </PageShell>
  );
}

export default function StudentGradesPage() {
  return (
    <React.Suspense fallback={<ResultsSkeleton />}>
      <MyResultsScreen />
    </React.Suspense>
  );
}
