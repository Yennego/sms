'use client';

// Review and publish (phase4-design.md section 5): for a school year and one results column
// (a period, or a semester's exam and average), every class's subjects with how many students
// have a score, the class average and the teacher; then publish or unpublish per class.
// Published results are what students and parents of the class see.
import * as React from 'react';
import { AlertCircle, CalendarRange, School } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { PageShell } from '@/components/ui/page-shell';
import { Skeleton } from '@/components/ui/skeleton';
import { notify } from '@/components/ui/toaster';
import { errorMessage, formatDate } from '@/components/students/format';
import { className as classLabel, useYearClasses } from '@/components/class-placement/queries';
import { ClassResultsCard, subjectCompletion } from '@/components/publishing/class-results-card';
import {
  useClassesProgress,
  usePublications,
  usePublishResults,
  useResultColumns,
  type ResultColumn,
} from '@/components/publishing/queries';
import { useAcademicYearsList } from '@/hooks/queries/academic-years';
import type { ResultPublication } from '@/services/api/results-service';

const selectClass =
  'h-11 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50 md:h-9';

interface PendingAction {
  classId: string;
  className: string;
  publish: boolean;
  incomplete: string[];
}

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** The period running today, else the last one that has started, else the first column. */
function defaultColumn(columns: ResultColumn[]): ResultColumn | undefined {
  const today = todayIso();
  const periods = columns.filter((c) => c.scope.period_id);
  const running = periods.find((c) => c.start && c.end && c.start.slice(0, 10) <= today && today <= c.end.slice(0, 10));
  if (running) return running;
  const started = periods.filter((c) => c.start && c.start.slice(0, 10) <= today);
  return started[started.length - 1] ?? columns[0];
}

function publicationFor(
  publications: ResultPublication[] | undefined,
  classId: string,
  column: ResultColumn | undefined
): ResultPublication | undefined {
  if (!publications || !column) return undefined;
  return publications.find(
    (p) =>
      p.class_id === classId &&
      (column.scope.period_id ? p.period_id === column.scope.period_id : p.semester_id === column.scope.semester_id && !p.period_id)
  );
}

function permissionMessage(error: unknown, fallback: string) {
  const status = (error as { statusCode?: number } | null)?.statusCode;
  if (status === 403) return "You don't have permission to publish results. Ask the principal or an administrator.";
  return errorMessage(error, fallback);
}

