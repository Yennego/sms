'use client';

// One class: its details, timetable periods and students, with export to CSV / Excel and a panel to
// enroll more students of the class's grade and section in the current school year.

import * as React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import type { ColumnDef } from '@tanstack/react-table';
import { Download, Pencil, School, UserPlus, Users } from 'lucide-react';

import { CountTiles } from '@/components/attendance/attendance-ui';
import {
  rosterStudentId,
  rosterStudentName,
  useClassRoster,
  useClassSchedules,
  useEnrollCandidates,
  useEnrollInClass,
  type RosterEntry,
} from '@/components/classes/queries-setup';
import { selectClass } from '@/components/students/admission-form';
import { capitalize, errorMessage, formatDate, fullName, isNotFound } from '@/components/students/format';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { DataTable } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { PageShell } from '@/components/ui/page-shell';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/ui/status-badge';
import { notify } from '@/components/ui/toaster';
import { useClass } from '@/hooks/queries/classes';
import { useCurrentAcademicYear, useEnrollmentGrades } from '@/hooks/queries/enrollments';
import { useSectionsByGrade } from '@/hooks/queries/sections';
import { useTenantNavigation } from '@/hooks/use-tenant';
import { useClassService } from '@/services/api/class-service';

const inputClass = 'h-11 text-base md:h-9 md:text-sm';

