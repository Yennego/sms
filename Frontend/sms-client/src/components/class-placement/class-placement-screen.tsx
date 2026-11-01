'use client';

// Class placement: put this year's students into classes, a page at a time.
// The server filters, searches, sorts and pages (GET /academics/class-placement/roster); tab,
// filters, search, sort, page and page size live in the URL. Selected students are kept by id
// across pages and placed together (up to 200) with POST /academics/class-placement.
import * as React from 'react';
import Link from 'next/link';
import type { ColumnDef } from '@tanstack/react-table';
import { CheckCircle2, Loader2, RefreshCw, Search, UserPlus, Users } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';
import { PageShell } from '@/components/ui/page-shell';
import { Pagination } from '@/components/ui/pagination';
import { StatusBadge } from '@/components/ui/status-badge';
import { notify } from '@/components/ui/toaster';
import { errorMessage } from '@/components/students/format';
import {
  MAX_PLACEMENT_BATCH,
  placementConflict,
  type PlacementProblem,
  type RosterParams,
  type RosterPlacement,
  type RosterStudent,
} from '@/services/api/class-placement-service';
import { ClassPicker, PlaceOneSheet, ProblemsDialog } from './placement-dialogs';
import { className as classLabel, usePlaceStudents, useRoster, useYearClasses } from './queries';
import { isRosterSort, LabeledSelect, PAGE_SIZES, SearchBox, SORT_OPTIONS } from './roster-controls';
import { positiveInt, useDebouncedSearch, useUrlState } from './use-url-state';

const TABS: { value: RosterPlacement; label: string }[] = [
  { value: 'unplaced', label: 'Not placed' },
  { value: 'placed', label: 'Placed' },
  { value: 'all', label: 'All' },
];

const URL_DEFAULTS = { tab: 'unplaced', class: '', q: '', sort: 'name', page: '1', size: '25' };

const count = new Intl.NumberFormat('en-US');

function plural(n: number, one: string, many: string) {
  return `${count.format(n)} ${n === 1 ? one : many}`;
}

type Conflict = { message: string; problems: (PlacementProblem & { name: string })[] };

function RowCheckbox({
  checked,
  indeterminate = false,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  const ref = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);
  return (
    <label className="-m-2 inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-md focus-within:ring-[3px] focus-within:ring-ring/50">
      <input
        ref={ref}
        type="checkbox"
        className="size-5 cursor-pointer accent-primary outline-none"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="sr-only">{label}</span>
    </label>
  );
}

