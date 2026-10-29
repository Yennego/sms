'use client';

// One class in Review and publish: its subjects with completion, class average and teacher for
// the chosen column, and the Publish results / Unpublish button.
import * as React from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { AlertCircle, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';
import { StatusBadge } from '@/components/ui/status-badge';
import { errorMessage } from '@/components/students/format';
import { formatScore, type ClassProgress, type SubjectProgress } from '@/services/api/results-service';

export type SubjectCompletion = 'complete' | 'partial' | 'none';

export function subjectCompletion(s: SubjectProgress): SubjectCompletion {
  if (s.students > 0 && s.scored >= s.students) return 'complete';
  if (s.scored > 0) return 'partial';
  return 'none';
}

function CompletionCell({ subject }: { subject: SubjectProgress }) {
  const state = subjectCompletion(subject);
  const pct = subject.students > 0 ? Math.min(100, Math.round((subject.scored / subject.students) * 100)) : 0;
  return (
    <div className="flex min-w-36 flex-col gap-1">
      <div className="flex items-center gap-2">
        <span className="tabular-nums">
          {subject.scored} of {subject.students}
        </span>
        {state === 'complete' ? (
          <StatusBadge status="success" label="Complete" />
        ) : state === 'partial' ? (
          <StatusBadge status="pending" label="Not complete" />
        ) : (
          <StatusBadge status="neutral" label={subject.assessments === 0 ? 'No assessments' : 'No scores'} />
        )}
      </div>
      <div
        className="h-1.5 w-full max-w-40 overflow-hidden rounded-full bg-muted"
        role="presentation"
        aria-hidden="true"
      >
        <div
          className={state === 'complete' ? 'h-full bg-green-600' : 'h-full bg-amber-500'}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

const columns: ColumnDef<SubjectProgress>[] = [
  {
    accessorKey: 'subject_name',
    header: 'Subject',
    cell: ({ row }) => <span className="font-medium">{row.original.subject_name}</span>,
  },
  {
    id: 'teacher',
    accessorFn: (s) => s.teacher_name ?? '',
    header: 'Teacher',
    cell: ({ row }) =>
      row.original.teacher_name ?? <span className="text-muted-foreground">No teacher assigned</span>,
  },
  {
    id: 'completion',
    accessorFn: (s) => (s.students > 0 ? s.scored / s.students : 0),
    header: 'Students with a score',
    cell: ({ row }) => <CompletionCell subject={row.original} />,
  },
  {
    accessorKey: 'assessments',
    header: 'Assessments',
    meta: { hideOnMobile: true, className: 'text-right' },
    cell: ({ row }) => <span className="tabular-nums">{row.original.assessments}</span>,
  },
  {
    id: 'class_average',
    accessorFn: (s) => s.class_average ?? -1,
    header: 'Class average',
    meta: { className: 'text-right' },
    cell: ({ row }) => <span className="tabular-nums">{formatScore(row.original.class_average)}</span>,
  },
];

export interface ClassResultsCardProps {
  classId: string;
  className: string;
  columnLabel: string;
  progress: ClassProgress | undefined;
  loading: boolean;
  error: unknown;
  published: boolean;
  publishedNote?: string | null;
  busy: boolean;
  onPublish: () => void;
  onUnpublish: () => void;
  onRetry: () => void;
}

export function ClassResultsCard({
  classId,
  className,
  columnLabel,
  progress,
  loading,
  error,
  published,
  publishedNote,
  busy,
  onPublish,
  onUnpublish,
  onRetry,
}: ClassResultsCardProps) {
  const subjects = progress?.subjects ?? [];
  const complete = subjects.filter((s) => subjectCompletion(s) === 'complete').length;
  const headingId = `class-${classId}-heading`;

  return (
    <Card aria-labelledby={headingId} className="gap-4 py-4">
      <CardHeader className="flex flex-col gap-3 px-4 sm:flex-row sm:items-start sm:justify-between md:px-6">
        <div className="min-w-0 space-y-1">
          <CardTitle id={headingId} className="text-lg">
            {className}
          </CardTitle>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            {published ? (
              <StatusBadge status="success" label="Published" />
            ) : (
              <StatusBadge status="neutral" label="Not published" />
            )}
            {progress ? (
              <span>
                {complete} of {subjects.length} {subjects.length === 1 ? 'subject' : 'subjects'} complete
                {progress.students ? ` · ${progress.students} students` : ''}
              </span>
            ) : null}
            {published && publishedNote ? <span>· {publishedNote}</span> : null}
          </div>
        </div>
        {published ? (
          <Button
            variant="outline"
            className="min-h-11 sm:min-h-9"
            onClick={onUnpublish}
            disabled={busy || loading}
            aria-label={`Unpublish ${columnLabel} results for ${className}`}
          >
            {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
            Unpublish
          </Button>
        ) : (
          <Button
            className="min-h-11 sm:min-h-9"
            onClick={onPublish}
            disabled={busy || loading || Boolean(error)}
            aria-label={`Publish ${columnLabel} results for ${className}`}
          >
            {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
            Publish results
          </Button>
        )}
      </CardHeader>
      <CardContent className="px-4 md:px-6">
        {error ? (
          <EmptyState
            icon={AlertCircle}
            description={errorMessage(error, "This class's progress couldn't be loaded. Try again.")}
            action={
              <Button variant="outline" onClick={onRetry}>
                Try again
              </Button>
            }
          />
        ) : (
          <DataTable
            columns={columns}
            data={subjects}
            label={`Subjects of ${className}`}
            loading={loading}
            loadingRows={3}
            pageSize={0}
            getRowId={(s, i) => s.class_subject_id ?? s.subject_id ?? String(i)}
            emptyState={
              <EmptyState description="This class has no subjects yet. Add subjects to the class in Classes first." />
            }
          />
        )}
      </CardContent>
    </Card>
  );
}
