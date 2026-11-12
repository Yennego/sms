'use client';

// Year-end promotion: check a grade's results against the promotion rules, adjust a student's
// score if needed, then move the grade into next year's classes. Passed students move up,
// failed ones repeat with remedial work, final-grade students are left for the Graduation page.

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import type { ColumnDef } from '@tanstack/react-table';
import { ArrowRight, BookOpen, CheckCircle2, ListChecks, Settings2, TrendingUp } from 'lucide-react';

import { CountTiles } from '@/components/attendance/attendance-ui';
import { selectClass } from '@/components/students/admission-form';
import { errorMessage } from '@/components/students/format';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { DataTable } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageShell } from '@/components/ui/page-shell';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/ui/status-badge';
import { notify } from '@/components/ui/toaster';
import { plural, promotionBadge } from '@/components/year-end/format';
import { RemedialSection } from '@/components/year-end/remedial-section';
import {
  useApplyScaling,
  useGradeLevels,
  usePromotionEvaluation,
  useRefreshYearEnd,
  useSectionsOfGrade,
  useStartTransition,
  type EvaluationParams,
} from '@/components/year-end/queries';
import { useAcademicYear } from '@/contexts/academic-year-context';
import type { PromotionEvaluationResult, TransitionResult } from '@/services/api/promotion-service';