export function ClassPlacementScreen({ school }: { school: string }) {
  const [url, setUrl] = useUrlState(URL_DEFAULTS);
  const tab: RosterPlacement = TABS.some((t) => t.value === url.tab) ? (url.tab as RosterPlacement) : 'unplaced';
  const sort = isRosterSort(url.sort) ? url.sort : 'name';
  const pageSize = positiveInt(url.size, 25, PAGE_SIZES);
  const page = positiveInt(url.page, 1);
  // Students who aren't placed have no class, so the class filter only applies to the other tabs.
  const classFilter = tab === 'unplaced' ? '' : url.class;

  const commitSearch = React.useCallback((q: string) => setUrl({ q, page: null }), [setUrl]);
  const [searchText, setSearchText] = useDebouncedSearch(url.q, commitSearch);

  const params = React.useMemo<RosterParams>(
    () => ({
      placement: tab,
      classId: classFilter || undefined,
      q: url.q || undefined,
      sort,
      page,
      pageSize,
    }),
    [tab, classFilter, url.q, sort, page, pageSize]
  );

  const roster = useRoster(params);
  const data = roster.data;
  const classesQuery = useYearClasses(data?.academic_year?.id);
  const classes = React.useMemo(() => classesQuery.data ?? [], [classesQuery.data]);

  // A page past the end (e.g. after placing everyone on the last page): go to the last page.
  React.useEffect(() => {
    if (!data || roster.isPlaceholderData) return;
    if (data.items.length === 0 && page > 1) setUrl({ page: data.pages > 1 ? data.pages : null });
  }, [data, roster.isPlaceholderData, page, setUrl]);

  // ---- selection (kept by id across pages and filters) ----
  const [selected, setSelected] = React.useState<Map<string, RosterStudent>>(() => new Map());
  const [targetClass, setTargetClass] = React.useState('');
  const [oneStudent, setOneStudent] = React.useState<RosterStudent | null>(null);
  const [conflict, setConflict] = React.useState<Conflict | null>(null);
  const place = usePlaceStudents();

  const warnCap = React.useCallback(() => {
    notify.warning(`You can place up to ${MAX_PLACEMENT_BATCH} students at a time.`, {
      description: 'Place the students you have chosen first, then select more.',
    });
  }, []);

  const toggleOne = React.useCallback(
    (student: RosterStudent, checked: boolean) => {
      setSelected((prev) => {
        const next = new Map(prev);
        if (!checked) {
          next.delete(student.student_id);
          return next;
        }
        if (next.size >= MAX_PLACEMENT_BATCH) {
          warnCap();
          return prev;
        }
        next.set(student.student_id, student);
        return next;
      });
    },
    [warnCap]
  );

  const items = React.useMemo(() => data?.items ?? [], [data]);
  const selectedOnPage = items.filter((s) => selected.has(s.student_id)).length;
  const allOnPage = items.length > 0 && selectedOnPage === items.length;

  const togglePage = React.useCallback(
    (checked: boolean) => {
      setSelected((prev) => {
        const next = new Map(prev);
        if (!checked) {
          items.forEach((s) => next.delete(s.student_id));
          return next;
        }
        let capped = false;
        for (const s of items) {
          if (next.has(s.student_id)) continue;
          if (next.size >= MAX_PLACEMENT_BATCH) {
            capped = true;
            break;
          }
          next.set(s.student_id, s);
        }
        if (capped) warnCap();
        return next;
      });
    },
    [items, warnCap]
  );

  const clearSelection = () => setSelected(new Map());

  /** Returns true when the caller can close (saved, or the problems dialog took over). */
  const runPlacement = async (classId: string, students: RosterStudent[]): Promise<boolean> => {
    try {
      const r = await place.mutateAsync({ classId, studentIds: students.map((s) => s.student_id) });
      notify.success(`Placed ${r.placed}, moved ${r.moved}, already there ${r.unchanged}`, {
        description: r.class_name,
      });
      if (r.over_capacity) {
        notify.warning(
          `${r.class_name} now has ${r.enrolled} students for ${r.capacity ?? 0} seats`,
          { description: 'Move some students to another class, or add seats to this class in year setup.', duration: 10000 }
        );
      }
      setSelected((prev) => {
        const next = new Map(prev);
        students.forEach((s) => next.delete(s.student_id));
        return next;
      });
      return true;
    } catch (error) {
      const c = placementConflict(error);
      if (c) {
        const byId = new Map(students.map((s) => [s.student_id, s.name]));
        setConflict({
          message: c.message,
          problems: c.problems.map((p) => ({
            ...p,
            name: p.name || byId.get(p.student_id) || 'Unknown student',
          })),
        });
        return true;
      }
      notify.error(errorMessage(error, "Couldn't place the students. Check your connection and try again."));
      return false;
    }
  };

  const placeSelected = async () => {
    if (!targetClass || selected.size === 0) return;
    await runPlacement(targetClass, Array.from(selected.values()));
  };

  // ---- table ----
  const columns = React.useMemo<ColumnDef<RosterStudent>[]>(
    () => [
      {
        id: 'select',
        enableSorting: false,
        header: () => (
          <RowCheckbox
            checked={allOnPage}
            indeterminate={selectedOnPage > 0 && !allOnPage}
            onChange={togglePage}
            label="Select all on this page"
            disabled={items.length === 0}
          />
        ),
        cell: ({ row }) => (
          <RowCheckbox
            checked={selected.has(row.original.student_id)}
            onChange={(checked) => toggleOne(row.original, checked)}
            label={`Select ${row.original.name}`}
          />
        ),
        meta: { label: 'Select', className: 'w-14' },
      },
      {
        id: 'name',
        enableSorting: false,
        header: 'Name',
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="font-medium text-foreground">{row.original.name}</p>
            {row.original.username ? (
              <p className="text-xs break-all text-muted-foreground">{row.original.username}</p>
            ) : null}
          </div>
        ),
      },
      {
        id: 'admission',
        enableSorting: false,
        header: 'Admission no.',
        cell: ({ row }) => row.original.admission_number || <span className="text-muted-foreground">None</span>,
      },
      {
        id: 'class',
        enableSorting: false,
        header: 'Class',
        cell: ({ row }) =>
          row.original.enrollment ? (
            row.original.enrollment.class_name || 'Unnamed class'
          ) : (
            <StatusBadge status="pending" label="Not placed" />
          ),
      },
      {
        id: 'action',
        enableSorting: false,
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-11 md:min-h-8"
            onClick={() => setOneStudent(row.original)}
            aria-label={`${row.original.enrollment ? 'Move' : 'Place'} ${row.original.name}`}
          >
            {row.original.enrollment ? 'Move' : 'Place'}
          </Button>
        ),
        meta: { label: 'Actions', className: 'text-right' },
      },
    ],
    [allOnPage, selectedOnPage, togglePage, items.length, selected, toggleOne]
  );

  const filtered = Boolean(url.q || classFilter);
  const clearFilters = () => {
    setSearchText('');
    setUrl({ q: null, class: null, page: null });
  };

  const emptyState = filtered ? (
    <EmptyState
      icon={Search}
      title="No matches"
      description="No students match your search or class. Try another search, or show everyone."
      action={
        <Button variant="outline" onClick={clearFilters}>
          Clear search and filters
        </Button>
      }
    />
  ) : tab === 'unplaced' ? (
    <EmptyState
      icon={CheckCircle2}
      title="All placed"
      description={
        data && data.counts.all > 0
          ? 'Everyone is placed in a class this year.'
          : 'There are no active students yet. Admit students, then place them in classes here.'
      }
      action={
        data && data.counts.all > 0 ? (
          <Button variant="outline" onClick={() => setUrl({ tab: 'placed', page: null })}>
            See placed students
          </Button>
        ) : (
          <Button asChild>
            <Link href={`/${school}/students/new`}>Admit a student</Link>
          </Button>
        )
      }
    />
  ) : tab === 'placed' ? (
    <EmptyState
      icon={Users}
      title="Nobody placed yet"
      description="No student has a class this year yet. Start with the students who aren't placed."
      action={
        <Button onClick={() => setUrl({ tab: null, page: null })}>Show students not placed</Button>
      }
    />
  ) : (
    <EmptyState
      icon={UserPlus}
      title="No students yet"
      description="Admit your first student, or import a class list from a spreadsheet."
      action={
        <Button asChild>
          <Link href={`/${school}/students/new`}>Admit a student</Link>
        </Button>
      }
    />
  );

  const tabCount = (value: RosterPlacement) => {
    if (!data) return '';
    const n = value === 'unplaced' ? data.counts.unplaced : value === 'placed' ? data.counts.placed : data.counts.all;
    return ` (${count.format(n)})`;
  };

  const listId = React.useId();
  const barPickerId = React.useId();
  const target = classes.find((c) => c.id === targetClass);
  // Placing needs a school year: none set as current (or an older server answering 404)
  const noYear = (!!data && !data.academic_year)
    || (roster.isError && (roster.error as { statusCode?: number })?.statusCode === 404);

  return (
    <PageShell
      title="Class placement"
      description={
        data?.academic_year
          ? `School year ${data.academic_year.name}. Choose students, then the class to place them in.`
          : 'Choose students, then the class to place them in.'
      }
    >
      {roster.isError || noYear ? (
        <EmptyState
          icon={RefreshCw}
          title={noYear ? 'No current school year' : "Couldn't load students"}
          description={
            noYear
              ? 'Set the current school year first, then come back to place students.'
              : `${errorMessage(roster.error, "The server didn't answer.")} Check your connection and try again.`
          }
          action={
            noYear ? undefined : (
              <Button variant="outline" onClick={() => roster.refetch()}>
                Try again
              </Button>
            )
          }
        />
      ) : (
        <>
          {/* Placement tabs */}
          <div
            role="tablist"
            aria-label="Placement"
            className="-mx-4 flex gap-1 overflow-x-auto border-b px-4 [scrollbar-width:none] md:mx-0 md:px-0"
          >
            {TABS.map((t) => (
              <button
                key={t.value}
                type="button"
                role="tab"
                id={`${listId}-tab-${t.value}`}
                aria-selected={tab === t.value}
                aria-controls={listId}
                onClick={() => setUrl({ tab: t.value, page: null })}
                className={cn(
                  '-mb-px inline-flex min-h-11 shrink-0 items-center border-b-2 px-3 text-sm font-medium whitespace-nowrap outline-none transition-colors',
                  'focus-visible:rounded-md focus-visible:ring-[3px] focus-visible:ring-ring/50',
                  tab === t.value
                    ? 'border-primary text-foreground'
                    : 'border-transparent text-muted-foreground hover:border-border hover:text-foreground'
                )}
              >
                {t.label}
                {tabCount(t.value)}
              </button>
            ))}
          </div>

          {/* Filters */}
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <SearchBox
              value={searchText}
              onChange={setSearchText}
              placeholder="Search by name, username or admission no."
            />
            {tab !== 'unplaced' ? (
              <LabeledSelect
                label="Class"
                value={classFilter}
                onChange={(v) => setUrl({ class: v, page: null })}
              >
                <option value="">All classes</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {classLabel(c)}
                  </option>
                ))}
              </LabeledSelect>
            ) : null}
            <div className="sm:ml-auto">
              <LabeledSelect
                label="Sort by"
                hideLabel={false}
                value={sort}
                onChange={(v) => setUrl({ sort: v, page: null })}
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </LabeledSelect>
            </div>
          </div>

          {/* Phone: the table header (with "select all") isn't shown, so offer it here. */}
          {items.length > 0 ? (
            <div className="flex items-center gap-3 pl-2 text-sm md:hidden">
              <RowCheckbox
                checked={allOnPage}
                indeterminate={selectedOnPage > 0 && !allOnPage}
                onChange={togglePage}
                label="Select all on this page"
              />
              <span aria-hidden="true">Select all on this page</span>
            </div>
          ) : null}

          <div
            id={listId}
            role="tabpanel"
            aria-labelledby={`${listId}-tab-${tab}`}
            aria-busy={roster.isFetching || undefined}
            className={cn('flex flex-col gap-4 transition-opacity', roster.isPlaceholderData && 'opacity-60')}
          >
            <DataTable
              label="Students"
              columns={columns}
              data={items}
              loading={roster.isLoading || (!data && roster.isFetching)}
              loadingRows={Math.min(pageSize, 10)}
              pageSize={0}
              getRowId={(s) => s.student_id}
              emptyState={emptyState}
              mobileCard={(s) => (
                <div className="flex items-start gap-3">
                  <div className="pt-1 pl-2">
                    <RowCheckbox
                      checked={selected.has(s.student_id)}
                      onChange={(checked) => toggleOne(s, checked)}
                      label={`Select ${s.name}`}
                    />
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="font-medium break-words text-foreground">{s.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {[s.admission_number, s.username].filter(Boolean).join(' · ') || 'No admission no.'}
                    </p>
                    <div className="text-sm">
                      {s.enrollment ? (
                        s.enrollment.class_name || 'Unnamed class'
                      ) : (
                        <StatusBadge status="pending" label="Not placed" />
                      )}
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11 shrink-0"
                    onClick={() => setOneStudent(s)}
                    aria-label={`${s.enrollment ? 'Move' : 'Place'} ${s.name}`}
                  >
                    {s.enrollment ? 'Move' : 'Place'}
                  </Button>
                </div>
              )}
            />

            {data && data.total > 0 ? (
              <Pagination
                label="Student pages"
                itemLabel="students"
                page={page}
                pageSize={pageSize}
                total={data.total}
                onPageChange={(p) => setUrl({ page: p })}
                onPageSizeChange={(size) => setUrl({ size, page: null })}
                pageSizeOptions={PAGE_SIZES}
              />
            ) : null}
          </div>
        </>
      )}

      {/* Sticky action bar for the selection (sits above the phone bottom bar). */}
      {selected.size > 0 ? (
        <div
          role="region"
          aria-label="Selected students"
          className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 flex flex-col gap-3 rounded-xl border bg-background p-3 shadow-lg lg:bottom-4 lg:flex-row lg:items-center"
        >
          <p className="flex items-center gap-1 text-sm" aria-live="polite">
            <span className="font-medium text-foreground">{count.format(selected.size)} selected</span>
            <span aria-hidden="true">·</span>
            <Button
              type="button"
              variant="link"
              className="h-auto min-h-11 px-1 md:min-h-0"
              onClick={clearSelection}
              disabled={place.isPending}
            >
              Clear
            </Button>
            {selected.size >= MAX_PLACEMENT_BATCH ? (
              <span className="text-muted-foreground">(the most for one placement)</span>
            ) : null}
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center lg:ml-auto">
            <label htmlFor={barPickerId} className="text-sm text-foreground">
              Place {plural(selected.size, 'student', 'students')} in
            </label>
            <ClassPicker
              id={barPickerId}
              classes={classes}
              value={targetClass}
              onChange={setTargetClass}
              disabled={place.isPending}
            />
            <Button
              type="button"
              className="min-h-11 md:min-h-9"
              onClick={placeSelected}
              disabled={!target || place.isPending}
            >
              {place.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
              Place students
            </Button>
          </div>
        </div>
      ) : null}

      <PlaceOneSheet
        student={oneStudent}
        classes={classes}
        pending={place.isPending}
        onOpenChange={(open) => {
          if (!open) setOneStudent(null);
        }}
        onPlace={(student, classId) => runPlacement(classId, [student])}
      />
      <ProblemsDialog conflict={conflict} onClose={() => setConflict(null)} />
    </PageShell>
  );
}
