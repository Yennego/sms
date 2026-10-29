'use client';

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, ArrowRight, CalendarPlus, RefreshCw } from 'lucide-react';

import { PageShell } from '@/components/ui/page-shell';
import { EmptyState } from '@/components/ui/empty-state';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAcademicYearsList } from '@/hooks/queries/academic-years';
import type { AcademicYear } from '@/types/enrollment';
import { errorText, formatDate, useYearSetup, useYearSetupMutations } from './use-year-setup';
import { STEPS, completedCount, firstIncomplete, isStepKey, type StepKey } from './steps';
import { StepNav } from './step-nav';
import { CreateYearSheet } from './create-year-sheet';
import { CopyFromPanel } from './copy-from-panel';
import { StepTerms } from './step-terms';
import { StepLevels } from './step-levels';
import { StepClasses } from './step-classes';
import { StepSubjects } from './step-subjects';
import { StepEnroll } from './step-enroll';
import { DonePanel } from './done-panel';

function pickDefaultYear(years: AcademicYear[]): AcademicYear | undefined {
  return years.find((y) => y.is_current) ?? [...years].sort((a, b) => b.start_date.localeCompare(a.start_date))[0];
}

export interface YearSetupWizardProps {
  /** The school slug from the URL, used for every link. */
  school: string;
}

/**
 * The school-year setup wizard (03-app-flow §4.2). The chosen year and step live in the URL
 * (?year=&step=), and progress is the server's data, so a reload shows the same place.
 */