function Panel({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4 rounded-xl border bg-card p-4 md:p-6" aria-label={title}>
      <div>
        <h2 className="text-base font-semibold">{title}</h2>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

const rosterColumns: ColumnDef<RosterEntry>[] = [
  {
    id: 'name',
    accessorFn: (e) => rosterStudentName(e),
    header: 'Student',
    cell: ({ row }) => (
      <div>
        <p className="font-medium">{rosterStudentName(row.original)}</p>
        {row.original.admission_number ? (
          <p className="text-sm text-muted-foreground">{row.original.admission_number}</p>
        ) : null}
      </div>
    ),
  },
  {
    id: 'enrolled',
    accessorFn: (e) => e.enrollment_date ?? '',
    header: 'Enrolled',
    cell: ({ row }) => formatDate(row.original.enrollment_date) || '–',
  },
];

export default function ClassDetailPage() {
  const { id: classId } = useParams<{ id: string }>();
  const { createTenantPath } = useTenantNavigation();
  const { exportClassEnrollments } = useClassService();
  const details = useClass(classId, 'full');
  const roster = useClassRoster(classId);
  const schedules = useClassSchedules(classId);
  const year = useCurrentAcademicYear();
  const enroll = useEnrollInClass(classId);
  const backPath = createTenantPath('/classes');

  // Enroll panel: grade and section default to the class's own
  const { data: grades = [] } = useEnrollmentGrades();
  const [gradeChoice, setGradeChoice] = React.useState<string | null>(null);
  const [sectionChoice, setSectionChoice] = React.useState<string | null>(null);
  const gradeId = gradeChoice ?? details.data?.grade_id ?? '';
  const { data: sections = [] } = useSectionsByGrade(gradeId);
  const wantedSection = sectionChoice ?? details.data?.section_id ?? '';
  const sectionId = sections.some((s) => s.id === wantedSection) ? wantedSection : (sections[0]?.id ?? '');
  const gradeName = grades.find((g) => g.id === gradeId)?.name ?? '';
  const sectionName = sections.find((s) => s.id === sectionId)?.name ?? '';

  const rosterIds = React.useMemo(
    () => new Set((roster.data?.entries ?? []).map(rosterStudentId).filter((v): v is string => Boolean(v))),
    [roster.data]
  );
  const candidates = useEnrollCandidates(classId, gradeName, sectionName, rosterIds);
  const [search, setSearch] = React.useState('');
  const [selected, setSelected] = React.useState<string[]>([]);
  const [studentIdInput, setStudentIdInput] = React.useState('');

  const shown = React.useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return candidates.data;
    return candidates.data.filter(
      (s) =>
        fullName(s).toLowerCase().includes(term) ||
        s.id.toLowerCase().includes(term) ||
        (s.admission_number || '').toLowerCase().includes(term)
    );
  }, [candidates.data, search]);
  const selectedToEnroll = selected.filter((id) => !rosterIds.has(id));
  const yearId = year.data?.id ?? '';

  const enrollStudents = async (ids: string[]) => {
    const toEnroll = ids.map((id) => id.trim()).filter((id) => id && !rosterIds.has(id));
    if (!yearId) return;
    if (!toEnroll.length) {
      notify.info(ids.length === 1 ? 'That student is already in this class.' : 'All selected students are already in this class.');
      return;
    }
    try {
      await enroll.mutateAsync({ studentIds: toEnroll, academicYearId: yearId });
      setSelected((prev) => prev.filter((id) => !toEnroll.includes(id)));
      if (toEnroll.length === 1 && toEnroll[0] === studentIdInput.trim()) setStudentIdInput('');
      notify.success(toEnroll.length === 1 ? 'Student enrolled in the class.' : `${toEnroll.length} students enrolled in the class.`);
    } catch (err) {
      const message = errorMessage(err, '');
      if (toEnroll.length === 1 && message.toLowerCase().includes('already')) {
        notify.info('That student is already in this class.');
        setSelected((prev) => prev.filter((id) => id !== toEnroll[0]));
      } else {
        notify.error(message || "The enrollment wasn't saved. Try again.");
      }
    }
  };

  const exportRoster = async (format: 'csv' | 'xlsx') => {
    try {
      const blob = await exportClassEnrollments(classId, { format, details: true, is_active: true });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `class_${classId}_enrollments.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      notify.success(`The class list is downloaded (${format === 'csv' ? 'CSV' : 'Excel'}).`);
    } catch (err) {
      notify.error(errorMessage(err, "The class list wasn't exported. Try again."));
    }
  };

  const eyebrow = (
    <Link href={backPath} className="inline-flex min-h-11 items-center hover:underline md:min-h-0">
      ← Class rosters
    </Link>
  );

  if (details.isLoading) {
    return (
      <PageShell title="Class" eyebrow={eyebrow}>
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </PageShell>
    );
  }

  if (details.isError || !details.data) {
    return (
      <PageShell title="Class" eyebrow={eyebrow}>
        {isNotFound(details.error) || !details.isError ? (
          <EmptyState
            icon={School}
            title="Class not found"
            description="It may have been deleted. Go back to the class rosters and pick another class."
            action={
              <Button asChild>
                <Link href={backPath}>Open class rosters</Link>
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={School}
            title="The class didn't load"
            description={`${errorMessage(details.error, 'The server didn’t answer.')} Check your connection and try again.`}
            action={<Button onClick={() => details.refetch()}>Try again</Button>}
          />
        )}
      </PageShell>
    );
  }

  const c = details.data;
  const gradeSection = [c.grade_name, c.section_name].filter(Boolean).join(' - ');
  const facts: Array<[string, React.ReactNode]> = [
    ['School year', c.academic_year_name || '–'],
    ['Grade and section', gradeSection || '–'],
    ['Subject', c.subject_name || '–'],
    ['Class sponsor', c.class_teacher_name || '–'],
    ['Room', c.room || '–'],
    ['Dates', c.start_date ? `${formatDate(c.start_date)}${c.end_date ? ` to ${formatDate(c.end_date)}` : ''}` : '–'],
  ];
  const scheduleList = schedules.data ?? [];

  return (
    <PageShell
      title={c.name || gradeSection || 'Class'}
      description={
        <span className="inline-flex flex-wrap items-center gap-2">
          {c.is_active ? <StatusBadge status="success" label="Active" /> : <StatusBadge status="neutral" label="Inactive" />}
          {[gradeSection, c.academic_year_name].filter(Boolean).join(' · ')}
        </span>
      }
      eyebrow={eyebrow}
      secondaryActions={
        <>
          <Button variant="outline" className="min-h-11 md:min-h-9" onClick={() => exportRoster('csv')}>
            <Download aria-hidden="true" />
            Export CSV
          </Button>
          <Button variant="outline" className="min-h-11 md:min-h-9" onClick={() => exportRoster('xlsx')}>
            <Download aria-hidden="true" />
            Export Excel
          </Button>
        </>
      }
      primaryAction={
        <Button asChild className="min-h-11 md:min-h-9">
          <Link href={createTenantPath(`/classes/${classId}/edit`)}>
            <Pencil aria-hidden="true" />
            Edit class
          </Link>
        </Button>
      }
    >
      <CountTiles
        className="sm:grid-cols-2 lg:grid-cols-2"
        tiles={[
          { label: 'Students', value: roster.isLoading ? '–' : (roster.data?.count ?? 0) },
          { label: 'Timetable periods', value: schedules.isLoading ? '–' : scheduleList.length },
        ]}
      />

      <Panel title="Details">
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
          {facts.map(([label, value]) => (
            <div key={label}>
              <dt className="text-sm text-muted-foreground">{label}</dt>
              <dd className="font-medium">{value}</dd>
            </div>
          ))}
        </dl>
        {c.description ? <p className="text-sm text-muted-foreground">{c.description}</p> : null}
      </Panel>

      <Panel title="Timetable periods">
        {schedules.isLoading ? (
          <Skeleton className="h-16 w-full" />
        ) : schedules.isError ? (
          <EmptyState
            bare
            description="The periods didn't load. Check your connection and try again."
            action={<Button onClick={() => schedules.refetch()}>Try again</Button>}
          />
        ) : scheduleList.length === 0 ? (
          <p className="text-sm text-muted-foreground">No periods yet. Add them in the timetable.</p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {scheduleList.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                <span className="font-medium">{capitalize(s.day_of_week)}</span>
                <span className="text-sm text-muted-foreground tabular-nums">
                  {s.period !== undefined && s.period !== null ? `Period ${s.period} · ` : ''}
                  {s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Students">
        {roster.isError ? (
          <EmptyState
            bare
            icon={Users}
            description="The class list didn't load. Check your connection and try again."
            action={<Button onClick={() => roster.refetch()}>Try again</Button>}
          />
        ) : (
          <DataTable
            label="Students in the class"
            columns={rosterColumns}
            data={roster.data?.entries ?? []}
            loading={roster.isLoading}
            searchable
            searchPlaceholder="Search students"
            initialSorting={[{ id: 'name', desc: false }]}
            emptyState={<EmptyState icon={Users} description="No students yet. Enroll them below." />}
          />
        )}
      </Panel>

      <Panel
        title="Enroll students"
        description="Students are enrolled in this class for the current school year. The list shows active students of the chosen grade and section who aren't in the class yet."
      >
        {!year.isLoading && !yearId ? (
          <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            There is no current school year, so students can&apos;t be enrolled. Make a year current in Years and terms.
          </p>
        ) : null}
        <div className="grid gap-4 md:grid-cols-4">
          <div className="grid gap-2">
            <label htmlFor="enroll-grade" className="text-sm font-medium">
              Grade
            </label>
            <select
              id="enroll-grade"
              className={selectClass}
              value={gradeId}
              onChange={(e) => {
                setGradeChoice(e.target.value);
                setSectionChoice(null);
              }}
            >
              <option value="">Choose a grade</option>
              {grades.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-2">
            <label htmlFor="enroll-section" className="text-sm font-medium">
              Section
            </label>
            <select
              id="enroll-section"
              className={selectClass}
              value={sectionId}
              disabled={!gradeId}
              onChange={(e) => setSectionChoice(e.target.value)}
            >
              {sections.length === 0 ? <option value="">No sections</option> : null}
              {sections.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-2 md:col-span-2">
            <label htmlFor="enroll-search" className="text-sm font-medium">
              Search by name, ID or admission number
            </label>
            <Input id="enroll-search" className={inputClass} value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {candidates.isFetching ? 'Loading students…' : `${shown.length} student${shown.length === 1 ? '' : 's'} can join`}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              className="min-h-11 md:min-h-9"
              onClick={() => candidates.refetch()}
              disabled={!gradeId}
            >
              Refresh list
            </Button>
            <Button
              className="min-h-11 md:min-h-9"
              onClick={() => enrollStudents(selectedToEnroll)}
              disabled={!selectedToEnroll.length || !yearId || enroll.isPending}
            >
              <UserPlus aria-hidden="true" />
              Enroll {selectedToEnroll.length || ''} selected
            </Button>
          </div>
        </div>

        {candidates.isError ? (
          <EmptyState
            bare
            description="The students didn't load. Check your connection and try again."
            action={<Button onClick={() => candidates.refetch()}>Try again</Button>}
          />
        ) : candidates.isLoading && gradeId ? (
          <Skeleton className="h-32 w-full" />
        ) : !gradeId ? (
          <p className="text-sm text-muted-foreground">Choose a grade to list its students.</p>
        ) : shown.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {search.trim() ? 'No students match your search.' : 'Every active student of this grade and section is already in the class.'}
          </p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {shown.map((s) => {
              const checkboxId = `enroll-${s.id}`;
              return (
                <li key={s.id} className="flex items-center gap-3 p-3">
                  <Checkbox
                    id={checkboxId}
                    checked={selected.includes(s.id)}
                    onCheckedChange={(checked) =>
                      setSelected((prev) => (checked ? [...prev, s.id] : prev.filter((id) => id !== s.id)))
                    }
                  />
                  <label htmlFor={checkboxId} className="min-w-0 flex-1 cursor-pointer">
                    <span className="block font-medium">{fullName(s) === 'Unnamed' ? s.email : fullName(s)}</span>
                    <span className="block text-sm text-muted-foreground">
                      {[s.admission_number, [s.grade, s.section].filter(Boolean).join(' - ')].filter(Boolean).join(' · ')}
                    </span>
                  </label>
                  <Button
                    variant="outline"
                    size="sm"
                    className="min-h-11 md:min-h-9"
                    onClick={() => enrollStudents([s.id])}
                    disabled={!yearId || enroll.isPending}
                  >
                    Enroll
                  </Button>
                </li>
              );
            })}
          </ul>
        )}

        <form
          className="grid gap-2 border-t pt-4 md:grid-cols-[1fr_auto] md:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            enrollStudents([studentIdInput]);
          }}
        >
          <div className="grid gap-2">
            <label htmlFor="enroll-by-id" className="text-sm font-medium">
              Enroll by student ID
            </label>
            <Input
              id="enroll-by-id"
              className={inputClass}
              placeholder="The student's ID (UUID)"
              value={studentIdInput}
              onChange={(e) => setStudentIdInput(e.target.value)}
            />
          </div>
          <Button
            type="submit"
            className="min-h-11 md:min-h-9"
            disabled={!studentIdInput.trim() || !yearId || enroll.isPending}
          >
            Enroll student
          </Button>
        </form>
      </Panel>
    </PageShell>
  );
}
