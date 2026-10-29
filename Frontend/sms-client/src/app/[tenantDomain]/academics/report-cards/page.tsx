'use client';

// Report cards (phase4-design.md section 5): pick a class of the current school year, see its
// students, open one report card or print the whole class. Cards print on A4, one per page,
// without the app around them (see components/report-cards/print-root.tsx).
import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { ColumnDef } from '@tanstack/react-table';
import { AlertCircle, ArrowLeft, CalendarRange, ChevronLeft, ChevronRight, FileText, Printer, School } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';
import { PageShell } from '@/components/ui/page-shell';
import { Skeleton } from '@/components/ui/skeleton';
import { errorMessage } from '@/components/students/format';
import { className as classLabel, useYearClasses } from '@/components/class-placement/queries';
import { ReportCard } from '@/components/report-cards/report-card';
import { ReportCardPrintRoot, usePrintRequest } from '@/components/report-cards/print-root';
import { useClassReportCards } from '@/components/report-cards/queries';
import { useCurrentAcademicYearDetail } from '@/hooks/queries/academic-years';
import { useTenant } from '@/hooks/use-tenant';
import {
  formatScore,
  isFailing,
  ordinal,
  type ReportCardData,
  type ReportCardSchool,
} from '@/services/api/results-service';

const selectClass =
  'h-11 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50 md:h-9';

function hasUnpublishedColumns(cards: ReportCardData[]): boolean {
  return cards.some((c) =>
    c.subjects.some((s) =>
      s.semesters.some((sem) => sem.published && (!sem.published.exam || sem.published.periods.some((p) => !p)))
    )
  );
}

function failedSubjects(card: ReportCardData): number {
  return card.subjects.filter((s) =>
    s.passed !== null ? !s.passed : isFailing(s.yearly_average, card.pass_mark)
  ).length;
}

function useUrlParam(name: string): [string, (value: string, extra?: Record<string, string>) => void] {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const value = searchParams.get(name) ?? '';
  const set = React.useCallback(
    (next: string, extra: Record<string, string> = {}) => {
      const qs = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries({ [name]: next, ...extra })) {
        if (v) qs.set(k, v);
        else qs.delete(k);
      }
      const query = qs.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [name, pathname, router, searchParams]
  );
  return [value, set];
}

