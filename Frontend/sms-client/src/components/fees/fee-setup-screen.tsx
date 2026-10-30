'use client';

// Fee setup (/{school}/finance/structures): per school year and semester, the fees per grade
// level × category in USD and LRD, the semester's installment plan, fee categories, and
// "Issue invoices". Year, semester and section live in the URL (?year=&semester=&section=).
import * as React from 'react';
import { CalendarRange, FileText } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { PageShell } from '@/components/ui/page-shell';
import { Skeleton } from '@/components/ui/skeleton';
import { useUrlState } from '@/components/class-placement/use-url-state';
import { YearSelect, useResultYears } from '@/components/results/year-select';
import { useGrades } from '@/hooks/queries/academic-grades';
import { useSemesters } from '@/hooks/queries/semesters-periods';
import { useFeesPermissions } from './queries';
import { CategoriesPanel, InstallmentPlanPanel, IssueInvoicesSheet, SchedulesPanel } from './setup-panels';
import { LoadError, nativeSelectClassName, SegmentTabs } from './shared';

type Section = 'fees' | 'installments' | 'categories';

const SECTIONS: { value: Section; label: string }[] = [
  { value: 'fees', label: 'Fees' },
  { value: 'installments', label: 'Installment plan' },
  { value: 'categories', label: 'Categories' },
];

export function FeeSetupScreen() {
  const perms = useFeesPermissions();
  const years = useResultYears();
  const [url, setUrl] = useUrlState({ year: '', semester: '', section: 'fees' });
  const section = SECTIONS.some((s) => s.value === url.section) ? (url.section as Section) : 'fees';
  const semestersQ = useSemesters(years.yearId ?? null);
  const semesters = React.useMemo(
    () => [...(semestersQ.data ?? [])].sort((a, b) => (a.semester_number ?? 0) - (b.semester_number ?? 0)),
    [semestersQ.data]
  );
  const semester =
    semesters.find((s) => s.id === url.semester) ?? semesters.find((s) => s.is_current) ?? semesters[0];
  const gradesData = useGrades(true).data;
  const grades = React.useMemo(
    () => (Array.isArray(gradesData) ? [...gradesData] : []).sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0)),
    [gradesData]
  );
  const [issuing, setIssuing] = React.useState(false);
  const panelId = React.useId();
  const semesterSelectId = React.useId();

  const needsSemester = section !== 'categories';

  return (
    <PageShell
      title="Fee setup"
      description="Set what each grade level pays per semester, when it's due, then issue the bills."
      primaryAction={
        perms.setup && years.yearId && semesters.length > 0 ? (
          <Button onClick={() => setIssuing(true)}>
            <FileText aria-hidden="true" />
            Issue invoices
          </Button>
        ) : undefined
      }
    >
      <SegmentTabs
        label="Fee setup"
        tabs={SECTIONS}
        value={section}
        onChange={(v) => setUrl({ section: v })}
        controls={panelId}
      />

      <div id={panelId} role="tabpanel" className="flex flex-col gap-6">
        {needsSemester ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <YearSelect years={years.years} value={years.yearId} onChange={(id) => setUrl({ year: id, semester: null })} />
            {semesters.length > 0 ? (
              <div className="flex w-full flex-col gap-1 sm:w-64">
                <label htmlFor={semesterSelectId} className="text-sm font-medium text-foreground">
                  Semester
                </label>
                <select
                  id={semesterSelectId}
                  className={nativeSelectClassName}
                  value={semester?.id ?? ''}
                  onChange={(e) => setUrl({ semester: e.target.value })}
                >
                  {semesters.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
          </div>
        ) : null}

        {needsSemester && years.isError ? (
          <LoadError error={null} what="school years" onRetry={years.refetch} />
        ) : needsSemester && (years.isLoading || semestersQ.isLoading) ? (
          <Skeleton className="h-40" />
        ) : needsSemester && semestersQ.isError ? (
          <LoadError error={semestersQ.error} what="semesters" onRetry={() => semestersQ.refetch()} />
        ) : needsSemester && (!years.yearId || !semester) ? (
          <EmptyState
            icon={CalendarRange}
            title="No semesters for this school year"
            description="Add the year's semesters in Years and terms first, then set the fees here."
          />
        ) : section === 'fees' && years.yearId && semester ? (
          <SchedulesPanel yearId={years.yearId} semesterId={semester.id} grades={grades} canEdit={perms.setup} />
        ) : section === 'installments' && years.yearId && semester ? (
          <InstallmentPlanPanel key={semester.id} yearId={years.yearId} semester={semester} canEdit={perms.setup} />
        ) : section === 'categories' ? (
          <CategoriesPanel canEdit={perms.setup} />
        ) : null}
      </div>

      {perms.setup && years.yearId && semester ? (
        <IssueInvoicesSheet
          open={issuing}
          onOpenChange={setIssuing}
          yearId={years.yearId}
          semesters={semesters}
          defaultSemesterId={semester.id}
          grades={grades}
        />
      ) : null}
    </PageShell>
  );
}
