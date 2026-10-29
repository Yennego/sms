'use client';

// One student's published results for one year: summary, subject cards, then the full report
// card (shared with staff) and Print. Used by the student "My results" and parent "Results" pages.
import * as React from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, FileText, Printer, RotateCcw } from 'lucide-react';

import { ReportCard } from '@/components/report-cards/report-card';
import { ReportCardPrintRoot, usePrintRequest } from '@/components/report-cards/print-root';
import { useStudentReportCard } from '@/components/report-cards/queries';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { useTenant } from '@/hooks/use-tenant';
import type { ReportCardSchool } from '@/services/api/results-service';

import { hasPublishedResults } from './results-helpers';
import { ResultsSummary } from './results-summary';
import { SubjectResults } from './subject-results';

/** The school as the report card shows it (from the tenant). */
export function useReportCardSchool(): ReportCardSchool {
  const { tenant } = useTenant();
  return React.useMemo(
    () => ({ name: tenant?.name && tenant.name !== 'Loading...' ? tenant.name : '', logo: tenant?.logo ?? null }),
    [tenant?.name, tenant?.logo]
  );
}

function statusOf(error: unknown): number | undefined {
  const s = (error as { statusCode?: unknown } | null)?.statusCode;
  return typeof s === 'number' ? s : undefined;
}

export function ResultsSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-busy="true" aria-label="Loading results">
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-28 rounded-xl" />
        <Skeleton className="h-28 rounded-xl" />
      </div>
      <Skeleton className="h-24 rounded-xl" />
      <Skeleton className="h-40 rounded-xl" />
    </div>
  );
}

export interface ResultsViewProps {
  studentId: string | undefined;
  yearId: string | undefined;
  /** Shown when nothing is published yet. */
  emptyMessage: string;
}

export function ResultsView({ studentId, yearId, emptyMessage }: ResultsViewProps) {
  const school = useReportCardSchool();
  const query = useStudentReportCard(studentId, yearId);
  const print = usePrintRequest();
  const [showCard, setShowCard] = React.useState(false);
  const cardId = React.useId();

  if (!studentId || !yearId || query.isLoading) return <ResultsSkeleton />;

  if (query.isError) {
    const status = statusOf(query.error);
    // 404: no report card for that year (e.g. not enrolled then) - same as "nothing yet".
    if (status === 404) {
      return <EmptyState icon={FileText} title="No results yet" description={emptyMessage} />;
    }
    if (status === 403) {
      return (
        <EmptyState
          icon={AlertTriangle}
          title="Can't show these results"
          description="Your account can't see these results. Please ask the school office."
        />
      );
    }
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Results did not load"
        description="Check your internet connection and try again."
        action={
          <Button variant="outline" onClick={() => void query.refetch()} disabled={query.isFetching}>
            <RotateCcw aria-hidden="true" /> Try again
          </Button>
        }
      />
    );
  }

  const card = query.data;
  if (!card || !hasPublishedResults(card)) {
    return <EmptyState icon={FileText} title="No results yet" description={emptyMessage} />;
  }

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <ResultsSummary card={card} />
      <SubjectResults card={card} />

      <section aria-label="Report card" className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            variant="outline"
            className="min-h-11 w-full text-base sm:w-auto sm:text-sm"
            aria-expanded={showCard}
            aria-controls={cardId}
            onClick={() => setShowCard((v) => !v)}
          >
            {showCard ? <ChevronUp aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}
            {showCard ? 'Hide full report card' : 'View full report card'}
          </Button>
          <Button className="min-h-11 w-full text-base sm:w-auto sm:text-sm" onClick={print}>
            <Printer aria-hidden="true" /> Print
          </Button>
        </div>
        {showCard ? (
          // The A4 card keeps its layout; on phones it scrolls sideways inside this box only.
          <div id={cardId} className="max-w-full overflow-x-auto rounded-xl border bg-white">
            <div className="min-w-[720px]">
              <ReportCard card={card} school={school} />
            </div>
          </div>
        ) : null}
      </section>

      <ReportCardPrintRoot cards={[card]} school={school} />
    </div>
  );
}