export function YearSetupWizard({ school }: YearSetupWizardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [createOpen, setCreateOpen] = React.useState(false);

  const yearsQuery = useAcademicYearsList(false);
  const years = React.useMemo(() => yearsQuery.data ?? [], [yearsQuery.data]);
  const urlYear = searchParams.get('year');
  const selectedYear = years.find((y) => y.id === urlYear) ?? pickDefaultYear(years);
  const yearId = selectedYear?.id ?? null;

  const setupQuery = useYearSetup(yearId);
  const data = setupQuery.data;
  const mutations = useYearSetupMutations(yearId ?? 'none');

  const setParams = React.useCallback(
    (next: { year?: string; step?: string | null }) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next.year !== undefined) params.set('year', next.year);
      if (next.step !== undefined) {
        if (next.step) params.set('step', next.step);
        else params.delete('step');
      }
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const urlStep = searchParams.get('step');
  const current: StepKey | 'done' | null = !data
    ? null
    : isStepKey(urlStep)
      ? urlStep
      : urlStep === 'done' && completedCount(data) === STEPS.length
        ? 'done'
        : firstIncomplete(data) ?? 'done';

  const goTo = (step: StepKey | 'done') => {
    setParams({ step });
    if (typeof window !== 'undefined') {
      document.getElementById('year-setup-step')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const latestEnd = years.reduce<string | undefined>((max, y) => (!max || y.end_date > max ? y.end_date : max), undefined);

  const createAction = (
    <Button variant={years.length ? 'outline' : 'default'} onClick={() => setCreateOpen(true)}>
      <CalendarPlus aria-hidden="true" />
      Create a school year
    </Button>
  );

  const sheet = (
    <CreateYearSheet
      open={createOpen}
      onOpenChange={setCreateOpen}
      latestEndDate={latestEnd}
      isFirst={years.length === 0}
      onCreated={(y) => setParams({ year: y.id, step: null })}
    />
  );

  // Loading and error states for the year list
  if (yearsQuery.isLoading) {
    return (
      <PageShell title="Set up a school year" description="Terms, classes, subjects and students for one school year.">
        <WizardSkeleton />
      </PageShell>
    );
  }

  if (yearsQuery.isError) {
    return (
      <PageShell title="Set up a school year">
        <EmptyState
          icon={RefreshCw}
          title="School years did not load"
          description={errorText(yearsQuery.error, 'Check your connection and try again.')}
          action={<Button onClick={() => yearsQuery.refetch()}>Try again</Button>}
        />
      </PageShell>
    );
  }

  if (years.length === 0) {
    return (
      <PageShell title="Set up a school year" description="Terms, classes, subjects and students for one school year.">
        <EmptyState
          icon={CalendarPlus}
          title="No school years yet"
          description="Create your first school year. You'll then add its terms, classes, subjects and students here."
          action={createAction}
        />
        {sheet}
      </PageShell>
    );
  }

  const stepInfo = current && current !== 'done' ? STEPS.find((s) => s.key === current)! : null;
  const stepIndex = stepInfo ? STEPS.indexOf(stepInfo) : -1;
  const prevStep = stepIndex > 0 ? STEPS[stepIndex - 1] : null;
  const nextStep = stepIndex >= 0 && stepIndex < STEPS.length - 1 ? STEPS[stepIndex + 1] : null;
  const allDone = data ? completedCount(data) === STEPS.length : false;

  return (
    <PageShell
      title="Set up a school year"
      description="Five steps. Each one saves as you go, so you can stop and come back."
      primaryAction={createAction}
    >
      <div className="grid gap-2 sm:max-w-sm">
        <label htmlFor="year-setup-year" className="text-sm font-medium">School year</label>
        <Select value={yearId ?? undefined} onValueChange={(v) => setParams({ year: v, step: null })}>
          <SelectTrigger id="year-setup-year" className="h-11">
            <SelectValue placeholder="Choose a school year" />
          </SelectTrigger>
          <SelectContent>
            {years.map((y) => (
              <SelectItem key={y.id} value={y.id}>
                {y.name}
                {y.is_current ? ' (current)' : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedYear ? (
          <p className="text-sm text-muted-foreground">
            {formatDate(selectedYear.start_date)} to {formatDate(selectedYear.end_date)}
          </p>
        ) : null}
      </div>

      {setupQuery.isLoading ? <WizardSkeleton /> : null}

      {setupQuery.isError ? (
        <EmptyState
          icon={RefreshCw}
          title="This year's setup did not load"
          description={errorText(setupQuery.error, 'Check your connection and try again.')}
          action={<Button onClick={() => setupQuery.refetch()}>Try again</Button>}
        />
      ) : null}

      {data && current ? (
        <>
          {data.previous_year && !allDone ? (
            <CopyFromPanel previousYear={data.previous_year} yearName={data.year.name} mutations={mutations} />
          ) : null}

          <StepNav data={data} current={current} onSelect={goTo} />

          <div id="year-setup-step" className="scroll-mt-4">
            {current === 'done' ? (
              <DonePanel data={data} school={school} />
            ) : stepInfo ? (
              <section className="rounded-xl border bg-card p-4 sm:p-6" aria-labelledby="year-setup-step-title">
                <header className="mb-4 flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm text-muted-foreground">Step {stepIndex + 1} of {STEPS.length}</p>
                    <h2 id="year-setup-step-title" className="text-xl font-semibold">{stepInfo.title}</h2>
                    <p className="text-sm text-muted-foreground">{stepInfo.description}</p>
                  </div>
                  {data.steps[stepInfo.key].complete ? (
                    <StatusBadge status="success" label="Done" size="md" />
                  ) : (
                    <StatusBadge status="pending" label="Not done yet" size="md" />
                  )}
                </header>

                {current === 'terms' ? <StepTerms data={data} mutations={mutations} school={school} /> : null}
                {current === 'levels' ? <StepLevels data={data} mutations={mutations} /> : null}
                {current === 'classes' ? (
                  <StepClasses data={data} mutations={mutations} school={school} onGoToLevels={() => goTo('levels')} />
                ) : null}
                {current === 'subjects' ? (
                  <StepSubjects data={data} mutations={mutations} school={school} onGoToClasses={() => goTo('classes')} />
                ) : null}
                {current === 'enrollment' ? <StepEnroll data={data} school={school} /> : null}

                <footer className="mt-6 flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-between">
                  {prevStep ? (
                    <Button variant="ghost" className="min-h-11" onClick={() => goTo(prevStep.key)}>
                      <ArrowLeft aria-hidden="true" />
                      Back to {prevStep.title.toLowerCase()}
                    </Button>
                  ) : (
                    <span />
                  )}
                  {nextStep ? (
                    <Button
                      variant={data.steps[stepInfo.key].complete ? 'default' : 'outline'}
                      className="min-h-11"
                      onClick={() => goTo(nextStep.key)}
                    >
                      Next: {nextStep.title.toLowerCase()}
                      <ArrowRight aria-hidden="true" />
                    </Button>
                  ) : allDone ? (
                    <Button className="min-h-11" onClick={() => goTo('done')}>
                      See summary
                      <ArrowRight aria-hidden="true" />
                    </Button>
                  ) : null}
                </footer>
              </section>
            ) : null}
          </div>
        </>
      ) : null}
      {sheet}
    </PageShell>
  );
}

function WizardSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-11 w-full sm:max-w-sm" />
      <div className="grid grid-cols-5 gap-2">
        {STEPS.map((s) => (
          <Skeleton key={s.key} className="h-14" />
        ))}
      </div>
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