function ReportCardsScreen() {
  const { tenant } = useTenant();
  const school: ReportCardSchool = React.useMemo(
    () => ({ name: tenant?.name && tenant.name !== 'Loading...' ? tenant.name : '', logo: tenant?.logo ?? null }),
    [tenant?.name, tenant?.logo]
  );

  const yearQuery = useCurrentAcademicYearDetail();
  const year = yearQuery.data ?? null;
  const classesQuery = useYearClasses(year?.id);
  const classes = React.useMemo(() => classesQuery.data ?? [], [classesQuery.data]);

  const [classId, setClassId] = useUrlParam('class');
  const [studentId, setStudentId] = useUrlParam('student');
  const selectedClass = classes.find((c) => c.id === classId);

  const cardsQuery = useClassReportCards(selectedClass?.id, year?.id);
  const cards = React.useMemo(
    () =>
      [...(cardsQuery.data ?? [])].sort((a, b) =>
        a.student.name.localeCompare(b.student.name, undefined, { sensitivity: 'base' })
      ),
    [cardsQuery.data]
  );
  const openIndex = studentId ? cards.findIndex((c) => c.student.id === studentId) : -1;
  const openCard = openIndex >= 0 ? cards[openIndex] : null;

  // What prints: the open card, or every card ("Print all", and Ctrl+P on the list).
  const [printAll, setPrintAll] = React.useState(false);
  const requestPrint = usePrintRequest();
  React.useEffect(() => {
    const reset = () => setPrintAll(false);
    window.addEventListener('afterprint', reset);
    return () => window.removeEventListener('afterprint', reset);
  }, []);
  const printCards = openCard && !printAll ? [openCard] : cards;

  const classSelectId = React.useId();

  const columns = React.useMemo<ColumnDef<ReportCardData>[]>(
    () => [
      {
        id: 'name',
        accessorFn: (c) => c.student.name,
        header: 'Student',
        cell: ({ row }) => <span className="font-medium">{row.original.student.name}</span>,
      },
      {
        id: 'admission_number',
        accessorFn: (c) => c.student.admission_number ?? '',
        header: 'Admission no.',
        meta: { hideOnMobile: true },
        cell: ({ row }) => row.original.student.admission_number || '—',
      },
      {
        id: 'yearly_average',
        accessorFn: (c) => c.overall.yearly_average ?? -1,
        header: 'Yearly average',
        meta: { className: 'text-right' },
        cell: ({ row }) => {
          const value = row.original.overall.yearly_average;
          const failing = isFailing(value, row.original.pass_mark);
          return (
            <span className={failing ? 'font-semibold text-red-700 tabular-nums' : 'tabular-nums'}>
              {formatScore(value)}
              {failing ? (
                <>
                  <span aria-hidden="true">*</span>
                  <span className="sr-only"> (below the pass mark)</span>
                </>
              ) : null}
            </span>
          );
        },
      },
      {
        id: 'rank',
        accessorFn: (c) => c.overall.rank ?? Number.MAX_SAFE_INTEGER,
        header: 'Rank',
        meta: { className: 'text-right' },
        cell: ({ row }) => {
          const { rank, class_size } = row.original.overall;
          return rank ? `${ordinal(rank)}${class_size ? ` of ${class_size}` : ''}` : '—';
        },
      },
      {
        id: 'failed',
        accessorFn: (c) => failedSubjects(c),
        header: 'Subjects below pass mark',
        meta: { className: 'text-right', hideOnMobile: true },
        cell: ({ getValue }) => {
          const n = getValue() as number;
          return n > 0 ? <span className="font-semibold text-red-700">{n}</span> : '0';
        },
      },
      {
        id: 'open',
        header: () => <span className="sr-only">Actions</span>,
        enableSorting: false,
        meta: { className: 'text-right' },
        cell: ({ row }) => (
          <Button
            variant="outline"
            size="sm"
            className="min-h-11 md:min-h-8"
            onClick={(e) => {
              e.stopPropagation();
              setStudentId(row.original.student.id);
            }}
          >
            Open report card
          </Button>
        ),
      },
    ],
    [setStudentId]
  );

  const unpublishedNote =
    cards.length > 0 && hasUnpublishedColumns(cards) ? (
      <p className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 print:hidden">
        Some results of this class aren&rsquo;t published yet. Those columns show &ldquo;—&rdquo; and
        &ldquo;not published&rdquo; on the cards. Publish them in Review and publish.
      </p>
    ) : null;

  let body: React.ReactNode;
  if (yearQuery.isLoading || (year && classesQuery.isLoading)) {
    body = <Skeleton className="h-64 w-full" />;
  } else if (yearQuery.error || classesQuery.error) {
    body = (
      <EmptyState
        icon={AlertCircle}
        description={errorMessage(
          yearQuery.error ?? classesQuery.error,
          "The classes couldn't be loaded. Check your connection and try again."
        )}
        action={
          <Button variant="outline" onClick={() => void (yearQuery.error ? yearQuery.refetch() : classesQuery.refetch())}>
            Try again
          </Button>
        }
      />
    );
  } else if (!year) {
    body = (
      <EmptyState
        icon={CalendarRange}
        title="No current school year"
        description="Set the current school year first. Report cards are made for the current year's classes."
      />
    );
  } else if (classes.length === 0) {
    body = (
      <EmptyState
        icon={School}
        title="No classes this year"
        description="Create this year's classes and place students in them first."
      />
    );
  } else if (!selectedClass) {
    body = <EmptyState icon={FileText} description="Choose a class to see its students' report cards." />;
  } else if (cardsQuery.error) {
    body = (
      <EmptyState
        icon={AlertCircle}
        description={errorMessage(cardsQuery.error, "The report cards couldn't be loaded. Try again.")}
        action={
          <Button variant="outline" onClick={() => void cardsQuery.refetch()}>
            Try again
          </Button>
        }
      />
    );
  } else if (studentId && openCard) {
    body = (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between print:hidden">
          <Button variant="ghost" className="min-h-11 w-fit md:min-h-9" onClick={() => setStudentId('')}>
            <ArrowLeft aria-hidden="true" />
            All students
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              className="min-h-11 md:min-h-9"
              disabled={openIndex <= 0}
              onClick={() => setStudentId(cards[openIndex - 1].student.id)}
            >
              <ChevronLeft aria-hidden="true" />
              Previous student
            </Button>
            <span className="text-sm text-muted-foreground" aria-live="polite">
              {openIndex + 1} of {cards.length}
            </span>
            <Button
              variant="outline"
              className="min-h-11 md:min-h-9"
              disabled={openIndex >= cards.length - 1}
              onClick={() => setStudentId(cards[openIndex + 1].student.id)}
            >
              Next student
              <ChevronRight aria-hidden="true" />
            </Button>
            <Button
              className="min-h-11 md:min-h-9"
              onClick={() => {
                setPrintAll(false);
                requestPrint();
              }}
            >
              <Printer aria-hidden="true" />
              Print report card
            </Button>
          </div>
        </div>
        {unpublishedNote}
        <div className="overflow-x-auto rounded-xl border bg-muted/40 p-2 sm:p-6 print:hidden">
          <div className="min-w-[720px] shadow-sm">
            <ReportCard card={openCard} school={school} />
          </div>
        </div>
      </div>
    );
  } else {
    body = (
      <div className="flex flex-col gap-4">
        {studentId && !cardsQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">
            That student isn&rsquo;t in {classLabel(selectedClass)}. Choose a student from the list.
          </p>
        ) : null}
        {unpublishedNote}
        <DataTable
          columns={columns}
          data={cards}
          label={`Students of ${classLabel(selectedClass)}`}
          loading={cardsQuery.isLoading}
          searchable
          searchPlaceholder="Search students"
          pageSize={50}
          getRowId={(c, i) => c.student.id || String(i)}
          onRowClick={(c) => setStudentId(c.student.id)}
          emptyState={
            <EmptyState
              title="No students in this class"
              description="Place students in this class first; their report cards will appear here."
            />
          }
        />
      </div>
    );
  }

  return (
    <PageShell
      title="Report cards"
      description={
        year
          ? `Report cards for ${year.name}. Open one to check it, or print the whole class on A4.`
          : 'Open a report card to check it, or print the whole class on A4.'
      }
      primaryAction={
        selectedClass ? (
          <Button
            variant={openCard ? 'outline' : 'default'}
            disabled={cards.length === 0 || cardsQuery.isLoading}
            onClick={() => {
              setPrintAll(true);
              requestPrint();
            }}
          >
            <Printer aria-hidden="true" />
            Print all ({cards.length})
          </Button>
        ) : undefined
      }
      className="print:hidden"
    >
      {classes.length > 0 ? (
        <div className="grid gap-2 sm:w-72">
          <label htmlFor={classSelectId} className="text-sm font-medium">
            Class
          </label>
          <select
            id={classSelectId}
            className={selectClass}
            value={selectedClass?.id ?? ''}
            onChange={(e) => setClassId(e.target.value, { student: '' })}
          >
            <option value="">Choose a class</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {classLabel(c)}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {body}

      <ReportCardPrintRoot cards={printCards} school={school} />
    </PageShell>
  );
}

export default function ReportCardsPage() {
  return (
    <React.Suspense fallback={<Skeleton className="m-6 h-64" />}>
      <ReportCardsScreen />
    </React.Suspense>
  );
}
