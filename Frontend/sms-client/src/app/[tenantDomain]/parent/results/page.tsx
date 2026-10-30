'use client';

// Child results (phase4-design.md section 5): a parent picks one of their linked children
// (kept in ?child=) and sees that child's PUBLISHED results: summary, subject cards, full
// report card and Print. Phone-first, short words, big buttons. When the school holds report
// cards for unpaid fees (phase5-design.md section 1), the server answers 403 and we say so
// kindly, with a link to the Fees page.
import * as React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { CalendarX, Lock, Wallet } from 'lucide-react';

import { ChildSwitcher, childLine, useSelectedChild } from '@/components/parent/child-switcher';
import { isReportCardHeld } from '@/components/parent/queries';
import { NoChildrenState, RetryState } from '@/components/parent/states';
import { useStudentReportCard } from '@/components/report-cards/queries';
import { ResultsSkeleton, ResultsView } from '@/components/results/results-view';
import { useResultYears, YearSelect } from '@/components/results/year-select';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { PageShell } from '@/components/ui/page-shell';

/** ResultsView, unless the report card is held for fees (same query, so no extra request). */
function ChildResults({ childId, yearId, feesHref }: { childId: string; yearId: string; feesHref: string }) {
  const query = useStudentReportCard(childId, yearId);
  if (query.isError && isReportCardHeld(query.error)) {
    return (
      <EmptyState
        icon={Lock}
        title="Report card on hold"
        description="This report card is held until school fees are paid. Please contact the school office."
        action={
          <Button asChild className="min-h-11 text-base">
            <Link href={feesHref}>
              <Wallet aria-hidden="true" /> See fees
            </Link>
          </Button>
        }
      />
    );
  }
  return (
    <ResultsView studentId={childId} yearId={yearId} emptyMessage="Results appear here when the school publishes them." />
  );
}

function ParentResultsScreen() {
  const { tenantDomain } = useParams<{ tenantDomain: string }>();
  const { query: childrenQuery, kids, childId, child, setChildId } = useSelectedChild();

  const { years, yearId, setYearId, isLoading: yearsLoading, isError: yearsError, refetch: refetchYears } =
    useResultYears();

  const feesHref = `/${tenantDomain}/parent/fees${childId ? `?child=${encodeURIComponent(childId)}` : ''}`;

  let content: React.ReactNode;
  if (childrenQuery.isLoading || yearsLoading) {
    content = <ResultsSkeleton />;
  } else if (childrenQuery.isError) {
    content = <RetryState what="Results" onRetry={() => void childrenQuery.refetch()} />;
  } else if (kids.length === 0) {
    content = <NoChildrenState />;
  } else if (yearsError) {
    content = <RetryState what="Results" onRetry={refetchYears} />;
  } else if (!yearId) {
    content = (
      <EmptyState icon={CalendarX} title="No school year yet" description="The school has not set up a school year yet." />
    );
  } else {
    content = (
      <>
        <ChildSwitcher items={kids} value={childId} onChange={setChildId} />
        <YearSelect years={years} value={yearId} onChange={setYearId} />
        <ChildResults key={childId} childId={childId} yearId={yearId} feesHref={feesHref} />
      </>
    );
  }

  return (
    <PageShell title="Results" description={childLine(child) ?? 'Your child’s marks, once the school publishes them.'}>
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
