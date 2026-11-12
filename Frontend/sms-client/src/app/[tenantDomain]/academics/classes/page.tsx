'use client';

// Classes: the classes of a school year (one per grade level and section), with their seats,
// room and sponsor. Seats belong to the class. Staff who manage classes add, change and delete them.

import * as React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import type { ColumnDef } from '@tanstack/react-table';
import { AlertTriangle, Pencil, Plus, RefreshCw, School, Trash2, Users } from 'lucide-react';

import { CountTiles } from '@/components/attendance/attendance-ui';
import { LabeledSelect } from '@/components/class-placement/roster-controls';
import {
  className as classLabel,
  useClassEnrollmentCounts,
  useClassesAccess,
  useCreateClass,
  useCreateSection,
  useDeleteClass,
  useGradeLevels,
  useSchoolYears,
  useSections,
  useUpdateClass,
  useYearClasses,
  type YearClassRow,
} from '@/components/classes/queries';
import { selectClass } from '@/components/students/admission-form';
import { errorMessage } from '@/components/students/format';
import { teacherName } from '@/components/year-setup/teacher-select';
import { plural, useTeacherOptions } from '@/components/year-setup/use-year-setup';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { DataTable } from '@/components/ui/data-table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { PageShell } from '@/components/ui/page-shell';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/ui/status-badge';
import { notify } from '@/components/ui/toaster';
import type { Section } from '@/types/section';
import type { TeacherOption } from '@/services/api/year-setup-service';

const ALL = 'all';
const MAX_SEATS = 500;