export default function PromotionPage() {
  const { tenantDomain } = useParams<{ tenantDomain: string }>();
  const base = `/${tenantDomain}`;
  const { academicYears: ayList } = useAcademicYear();
  const { data: grades = [] } = useGradeLevels();

  const [selectedYear, setSelectedYear] = useState('');
  const [selectedGrade, setSelectedGrade] = useState('');
  const [selectedSection, setSelectedSection] = useState('all');
  const [targetChoice, setTargetChoice] = useState('');
  // The year, grade and section whose results are shown (set by "Check results")
  const [checked, setChecked] = useState<EvaluationParams | null>(null);
  const [scaling, setScaling] = useState<{ row: PromotionEvaluationResult; points: number } | null>(null);
  const [remedialFor, setRemedialFor] = useState<PromotionEvaluationResult | null>(null);
  const [confirmMove, setConfirmMove] = useState(false);
  const [transitionResult, setTransitionResult] = useState<{ result: TransitionResult; target: string } | null>(null);

  const sectionsQuery = useSectionsOfGrade(selectedGrade);
  const sections = useMemo(() => (Array.isArray(sectionsQuery.data) ? sectionsQuery.data : []), [sectionsQuery.data]);
  const evaluation = usePromotionEvaluation(checked);
  const applyScaling = useApplyScaling();
  const transition = useStartTransition();
  const refreshYearEnd = useRefreshYearEnd();

  // Current and future school years only
  const filteredYears = useMemo(() => {
    const today = new Date();
    return ayList.filter((y) => y.is_current || new Date(y.start_date) > today || new Date(y.end_date) >= today);
  }, [ayList]);

  // Students move into a school year that starts after the one being evaluated, never an older one
  const targetYears = useMemo(() => {
    const from = ayList.find((y) => y.id === selectedYear);
    if (!from) return [];
    return ayList
      .filter((y) => y.id !== from.id && new Date(y.start_date) > new Date(from.start_date))
      .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime());
  }, [ayList, selectedYear]);
  // The first later year unless another is chosen
  const targetYearName = targetYears.some((y) => y.name === targetChoice) ? targetChoice : (targetYears[0]?.name ?? '');

  const gradeName = grades.find((g) => g.id === (checked?.gradeId ?? selectedGrade))?.name ?? 'this grade';
  const sectionName = (id?: string) => sections.find((s) => s.id === id)?.name ?? '–';

  const results = useMemo(
    () => (evaluation.data ?? []).filter((r) => selectedSection === 'all' || r.section_id === selectedSection),
    [evaluation.data, selectedSection]
  );
  const counts = useMemo(() => {
    const c = { Eligible: 0, Conditional: 0, Repeating: 0, 'Not graded': 0 } as Record<string, number>;
    for (const r of results) c[r.status] = (c[r.status] ?? 0) + 1;
    return c;
  }, [results]);

  // Changing the year or grade clears the results: what is moved is always what was checked
  const chooseYear = (id: string) => {
    setSelectedYear(id);
    setTargetChoice('');
    setChecked(null);
    setTransitionResult(null);
  };
  const chooseGrade = (id: string) => {
    setSelectedGrade(id);
    setSelectedSection('all');
    setChecked(null);
    setTransitionResult(null);
  };

  const runEvaluation = () => {
    if (!selectedYear || !selectedGrade) {
      notify.error('Choose a school year and a grade.');
      return;
    }
    const params = { yearId: selectedYear, gradeId: selectedGrade, sectionId: selectedSection };
    if (checked && JSON.stringify(checked) === JSON.stringify(params)) evaluation.refetch();
    else setChecked(params);
  };

  const confirmScaling = async () => {
    if (!scaling) return;
    try {
      await applyScaling.mutateAsync({ enrollmentId: scaling.row.enrollment_id, points: scaling.points });
      notify.success(`${scaling.points > 0 ? '+' : ''}${scaling.points} points given to ${scaling.row.student_name || 'the student'}. Results checked again.`);
    } catch (error) {
      notify.error(errorMessage(error, "The points weren't added. Try again."));
      throw error;
    }
  };

  const executeTransition = async () => {
    if (!checked || !targetYearName) return;
    try {
      const res = await transition.mutateAsync({
        yearId: checked.yearId,
        targetYearName,
        gradeId: checked.gradeId,
      });
      setTransitionResult({ result: res, target: targetYearName });
      notify.success(`${plural(res.promoted.length, 'student')} promoted to ${targetYearName}.`);
    } catch (error) {
      notify.error(errorMessage(error, 'Nothing was changed. Try again.'));
      throw error;
    }
  };

  const columns = useMemo<ColumnDef<PromotionEvaluationResult>[]>(
    () => [
      {
        accessorKey: 'student_name',
        header: 'Student',
        cell: ({ row }) => <span className="font-medium">{row.original.student_name || 'Unknown student'}</span>,
      },
      {
        id: 'section',
        header: 'Section',
        enableSorting: false,
        meta: { hideOnMobile: true },
        cell: ({ row }) => sectionName(row.original.section_id),
      },
      {
        accessorKey: 'total_score',
        header: 'Total score',
        cell: ({ row }) => (row.original.status === 'Not graded' ? '–' : `${row.original.total_score}%`),
      },
      {
        accessorKey: 'status',
        header: 'Decision',
        cell: ({ row }) => {
          const b = promotionBadge(row.original.status);
          return (
            <div className="flex flex-col gap-1">
              <StatusBadge status={b.status} label={b.label} />
              {row.original.status === 'Not graded' ? (
                <span className="text-xs text-muted-foreground">No grades recorded yet</span>
              ) : null}
            </div>
          );
        },
      },
      {
        id: 'failed',
        header: 'Subjects failed',
        enableSorting: false,
        cell: ({ row }) => (row.original.status === 'Not graded' ? '–' : (row.original.failed_subject_ids?.length ?? 0)),
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        meta: { label: 'Actions', className: 'text-right' },
        cell: ({ row }) => {
          const r = row.original;
          return (
            <div className="flex flex-wrap items-end justify-end gap-2">
              {/* Scaling only makes sense once there are marks to scale */}
              {r.status !== 'Not graded' ? (
                <ScalingInput
                  row={r}
                  disabled={applyScaling.isPending}
                  onApply={(points) => setScaling({ row: r, points })}
                />
              ) : null}
              {r.status === 'Repeating' || r.status === 'Conditional' ? (
                <Button variant="outline" size="sm" className="min-h-11 md:min-h-9" onClick={() => setRemedialFor(r)}>
                  <BookOpen aria-hidden="true" />
                  Remedial work
                </Button>
              ) : null}
            </div>
          );
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sections, applyScaling.isPending]
  );

  const canMove = Boolean(checked && (evaluation.data?.length ?? 0) > 0 && targetYearName && !transition.isPending);

  return (
    <PageShell
      title="Promotion"
      description="Check a grade's results at the end of the year, then move its students into next year's classes."
      secondaryActions={
        <Button asChild variant="outline" className="min-h-11 md:min-h-9">
          <Link href={`${base}/settings/promotion`}>
            <Settings2 aria-hidden="true" />
            Promotion rules
          </Link>
        </Button>
      }
      primaryAction={
        <Button className="min-h-11 md:min-h-9" onClick={() => setConfirmMove(true)} disabled={!canMove}>
          <ArrowRight aria-hidden="true" />
          {targetYearName ? `Move students to ${targetYearName}` : 'Move students'}
        </Button>
      }
    >
      <section aria-label="Choose a grade" className="flex flex-col gap-4 rounded-xl border bg-card p-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="grid gap-2">
            <Label htmlFor="promo-year">School year</Label>
            <select id="promo-year" className={selectClass} value={selectedYear} onChange={(e) => chooseYear(e.target.value)}>
              <option value="">Choose a year</option>
              {filteredYears.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="promo-target">Promote into</Label>
            <select
              id="promo-target"
              className={selectClass}
              value={targetYearName}
              onChange={(e) => setTargetChoice(e.target.value)}
              disabled={targetYears.length === 0}
              aria-describedby="promo-target-help"
            >
              {targetYears.length === 0 ? <option value="">–</option> : null}
              {targetYears.map((y) => (
                <option key={y.id} value={y.name}>
                  {y.name}
                </option>
              ))}
            </select>
            <p id="promo-target-help" className="text-sm text-muted-foreground">
              {!selectedYear
                ? 'Choose the school year first.'
                : targetYears.length === 0
                  ? 'Create next school year first.'
                  : 'A school year that starts later.'}
            </p>
          </div>
          <div className="grid content-start gap-2">
            <Label htmlFor="promo-grade">Grade</Label>
            <select id="promo-grade" className={selectClass} value={selectedGrade} onChange={(e) => chooseGrade(e.target.value)}>
              <option value="">Choose a grade</option>
              {grades.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid content-start gap-2">
            <Label htmlFor="promo-section">Section</Label>
            <select
              id="promo-section"
              className={selectClass}
              value={selectedSection}
              onChange={(e) => setSelectedSection(e.target.value)}
              disabled={!selectedGrade}
            >
              <option value="all">All sections</option>
              {sections.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <Button
            variant="secondary"
            className="min-h-11 md:min-h-9"
            onClick={runEvaluation}
            disabled={!selectedYear || !selectedGrade || evaluation.isFetching}
          >
            <TrendingUp aria-hidden="true" />
            {evaluation.isFetching ? 'Checking results…' : 'Check results'}
          </Button>
        </div>
      </section>

      {transitionResult ? <TransitionSummary {...transitionResult} base={base} /> : null}

      {!checked ? (
        <EmptyState
          icon={ListChecks}
          description="Choose a school year and a grade, then check results to see who moves up."
        />
      ) : evaluation.isLoading ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : evaluation.isError ? (
        <EmptyState
          icon={ListChecks}
          title="The results didn't load"
          description={`${errorMessage(evaluation.error, 'The server didn’t answer.')} Check your connection and try again.`}
          action={<Button onClick={() => evaluation.refetch()}>Try again</Button>}
        />
      ) : (
        <>
          <CountTiles
            tiles={[
              { label: 'Eligible', value: counts.Eligible, status: 'success' },
              { label: 'Conditional', value: counts.Conditional, status: 'warning' },
              { label: 'Repeating', value: counts.Repeating, status: 'danger' },
              { label: 'Not graded', value: counts['Not graded'], status: 'neutral' },
            ]}
          />
          <DataTable
            label={`Results for ${gradeName}`}
            columns={columns}
            data={results}
            searchable
            searchPlaceholder="Search students"
            pageSize={50}
            getRowId={(r) => r.enrollment_id}
            initialSorting={[{ id: 'student_name', desc: false }]}
            emptyState={
              <EmptyState
                icon={ListChecks}
                description="No students are enrolled in this grade for that year. Check the enrollments, then try again."
              />
            }
          />
          {remedialFor ? (
            <RemedialSection
              key={remedialFor.enrollment_id}
              studentName={remedialFor.student_name || 'student'}
              enrollmentId={remedialFor.enrollment_id}
              onClose={() => {
                setRemedialFor(null);
                refreshYearEnd(); // results may have changed in the panel
              }}
            />
          ) : null}
        </>
      )}

      <ConfirmDialog
        open={Boolean(scaling)}
        onOpenChange={(open) => !open && setScaling(null)}
        title={
          scaling
            ? `${scaling.points >= 0 ? 'Add' : 'Take away'} ${Math.abs(scaling.points)} points for ${scaling.row.student_name || 'this student'}?`
            : ''
        }
        description="The change is added to their total score and recorded as a manual adjustment. Their result is checked again."
        confirmLabel={scaling && scaling.points < 0 ? 'Take away points' : 'Add points'}
        loading={applyScaling.isPending}
        onConfirm={confirmScaling}
      />

      <ConfirmDialog
        open={confirmMove}
        onOpenChange={setConfirmMove}
        destructive
        title={`Move ${gradeName} into ${targetYearName}?`}
        description={`Every student in ${gradeName}, in all its sections, is placed in a class for ${targetYearName}. This can't be undone from this page.`}
        confirmLabel={`Move students to ${targetYearName}`}
        loading={transition.isPending}
        onConfirm={executeTransition}
      >
        <ul className="ml-5 list-disc space-y-1 text-sm">
          <li>Students who passed move up one grade.</li>
          <li>Students who failed repeat {gradeName} and get remedial sessions.</li>
          <li>Students with no grades are skipped.</li>
          <li>Students in the final grade are not moved: graduate them on the Graduation page.</li>
        </ul>
      </ConfirmDialog>

    </PageShell>
  );
}

/** Points to add (or take away, when negative) for one student; the page confirms first. */
function ScalingInput({
  row,
  disabled,
  onApply,
}: {
  row: PromotionEvaluationResult;
  disabled: boolean;
  onApply: (points: number) => void;
}) {
  const [value, setValue] = useState('');
  const points = parseFloat(value);
  const id = `scale-${row.enrollment_id}`;
  return (
    <form
      className="flex items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!Number.isNaN(points) && points !== 0) {
          onApply(points);
          setValue('');
        }
      }}
    >
      <div className="grid gap-1 text-left">
        <Label htmlFor={id} className="text-xs text-muted-foreground">
          Adjust score
        </Label>
        <Input
          id={id}
          type="number"
          inputMode="decimal"
          placeholder="+/- points"
          className="h-11 w-28 md:h-9"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
      </div>
      <Button
        type="submit"
        variant="outline"
        size="sm"
        className="min-h-11 md:min-h-9"
        disabled={disabled || Number.isNaN(points) || points === 0}
      >
        Apply
      </Button>
    </form>
  );
}

function TransitionSummary({ result, target, base }: { result: TransitionResult; target: string; base: string }) {
  return (
    <section role="status" className="flex flex-col gap-3 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-950">
      <p className="flex items-center gap-2 text-base font-semibold">
        <CheckCircle2 className="size-5 text-green-700" aria-hidden="true" />
        Students moved to {target}
      </p>
      <ul className="ml-5 list-disc space-y-1">
        <li>{plural(result.promoted.length, 'student')} promoted to the next grade.</li>
        <li>{plural(result.remedial.length, 'student')} repeat their grade, with remedial sessions.</li>
        <li>{plural(result.skipped.length, 'student')} not graded, skipped.</li>
        {result.graduating.length > 0 ? (
          <li>{plural(result.graduating.length, 'student')} in the final grade: graduate them on the Graduation page.</li>
        ) : null}
        {result.errors.length > 0 ? (
          <li className="text-red-800">
            {plural(result.errors.length, 'student')} not moved: {result.errors.map((e) => e.error).join('; ')}.
          </li>
        ) : null}
      </ul>
      <div className="flex flex-col gap-2 sm:flex-row">
        {result.remedial.length > 0 ? (
          <Button asChild variant="outline" className="min-h-11 bg-background md:min-h-9">
            <Link href={`${base}/academics/remedial`}>See remedial work</Link>
          </Button>
        ) : null}
        {result.graduating.length > 0 ? (
          <Button asChild variant="outline" className="min-h-11 bg-background md:min-h-9">
            <Link href={`${base}/academics/graduation`}>Go to Graduation</Link>
          </Button>
        ) : null}
        <Button asChild variant="outline" className="min-h-11 bg-background md:min-h-9">
          <Link href={`${base}/academics/enrollments`}>See enrollments</Link>
        </Button>
      </div>
    </section>
  );
}
