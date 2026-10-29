// One compact card per subject with only the published columns (period marks, exam, semester
// average) and the year average. Marks below the pass mark are red AND carry an icon and text.
import * as React from 'react';
import { AlertTriangle } from 'lucide-react';

import { StatusBadge } from '@/components/ui/status-badge';
import { cn } from '@/lib/utils';
import {
  formatScore,
  isFailing,
  type ReportCardData,
  type ReportCardSubject,
} from '@/services/api/results-service';

import { latestSubjectScore, periodLabel, semesterHasMarks, subjectNeedsAttention } from './results-helpers';

function Mark({ label, value, passMark, strong }: { label: string; value: number; passMark: number; strong?: boolean }) {
  const failing = isFailing(value, passMark);
  return (
    <div className={cn('flex min-w-0 flex-col rounded-lg border px-2 py-1.5', strong && 'bg-muted/60')}>
      <span className="truncate text-xs text-muted-foreground">{label}</span>
      <span
        className={cn(
          'flex items-center gap-1 text-lg tabular-nums',
          strong ? 'font-bold' : 'font-semibold',
          failing ? 'text-red-700' : 'text-foreground'
        )}
      >
        {formatScore(value)}
        {failing ? (
          <>
            <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
            <span className="sr-only">(below the pass mark)</span>
          </>
        ) : null}
      </span>
    </div>
  );
}

function SubjectCard({ subject, passMark }: { subject: ReportCardSubject; passMark: number }) {
  const latest = latestSubjectScore(subject);
  const needsAttention = subjectNeedsAttention(subject, passMark);
  const semesters = subject.semesters.filter(semesterHasMarks);

  return (
    <li className="flex flex-col gap-3 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="break-words text-base font-semibold text-foreground">{subject.name}</h3>
          {latest.value !== null ? (
            <p className="text-sm text-muted-foreground">
              {latest.label}: <span className="font-semibold tabular-nums text-foreground">{formatScore(latest.value)}</span>
            </p>
          ) : null}
        </div>
        {latest.value === null ? (
          <StatusBadge status="neutral" label="No marks yet" />
        ) : needsAttention ? (
          <StatusBadge status="danger" label="Below pass mark" />
        ) : (
          <StatusBadge status="success" label="Passing" />
        )}
      </div>

      {semesters.map((sem) => (
        <div key={sem.number} className="flex flex-col gap-1.5">
          <p className="text-sm font-medium text-foreground">
            Semester {sem.number}
            {!sem.complete && sem.average !== null ? (
              <span className="font-normal text-muted-foreground"> · not all marks in yet</span>
            ) : null}
          </p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {sem.periods.map((p, i) =>
              p !== null && p !== undefined ? <Mark key={i} label={periodLabel(i)} value={p} passMark={passMark} /> : null
            )}
            {sem.exam !== null ? <Mark label="Exam" value={sem.exam} passMark={passMark} /> : null}
            {sem.average !== null ? <Mark label="Average" value={sem.average} passMark={passMark} strong /> : null}
          </div>
        </div>
      ))}
    </li>
  );
}

export interface SubjectResultsProps {
  card: ReportCardData;
  className?: string;
}

export function SubjectResults({ card, className }: SubjectResultsProps) {
  if (card.subjects.length === 0) return null;
  return (
    <section aria-labelledby="subject-results-title" className={cn('flex flex-col gap-3', className)}>
      <h2 id="subject-results-title" className="text-lg font-semibold text-foreground">
        Subjects
      </h2>
      <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {card.subjects.map((s) => (
          <SubjectCard key={s.subject_id || s.name} subject={s} passMark={card.pass_mark} />
        ))}
      </ul>
    </section>
  );
}
