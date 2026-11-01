// Phone-first summary of one report card: average, rank and the subjects that need attention.
// Status is always text (and an icon), never colour alone.
import * as React from 'react';

import { StatusBadge } from '@/components/ui/status-badge';
import { cn } from '@/lib/utils';
import { formatScore, isFailing, ordinal, type ReportCardData } from '@/services/api/results-service';

import { latestSubjectScore, overallAverage, subjectNeedsAttention } from './results-helpers';

function Tile({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-1 rounded-xl border bg-card p-4', className)}>
      <span className="text-sm text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

export interface ResultsSummaryProps {
  card: ReportCardData;
  className?: string;
}

export function ResultsSummary({ card, className }: ResultsSummaryProps) {
  const passMark = card.pass_mark;
  const average = overallAverage(card);
  const averageFailing = isFailing(average.value, passMark);
  const attention = card.subjects.filter((s) => subjectNeedsAttention(s, passMark));
  const scored = card.subjects.filter((s) => latestSubjectScore(s).value !== null);

  return (
    <section aria-labelledby="results-summary-title" className={cn('flex flex-col gap-3', className)}>
      <h2 id="results-summary-title" className="sr-only">
        Summary
      </h2>
      <div className="grid grid-cols-2 gap-3">
        <Tile label={average.label}>
          <span className="text-3xl font-bold tabular-nums text-foreground">{formatScore(average.value)}</span>
          {average.value !== null ? (
            <StatusBadge
              status={averageFailing ? 'danger' : 'success'}
              label={averageFailing ? 'Below pass mark' : 'Passing'}
            />
          ) : null}
        </Tile>
        <Tile label="Place in class">
          {card.overall.rank !== null ? (
            <>
              <span className="text-3xl font-bold tabular-nums text-foreground">{ordinal(card.overall.rank)}</span>
              {card.overall.class_size !== null ? (
                <span className="text-sm text-muted-foreground">of {card.overall.class_size} students</span>
              ) : null}
            </>
          ) : (
            <>
              <span className="text-3xl font-bold text-muted-foreground">—</span>
              <span className="text-sm text-muted-foreground">Shown when a semester is published</span>
            </>
          )}
        </Tile>
      </div>

      <div className="rounded-xl border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-semibold text-foreground">Needs attention</h3>
          <span className="text-sm text-muted-foreground">Pass mark: {passMark}</span>
        </div>
        {attention.length > 0 ? (
          <ul className="mt-3 flex flex-col divide-y">
            {attention.map((s) => {
              const latest = latestSubjectScore(s);
              return (
                <li key={s.subject_id || s.name} className="flex min-h-11 items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">{s.name}</p>
                    <p className="text-xs text-muted-foreground">{latest.label}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-lg font-bold tabular-nums text-red-700">{formatScore(latest.value)}</span>
                    <StatusBadge status="danger" label="Below pass mark" />
                  </div>
                </li>
              );
            })}
          </ul>
        ) : scored.length > 0 ? (
          <div className="mt-3">
            <StatusBadge status="success" size="md" label="All subjects at or above the pass mark" />
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">No marks yet.</p>
        )}
      </div>
    </section>
  );
}