export default function ReviewAndPublishPage() {
  const yearsQuery = useAcademicYearsList();
  const years = React.useMemo(() => yearsQuery.data ?? [], [yearsQuery.data]);
  const [chosenYearId, setChosenYearId] = React.useState('');
  const yearId = chosenYearId || years.find((y) => y.is_current)?.id || years[0]?.id || '';
  const year = years.find((y) => y.id === yearId);

  const { columns, isLoading: columnsLoading, error: columnsError } = useResultColumns(yearId || undefined);
  const [chosenColumnKey, setChosenColumnKey] = React.useState('');
  const column = columns.find((c) => c.key === chosenColumnKey) ?? defaultColumn(columns);

  const classesQuery = useYearClasses(yearId || undefined);
  const classes = React.useMemo(() => classesQuery.data ?? [], [classesQuery.data]);
  const classIds = React.useMemo(() => classes.map((c) => c.id), [classes]);
  const progressQueries = useClassesProgress(classIds, column?.scope);
  const publicationsQuery = usePublications(yearId || undefined);
  const publishMutation = usePublishResults(yearId || undefined);

  const [pending, setPending] = React.useState<PendingAction | null>(null);
  const [busyClassId, setBusyClassId] = React.useState<string | null>(null);

  const isPublished = (classId: string, index: number) => {
    if (publicationsQuery.data) return Boolean(publicationFor(publicationsQuery.data, classId, column));
    return Boolean(progressQueries[index]?.data?.published);
  };

  const publishedCount = classes.filter((c, i) => isPublished(c.id, i)).length;
  const columnLabel = column?.label ?? '';
  const columnPhrase = column
    ? column.scope.period_id
      ? `${column.label} results`
      : `${column.semesterName} exam and semester average`
    : 'results';

  const openConfirm = (classId: string, name: string, index: number, publish: boolean) => {
    const subjects = progressQueries[index]?.data?.subjects ?? [];
    setPending({
      classId,
      className: name,
      publish,
      incomplete: subjects.filter((s) => subjectCompletion(s) !== 'complete').map((s) => s.subject_name),
    });
  };

  const confirm = async () => {
    if (!pending || !column) return;
    setBusyClassId(pending.classId);
    try {
      await publishMutation.mutateAsync({ classId: pending.classId, scope: column.scope, publish: pending.publish });
      notify.success(
        pending.publish
          ? `${columnPhrase} published for ${pending.className}. Students and parents can see them now.`
          : `${columnPhrase} unpublished for ${pending.className}. Students and parents no longer see them.`
      );
    } catch (error) {
      // 409 for a semester whose periods aren't all published: show the server's words.
      notify.error(
        permissionMessage(
          error,
          pending.publish
            ? `${pending.className}'s results weren't published. Try again.`
            : `${pending.className}'s results weren't unpublished. Try again.`
        )
      );
      throw error;
    } finally {
      setBusyClassId(null);
    }
  };

  const yearSelectId = React.useId();
  const columnSelectId = React.useId();

  // Group the columns by semester for the select.
  const groups = React.useMemo(() => {
    const map = new Map<string, { name: string; items: ResultColumn[] }>();
    for (const c of columns) {
      if (!map.has(c.semesterId)) map.set(c.semesterId, { name: c.semesterName, items: [] });
      map.get(c.semesterId)!.items.push(c);
    }
    return [...map.values()];
  }, [columns]);

  let body: React.ReactNode;
  if (yearsQuery.isLoading || (yearId && (columnsLoading || classesQuery.isLoading))) {
    body = (
      <div className="flex flex-col gap-4" aria-busy="true">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  } else if (yearsQuery.error || columnsError || classesQuery.error) {
    body = (
      <EmptyState
        icon={AlertCircle}
        description={errorMessage(
          yearsQuery.error ?? columnsError ?? classesQuery.error,
          "The school year couldn't be loaded. Check your connection and try again."
        )}
        action={
          <Button
            variant="outline"
            onClick={() => {
              void yearsQuery.refetch();
              void classesQuery.refetch();
            }}
          >
            Try again
          </Button>
        }
      />
    );
  } else if (!yearId) {
    body = (
      <EmptyState
        icon={CalendarRange}
        title="No school year yet"
        description="Set up a school year with its semesters and periods first, then come back to publish results."
      />
    );
  } else if (columns.length === 0) {
    body = (
      <EmptyState
        icon={CalendarRange}
        title="No periods in this year"
        description="Add semesters and periods to this school year first. Results are published per period and per semester."
      />
    );
  } else if (classes.length === 0) {
    body = (
      <EmptyState
        icon={School}
        title="No classes in this year"
        description="Create the classes for this school year first. Results are published one class at a time."
      />
    );
  } else {
    body = (
      <div className="flex flex-col gap-4">
        {classes.map((c, i) => {
          const q = progressQueries[i];
          const publication = publicationFor(publicationsQuery.data, c.id, column);
          const name = classLabel(c);
          const publishedNote = publication?.published_at
            ? `on ${formatDate(publication.published_at)}${publication.published_by_name ? ` by ${publication.published_by_name}` : ''}`
            : null;
          return (
            <ClassResultsCard
              key={c.id}
              classId={c.id}
              className={name}
              columnLabel={columnLabel}
              progress={q?.data}
              loading={Boolean(q?.isLoading)}
              error={q?.error ?? null}
              published={isPublished(c.id, i)}
              publishedNote={publishedNote}
              busy={busyClassId === c.id}
              onPublish={() => openConfirm(c.id, name, i, true)}
              onUnpublish={() => openConfirm(c.id, name, i, false)}
              onRetry={() => void q?.refetch()}
            />
          );
        })}
      </div>
    );
  }

  return (
    <PageShell
      title="Review and publish"
      description="Check that every subject has its scores, then publish a class's results. Students and parents only see published results."
    >
      <div className="flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-end">
        <div className="grid gap-2 sm:w-56">
          <label htmlFor={yearSelectId} className="text-sm font-medium">
            School year
          </label>
          <select
            id={yearSelectId}
            className={selectClass}
            value={yearId}
            disabled={years.length === 0}
            onChange={(e) => {
              setChosenYearId(e.target.value);
              setChosenColumnKey('');
            }}
          >
            {years.map((y) => (
              <option key={y.id} value={y.id}>
                {y.name}
                {y.is_current ? ' (current)' : ''}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-2 sm:w-80">
          <label htmlFor={columnSelectId} className="text-sm font-medium">
            Results
          </label>
          <select
            id={columnSelectId}
            className={selectClass}
            value={column?.key ?? ''}
            disabled={columns.length === 0}
            onChange={(e) => setChosenColumnKey(e.target.value)}
          >
            {groups.map((g) => (
              <optgroup key={g.name} label={g.name}>
                {g.items.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
        {column && classes.length > 0 ? (
          <p className="text-sm text-muted-foreground sm:ml-auto sm:text-right" aria-live="polite">
            {publicationsQuery.isLoading ? 'Checking what is published…' : `${publishedCount} of ${classes.length} classes published`}
            {year ? ` · ${year.name}` : ''}
          </p>
        ) : null}
      </div>

      {column?.scope.semester_id ? (
        <p className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          Publishing the semester exam also publishes the semester average. All three periods of{' '}
          {column.semesterName} must be published for the class first.
        </p>
      ) : null}

      {body}

      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open) setPending(null);
        }}
        title={
          pending
            ? pending.publish
              ? `Publish ${columnPhrase} for ${pending.className}?`
              : `Unpublish ${columnPhrase} for ${pending.className}?`
            : ''
        }
        description={
          pending
            ? pending.publish
              ? `Students and parents of ${pending.className} will see these results. After this, teachers can't change these scores; only an administrator can.`
              : `Students and parents of ${pending.className} will no longer see these results. Teachers can change the scores again.`
            : undefined
        }
        confirmLabel={pending?.publish ? 'Publish results' : 'Unpublish results'}
        destructive={pending ? !pending.publish : false}
        onConfirm={confirm}
      >
        {pending?.publish && pending.incomplete.length > 0 ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <p className="font-medium">
              {pending.incomplete.length === 1 ? '1 subject is' : `${pending.incomplete.length} subjects are`} not
              complete:
            </p>
            <p className="mt-1">{pending.incomplete.join(', ')}</p>
            <p className="mt-1">Students without a score will have an incomplete average.</p>
          </div>
        ) : null}
      </ConfirmDialog>
    </PageShell>
  );
}