export default function ClassesPage() {
  const params = useParams();
  const school = params?.tenantDomain as string;
  const { canManageClasses } = useClassesAccess();

  const yearsQuery = useSchoolYears();
  const [yearId, setYearId] = React.useState('');
  const activeYearId = yearId || yearsQuery.current?.id || '';
  const year = yearsQuery.years.find((y) => y.id === activeYearId) ?? null;
  const [gradeId, setGradeId] = React.useState(ALL);

  const classesQuery = useYearClasses(activeYearId);
  const levelsQuery = useGradeLevels();
  const sectionsQuery = useSections();
  const teachersQuery = useTeacherOptions();
  const levels = React.useMemo(() => levelsQuery.data ?? [], [levelsQuery.data]);
  const sections = React.useMemo(() => sectionsQuery.data ?? [], [sectionsQuery.data]);
  const teachers = teachersQuery.data ?? [];

  const allClasses = React.useMemo(() => classesQuery.data ?? [], [classesQuery.data]);
  const classes = React.useMemo(
    () => (gradeId === ALL ? allClasses : allClasses.filter((c) => c.grade_id === gradeId)),
    [allClasses, gradeId]
  );
  const counts = useClassEnrollmentCounts(
    React.useMemo(() => allClasses.map((c) => c.id), [allClasses]),
    activeYearId
  );

  const createSection = useCreateSection();
  const deleteClass = useDeleteClass();
  const [form, setForm] = React.useState<{ mode: 'create' } | { mode: 'edit'; row: YearClassRow } | null>(null);
  const [deleting, setDeleting] = React.useState<YearClassRow | null>(null);
  const [addingSections, setAddingSections] = React.useState(false);

  // Grade level and section pairs with no class this year
  const missing = React.useMemo(() => {
    const taken = new Set(allClasses.map((c) => `${c.grade_id}:${c.section_id}`));
    return levels
      .filter((l) => gradeId === ALL || l.id === gradeId)
      .flatMap((l) =>
        sections
          .filter((s) => s.grade_id === l.id && !taken.has(`${l.id}:${s.id}`))
          .map((s) => `${l.name} - ${s.name}`)
      );
  }, [allClasses, levels, sections, gradeId]);

  const seats = classes.reduce((sum, c) => sum + (c.capacity || 0), 0);
  const enrolled = classes.reduce((sum, c) => sum + (counts[c.id] ?? 0), 0);
  const withoutSponsor = classes.filter((c) => !c.class_teacher_id).length;
  const selectedLevel = levels.find((l) => l.id === gradeId) ?? null;
  const levelHasNoSections = Boolean(selectedLevel) && !sections.some((s) => s.grade_id === gradeId);

  const confirmDelete = async () => {
    if (!deleting) return;
    const name = classLabel(deleting);
    try {
      await deleteClass.mutateAsync(deleting.id);
      notify.success(`${name} is deleted.`);
    } catch (err) {
      notify.error(errorMessage(err, `${name} wasn't deleted. Try again.`));
      throw err;
    }
  };

  // Sections A to E for a grade level that has none yet
  const addDefaultSections = async () => {
    if (!selectedLevel) return;
    const existing = new Set(sections.filter((s) => s.grade_id === selectedLevel.id).map((s) => s.name));
    try {
      await Promise.all(
        ['A', 'B', 'C', 'D', 'E']
          .map((letter) => `Section ${letter}`)
          .filter((name) => !existing.has(name))
          .map((name) => createSection.mutateAsync({ grade_id: selectedLevel.id, name }))
      );
      notify.success(`${selectedLevel.name} has sections A to E now.`);
    } catch (err) {
      notify.error(errorMessage(err, `Some sections weren't added to ${selectedLevel.name}. Try again.`));
      throw err;
    }
  };

  const columns = React.useMemo<ColumnDef<YearClassRow>[]>(
    () => [
      {
        id: 'class',
        header: 'Class',
        accessorFn: (c) => classLabel(c),
        cell: ({ row }) => {
          const c = row.original;
          const pair = [c.grade_name, c.section_name].filter(Boolean).join(' - ');
          return (
            <div className="min-w-0">
              <p className="font-medium">{classLabel(c)}</p>
              {c.name && pair && c.name !== pair ? <p className="text-sm text-muted-foreground">{pair}</p> : null}
            </div>
          );
        },
      },
      {
        id: 'sponsor',
        header: 'Sponsor',
        accessorFn: (c) => (c.class_teacher_id ? c.class_teacher_name ?? '' : ''),
        cell: ({ row }) =>
          row.original.class_teacher_id ? (
            row.original.class_teacher_name || 'Sponsor'
          ) : (
            <StatusBadge status="pending" label="No sponsor" />
          ),
      },
      {
        id: 'room',
        header: 'Room',
        accessorFn: (c) => c.room ?? '',
        cell: ({ row }) => row.original.room || <span className="text-muted-foreground">No room</span>,
      },
      {
        id: 'seats',
        header: 'Seats filled',
        accessorFn: (c) => counts[c.id] ?? 0,
        cell: ({ row }) => {
          const c = row.original;
          const count = counts[c.id];
          if (count === undefined) return <Skeleton className="h-4 w-20" />;
          return (
            <div className="flex flex-wrap items-center gap-2">
              <span className="tabular-nums">
                {count} of {c.capacity}
              </span>
              {c.capacity > 0 && count >= c.capacity ? <StatusBadge status="danger" label="Full" /> : null}
            </div>
          );
        },
      },
      {
        id: 'subjects',
        header: 'Subjects',
        meta: { hideOnMobile: true },
        accessorFn: (c) => c.subjects?.length ?? 0,
        cell: ({ getValue }) => <span className="tabular-nums">{getValue<number>()}</span>,
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        meta: { label: 'Actions', className: 'text-right' },
        cell: ({ row }) => (
          <div className="flex flex-wrap justify-end gap-2">
            <Button asChild variant="ghost" size="sm" className="min-h-11 md:min-h-9">
              <Link href={`/${school}/classes/${row.original.id}`}>
                <Users aria-hidden="true" />
                Students
              </Link>
            </Button>
            {canManageClasses ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="min-h-11 md:min-h-9"
                  onClick={() => setForm({ mode: 'edit', row: row.original })}
                >
                  <Pencil aria-hidden="true" />
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="min-h-11 text-destructive hover:text-destructive md:min-h-9"
                  onClick={() => setDeleting(row.original)}
                  aria-label={`Delete ${classLabel(row.original)}`}
                >
                  <Trash2 aria-hidden="true" />
                  <span className="md:sr-only">Delete</span>
                </Button>
              </>
            ) : null}
          </div>
        ),
      },
    ],
    [counts, school, canManageClasses]
  );

  const addButton = canManageClasses ? (
    <Button className="min-h-11 md:min-h-9" onClick={() => setForm({ mode: 'create' })} disabled={!activeYearId}>
      <Plus aria-hidden="true" />
      Add a class
    </Button>
  ) : undefined;

  const description = year
    ? `The classes of the ${year.name} school year: their seats, room and sponsor.${canManageClasses ? '' : ' You can look, but only staff who manage classes can change them.'}`
    : 'The classes of a school year: their seats, room and sponsor.';

  if (yearsQuery.isLoading) {
    return (
      <PageShell title="Classes" description={description}>
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </PageShell>
    );
  }

  if (yearsQuery.isError) {
    return (
      <PageShell title="Classes" description={description}>
        <EmptyState
          icon={RefreshCw}
          title="The school years didn't load"
          description={`${errorMessage(yearsQuery.error, "The server didn't answer.")} Check your connection and try again.`}
          action={<Button onClick={() => yearsQuery.refetch()}>Try again</Button>}
        />
      </PageShell>
    );
  }

  if (!year) {
    return (
      <PageShell title="Classes" description={description}>
        <EmptyState
          icon={School}
          title="No school year yet"
          description="Classes belong to a school year. Create the school year first under Classes → Years and terms."
          action={
            <Button asChild>
              <Link href={`/${school}/academics/academic-years`}>Open years and terms</Link>
            </Button>
          }
        />
      </PageShell>
    );
  }

  return (
    <PageShell title="Classes" description={description} primaryAction={addButton}>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <LabeledSelect label="School year" value={activeYearId} onChange={setYearId} hideLabel={false}>
          {yearsQuery.years.map((y) => (
            <option key={y.id} value={y.id}>
              {y.name}
              {y.is_current ? ' (current)' : ''}
            </option>
          ))}
        </LabeledSelect>
        <LabeledSelect label="Grade level" value={gradeId} onChange={setGradeId} hideLabel={false}>
          <option value={ALL}>All grade levels</option>
          {levels.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </LabeledSelect>
      </div>

      {classesQuery.isError ? (
        <EmptyState
          icon={RefreshCw}
          title="The classes didn't load"
          description={`${errorMessage(classesQuery.error, "Some classes couldn't be loaded.")} Check your internet connection and try again.`}
          action={<Button onClick={() => classesQuery.refetch()}>Try again</Button>}
        />
      ) : (
        <>
          {!teachersQuery.isLoading && !teachersQuery.isError && teachers.length === 0 ? (
            <div role="status" className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <AlertTriangle className="size-5 shrink-0" aria-hidden="true" />
              <p>
                <span className="font-semibold">No teachers yet.</span> You can still create classes. Add teachers under
                Staff → Add teacher when you&apos;re ready to choose class sponsors.
              </p>
            </div>
          ) : null}

          {classesQuery.isLoading ? (
            <Skeleton className="h-24 w-full rounded-xl" />
          ) : (
            <CountTiles
              tiles={[
                {
                  label: 'Classes',
                  value: missing.length > 0 ? `${classes.length} of ${classes.length + missing.length}` : classes.length,
                },
                { label: 'Seats', value: seats },
                { label: 'Students enrolled', value: enrolled },
                { label: 'No sponsor', value: withoutSponsor, status: withoutSponsor > 0 ? 'pending' : undefined },
              ]}
            />
          )}

          {!classesQuery.isLoading && classes.length > 0 && missing.length > 0 ? (
            <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <p className="font-semibold">
                {plural(missing.length, 'section has', 'sections have')} no class this year
              </p>
              <p className="mt-1">
                {missing.slice(0, 8).join(', ')}
                {missing.length > 8 ? ` and ${missing.length - 8} more` : ''}.
                {canManageClasses ? ' Add them with “Add a class”, or all at once under Classes → Setup.' : ''}
              </p>
            </div>
          ) : null}

          <DataTable
            label="Classes"
            columns={columns}
            data={classes}
            loading={classesQuery.isLoading}
            searchable
            searchPlaceholder="Search by class, sponsor or room"
            getRowId={(c) => c.id}
            initialSorting={[{ id: 'class', desc: false }]}
            pageSize={50}
            emptyState={
              levelHasNoSections && selectedLevel ? (
                <EmptyState
                  icon={School}
                  title={`${selectedLevel.name} has no sections yet`}
                  description="Classes are made from grade levels and their sections. Add sections first, here or under Classes → Sections."
                  action={
                    canManageClasses ? (
                      <Button onClick={() => setAddingSections(true)}>Add sections A to E</Button>
                    ) : undefined
                  }
                />
              ) : (
                <EmptyState
                  icon={School}
                  title={
                    selectedLevel ? `${selectedLevel.name} has no classes this year` : 'This school year has no classes yet'
                  }
                  description="Create them under Classes → Setup (Step 3, Create classes). Students are admitted into classes, and teachers are given subjects in them."
                  action={
                    <Button asChild>
                      <Link href={`/${school}/academics/setup`}>Open setup</Link>
                    </Button>
                  }
                />
              )
            }
          />
        </>
      )}

      {form ? (
        <ClassFormDialog
          key={form.mode === 'edit' ? form.row.id : 'create'}
          editing={form.mode === 'edit' ? form.row : null}
          years={yearsQuery.years}
          yearId={activeYearId}
          gradeId={gradeId === ALL ? '' : gradeId}
          levels={levels}
          sections={sections}
          yearClasses={allClasses}
          teachers={teachers}
          teachersLoading={teachersQuery.isLoading}
          onClose={() => setForm(null)}
        />
      ) : null}

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete ${deleting ? classLabel(deleting) : 'this class'}?`}
        description="Its subjects, their teachers and its timetable are deleted with it. A class with students can't be deleted: move them to another class first. This can't be undone."
        confirmLabel="Delete class"
        destructive
        onConfirm={confirmDelete}
      />

      <ConfirmDialog
        open={addingSections}
        onOpenChange={setAddingSections}
        title={`Add sections A to E to ${selectedLevel?.name ?? 'this grade level'}?`}
        description="Five sections are added (Section A to Section E). You can rename or delete any of them under Classes → Sections."
        confirmLabel="Add sections"
        onConfirm={addDefaultSections}
      />
    </PageShell>
  );
}

interface ClassFormDialogProps {
  /** The class to change; null to add a class */
  editing: YearClassRow | null;
  years: { id: string; name: string; is_current: boolean }[];
  yearId: string;
  gradeId: string;
  levels: { id: string; name: string }[];
  sections: Section[];
  /** Classes of the year shown on the page (to mark the sections that already have one) */
  yearClasses: YearClassRow[];
  teachers: TeacherOption[];
  teachersLoading: boolean;
  onClose: () => void;
}

type FormErrors = Partial<Record<'year' | 'grade' | 'section' | 'capacity', string>>;

/** Add a class, or change a class's name, seats, room and sponsor. */
function ClassFormDialog({
  editing,
  years,
  yearId: pageYearId,
  gradeId: pageGradeId,
  levels,
  sections,
  yearClasses,
  teachers,
  teachersLoading,
  onClose,
}: ClassFormDialogProps) {
  const createClass = useCreateClass();
  const updateClass = useUpdateClass();
  const busy = createClass.isPending || updateClass.isPending;

  const [yearId, setYearId] = React.useState(editing?.academic_year_id ?? pageYearId);
  const [gradeId, setGradeId] = React.useState(editing?.grade_id ?? pageGradeId);
  const [sectionId, setSectionId] = React.useState(editing?.section_id ?? '');
  const [name, setName] = React.useState(editing?.name ?? '');
  const [sponsorId, setSponsorId] = React.useState(editing?.class_teacher_id ?? '');
  const [room, setRoom] = React.useState(editing?.room ?? '');
  const [capacity, setCapacity] = React.useState(String(editing?.capacity ?? 30));
  const [errors, setErrors] = React.useState<FormErrors>({});

  const gradeSections = sections.filter((s) => s.grade_id === gradeId);
  // Only known for the year shown on the page
  const taken = new Set(yearId === pageYearId ? yearClasses.map((c) => c.section_id) : []);
  const sponsorKnown = !sponsorId || teachers.some((t) => t.id === sponsorId);
  const pairName = editing
    ? [editing.grade_name, editing.section_name].filter(Boolean).join(' - ')
    : [levels.find((l) => l.id === gradeId)?.name, gradeSections.find((s) => s.id === sectionId)?.name]
        .filter(Boolean)
        .join(' - ');

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const seats = Number(capacity);
    const next: FormErrors = {};
    if (!editing) {
      if (!yearId) next.year = 'Choose the school year.';
      if (!gradeId) next.grade = 'Choose the grade level.';
      if (!sectionId) next.section = 'Choose the section.';
    }
    if (!Number.isInteger(seats) || seats < 1 || seats > MAX_SEATS) {
      next.capacity = `Enter the number of seats, from 1 to ${MAX_SEATS}.`;
    }
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    try {
      if (editing) {
        const label = name.trim() || pairName || 'The class';
        await updateClass.mutateAsync({
          id: editing.id,
          data: {
            name: name.trim() || pairName || undefined,
            capacity: seats,
            room: room.trim(),
            class_teacher_id: sponsorId || null,
          },
        });
        notify.success(`${label} is saved.`);
      } else {
        const created = await createClass.mutateAsync({
          academic_year_id: yearId,
          grade_id: gradeId,
          section_id: sectionId,
          name: name.trim() || undefined,
          class_teacher_id: sponsorId || undefined,
          room: room.trim() || undefined,
          capacity: seats,
          is_active: true,
        });
        notify.success(`${created?.name || pairName || 'The class'} is added.`);
      }
      onClose();
    } catch (err) {
      notify.error(
        errorMessage(err, editing ? "The class wasn't saved. Try again." : "The class wasn't added. Try again.")
      );
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? `Edit ${classLabel(editing)}` : 'Add a class'}</DialogTitle>
          <DialogDescription>
            {editing
              ? 'Change its name, seats, room or sponsor. Its grade level and section stay the same.'
              : 'A class is one section of a grade level for one school year.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={save} className="mt-4 grid gap-4" noValidate>
          {editing ? null : (
            <>
              <FormField label="School year" error={errors.year} required>
                <select className={selectClass} value={yearId} onChange={(e) => setYearId(e.target.value)}>
                  <option value="">Choose a school year</option>
                  {years.map((y) => (
                    <option key={y.id} value={y.id}>
                      {y.name}
                      {y.is_current ? ' (current)' : ''}
                    </option>
                  ))}
                </select>
              </FormField>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Grade level" error={errors.grade} required>
                  <select
                    className={selectClass}
                    value={gradeId}
                    onChange={(e) => {
                      setGradeId(e.target.value);
                      setSectionId('');
                    }}
                  >
                    <option value="">Choose a grade level</option>
                    {levels.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </FormField>
                <FormField
                  label="Section"
                  error={errors.section}
                  description={gradeId && gradeSections.length === 0 ? 'This grade level has no sections yet. Add them under Classes → Sections.' : undefined}
                  required
                >
                  <select
                    className={selectClass}
                    value={sectionId}
                    onChange={(e) => setSectionId(e.target.value)}
                    disabled={!gradeId || gradeSections.length === 0}
                  >
                    <option value="">{gradeId ? 'Choose a section' : 'Choose the grade level first'}</option>
                    {gradeSections.map((s) => (
                      <option key={s.id} value={s.id} disabled={taken.has(s.id)}>
                        {s.name}
                        {taken.has(s.id) ? ' (has a class)' : ''}
                      </option>
                    ))}
                  </select>
                </FormField>
              </div>
            </>
          )}
          <FormField
            label="Class name"
            description={pairName ? `Leave it empty to call the class ${pairName}.` : 'Leave it empty to name the class after its grade level and section.'}
          >
            <Input value={name} onChange={(e) => setName(e.target.value)} className="h-11 md:h-9" maxLength={100} />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Class capacity" error={errors.capacity} description="Seats in this class." required>
              <Input
                type="number"
                inputMode="numeric"
                min={1}
                max={MAX_SEATS}
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
                className="h-11 md:h-9"
              />
            </FormField>
            <FormField label="Room">
              <Input
                value={room}
                onChange={(e) => setRoom(e.target.value)}
                placeholder="For example, Room 101"
                className="h-11 md:h-9"
              />
            </FormField>
          </div>
          <FormField
            label="Class sponsor"
            description={!teachersLoading && teachers.length === 0 ? 'No teachers yet. Add them under Staff → Add teacher.' : undefined}
          >
            <select
              className={selectClass}
              value={sponsorId}
              onChange={(e) => setSponsorId(e.target.value)}
              disabled={teachersLoading}
            >
              <option value="">{teachersLoading ? 'Loading teachers…' : 'No sponsor'}</option>
              {!sponsorKnown ? <option value={sponsorId}>{editing?.class_teacher_name || 'Current sponsor'}</option> : null}
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {teacherName(t)}
                </option>
              ))}
            </select>
          </FormField>
          <DialogFooter className="mt-2 gap-2 sm:space-x-0">
            <Button type="button" variant="outline" className="min-h-11 md:min-h-9" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" className="min-h-11 md:min-h-9" disabled={busy}>
              {editing ? 'Save class' : 'Add class'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
