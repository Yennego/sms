'use client';

// Subject assignments: which teacher teaches which subject in which class, and each class's sponsor,
// for the selected school year. Three views: by teacher, every subject, and class sponsors.

import * as React from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { BookOpen, Pencil, Trash2, UserPlus, Users } from 'lucide-react';

import { CountTiles } from '@/components/attendance/attendance-ui';
import {
  AssignmentStudentsDialog,
  AssignSubjectsDialog,
  ChooseTeacherDialog,
  EditAssignmentDialog,
  SponsorDialog,
  slotKey,
  teacherName,
} from '@/components/classes/subject-assignment-dialogs';
import { errorMessage } from '@/components/students/format';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { DataTable } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { PageShell } from '@/components/ui/page-shell';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/ui/status-badge';
import { notify } from '@/components/ui/toaster';
import { useAcademicYear } from '@/contexts/academic-year-context';
import { useAuth } from '@/hooks/use-auth';
import { useEnrollmentGrades, useEnrollmentSections } from '@/hooks/queries/enrollments';
import { useSubjects } from '@/hooks/queries/subjects';
import {
  useAllTeacherAssignments,
  useBulkDeleteAssignments,
  useBulkReassignAssignments,
  useClassSponsors,
  useCreateAssignment,
  useDeleteAssignment,
  useUnassignedSubjects,
} from '@/hooks/queries/teacher-assignments';
import { useTeachers } from '@/hooks/queries/teachers';
import { cn } from '@/lib/utils';
import type { Teacher } from '@/types/teacher';
import type { ClassSponsor, ClassSubjectAssignment, TeacherSubjectAssignment } from '@/types/teacher-subject-assignment';

type View = 'subject' | 'allocation' | 'class';
const VIEWS: Array<{ key: View; label: string }> = [
  { key: 'subject', label: 'By teacher' },
  { key: 'allocation', label: 'All subjects' },
  { key: 'class', label: 'Class sponsors' },
];
const SEARCH_LABEL: Record<View, string> = {
  subject: 'Search teachers by name, email or staff ID',
  allocation: 'Search by class, subject or teacher',
  class: 'Search by class or sponsor',
};

// The list endpoints send room / is_active only on some deployments
type Assignment = ClassSubjectAssignment & { room?: string; is_active?: boolean };
const norm = (id?: string | null) => (id ?? '').toLowerCase().trim();
const classLabel = (a: Pick<ClassSubjectAssignment, 'grade_name' | 'section_name'>) =>
  [a.grade_name, a.section_name].filter(Boolean).join(' - ');

export default function SubjectAssignmentsPage() {
  const { selectedAcademicYearName, selectedAcademicYearId, isLoading: yearLoading } = useAcademicYear();
  const yearId = selectedAcademicYearId || '';
  const { user } = useAuth();
  // Assigning, editing and removing from the teacher view needs manage_teacher_assignments
  const canManage = Boolean(user?.permissions?.includes('manage_teacher_assignments'));

  const teachersQuery = useTeachers();
  const subjectsQuery = useSubjects();
  const gradesQuery = useEnrollmentGrades();
  const sectionsQuery = useEnrollmentSections();
  const assignmentsQuery = useAllTeacherAssignments(yearId);
  const unassignedQuery = useUnassignedSubjects(yearId);
  const sponsorsQuery = useClassSponsors(yearId);
  const teachers = React.useMemo(() => teachersQuery.data ?? [], [teachersQuery.data]);
  const subjects = React.useMemo(() => subjectsQuery.data ?? [], [subjectsQuery.data]);
  const grades = React.useMemo(() => gradesQuery.data ?? [], [gradesQuery.data]);
  const sections = React.useMemo(() => sectionsQuery.data ?? [], [sectionsQuery.data]);
  const assignments = React.useMemo(() => (assignmentsQuery.data ?? []) as Assignment[], [assignmentsQuery.data]);
  const unassigned = React.useMemo(() => unassignedQuery.data ?? [], [unassignedQuery.data]);
  const sponsors = React.useMemo(() => sponsorsQuery.data ?? [], [sponsorsQuery.data]);

  const deleteOne = useDeleteAssignment();
  const deleteMany = useBulkDeleteAssignments();
  const reassign = useBulkReassignAssignments();
  const create = useCreateAssignment();

  const [view, setView] = React.useState<View>('subject');
  const [search, setSearch] = React.useState('');
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [assignTo, setAssignTo] = React.useState<Teacher | null>(null);
  const [editing, setEditing] = React.useState<Assignment | null>(null);
  const [studentsOf, setStudentsOf] = React.useState<Assignment | null>(null);
  const [toRemove, setToRemove] = React.useState<Assignment | null>(null);
  const [removeSelected, setRemoveSelected] = React.useState(false);
  const [teacherFor, setTeacherFor] = React.useState<Assignment | null>(null);
  const [moveSelected, setMoveSelected] = React.useState(false);
  const [sponsorFor, setSponsorFor] = React.useState<ClassSponsor | null>(null);

  // Names may be missing on some rows: fill them from the lists
  const named = React.useCallback(
    (a: ClassSubjectAssignment, isAssigned: boolean): Assignment => {
      const grade = a.grade_name || grades.find((g) => g.id === a.grade_id)?.name || 'Unknown grade';
      const section = a.section_name || sections.find((s) => s.id === a.section_id)?.name || 'Unknown section';
      const subject = a.subject_name || subjects.find((s) => s.id === a.subject_id)?.name || 'Unknown subject';
      return {
        ...a,
        grade_name: grade,
        section_name: section,
        subject_name: subject,
        class_name: a.class_name || `${subject} - ${grade} ${section}`,
        is_assigned: isAssigned,
      };
    },
    [grades, sections, subjects]
  );

  const slots = React.useMemo<Assignment[]>(
    () => [...assignments.map((a) => named(a, true)), ...unassigned.map((u) => named(u, false))],
    [assignments, unassigned, named]
  );

  const byTeacher = React.useMemo(() => {
    const map = new Map<string, Assignment[]>();
    for (const a of slots) {
      if (!a.is_assigned || !a.teacher_id) continue;
      const key = norm(a.teacher_id);
      map.set(key, [...(map.get(key) ?? []), a]);
    }
    return map;
  }, [slots]);

  const term = search.trim().toLowerCase();
  const shownTeachers = React.useMemo(
    () =>
      teachers.filter(
        (t) => !term || `${t.first_name} ${t.last_name} ${t.email} ${t.employee_id}`.toLowerCase().includes(term)
      ),
    [teachers, term]
  );
  const shownSlots = React.useMemo(
    () =>
      slots
        .filter((a) => !term || `${classLabel(a)} ${a.subject_name} ${a.teacher_name ?? ''}`.toLowerCase().includes(term))
        .sort(
          (a, b) =>
            a.grade_name.localeCompare(b.grade_name, undefined, { numeric: true }) ||
            a.section_name.localeCompare(b.section_name) ||
            a.subject_name.localeCompare(b.subject_name)
        ),
    [slots, term]
  );
  const shownSponsors = React.useMemo(
    () =>
      sponsors.filter((s) => !term || `${s.grade_name} ${s.section_name} ${s.teacher_name ?? ''}`.toLowerCase().includes(term)),
    [sponsors, term]
  );

  const toggle = (id: string, checked: boolean) =>
    setSelectedIds((prev) => (checked ? [...new Set([...prev, id])] : prev.filter((x) => x !== id)));

  const remove = async () => {
    if (!toRemove?.id) return;
    try {
      await deleteOne.mutateAsync(toRemove.id);
      setSelectedIds((prev) => prev.filter((x) => x !== toRemove.id));
      notify.success(`${toRemove.subject_name} in ${classLabel(toRemove)} has no teacher now.`);
    } catch (err) {
      notify.error(errorMessage(err, "The teacher wasn't removed. Try again."));
      throw err;
    }
  };

  const removeMany = async () => {
    try {
      await deleteMany.mutateAsync(selectedIds);
      notify.success(`${selectedIds.length} assignment${selectedIds.length === 1 ? '' : 's'} removed.`);
      setSelectedIds([]);
    } catch (err) {
      notify.error(errorMessage(err, "The assignments weren't removed. Try again."));
      throw err;
    }
  };

  const chooseTeacher = async (teacherId: string) => {
    const t = teachers.find((x) => x.id === teacherId);
    const who = t ? teacherName(t) : 'The teacher';
    try {
      if (moveSelected) {
        await reassign.mutateAsync({ ids: selectedIds, newTeacherId: teacherId });
        notify.success(`${who} now teaches the ${selectedIds.length} selected subject${selectedIds.length === 1 ? '' : 's'}.`);
        setSelectedIds([]);
        setMoveSelected(false);
      } else if (teacherFor) {
        if (teacherFor.id) {
          await reassign.mutateAsync({ ids: [teacherFor.id], newTeacherId: teacherId });
        } else {
          await create.mutateAsync({
            teacher_id: teacherId,
            grade_id: teacherFor.grade_id,
            section_id: teacherFor.section_id,
            subject_id: teacherFor.subject_id,
            academic_year_id: yearId,
            is_active: true,
            start_date: new Date().toISOString().split('T')[0],
          });
        }
        notify.success(`${who} now teaches ${teacherFor.subject_name} in ${classLabel(teacherFor)}.`);
        setTeacherFor(null);
      }
    } catch (err) {
      notify.error(errorMessage(err, "The teacher wasn't changed. Try again."));
    }
  };

  const slotColumns = React.useMemo<ColumnDef<Assignment>[]>(
    () => [
      { id: 'class', accessorFn: (a) => classLabel(a), header: 'Class' },
      { accessorKey: 'subject_name', header: 'Subject', cell: ({ row }) => <span className="font-medium">{row.original.subject_name}</span> },
      {
        id: 'teacher',
        accessorFn: (a) => (a.is_assigned ? a.teacher_name || '' : ''),
        header: 'Teacher',
        cell: ({ row }) =>
          row.original.is_assigned ? (
            row.original.teacher_name || 'Unknown teacher'
          ) : (
            <StatusBadge status="warning" label="No teacher" />
          ),
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        meta: { label: 'Actions', className: 'text-right' },
        cell: ({ row }) => (
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              size="sm"
              variant={row.original.is_assigned ? 'outline' : 'default'}
              className="min-h-11 md:min-h-9"
              onClick={() => setTeacherFor(row.original)}
            >
              <UserPlus aria-hidden="true" />
              {row.original.is_assigned ? 'Change teacher' : 'Assign teacher'}
            </Button>
            {row.original.is_assigned ? (
              <Button
                size="sm"
                variant="ghost"
                className="min-h-11 text-destructive hover:text-destructive md:min-h-9"
                onClick={() => setToRemove(row.original)}
              >
                <Trash2 aria-hidden="true" />
                Remove
              </Button>
            ) : null}
          </div>
        ),
      },
    ],
    []
  );

  const sponsorColumns = React.useMemo<ColumnDef<ClassSponsor>[]>(
    () => [
      { id: 'class', accessorFn: (s) => classLabel(s), header: 'Class', cell: ({ row }) => <span className="font-medium">{classLabel(row.original)}</span> },
      {
        id: 'sponsor',
        accessorFn: (s) => s.teacher_name ?? '',
        header: 'Class sponsor',
        cell: ({ row }) =>
          row.original.is_assigned ? (
            row.original.teacher_name || 'Unknown teacher'
          ) : (
            <StatusBadge status="warning" label="No sponsor" />
          ),
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        meta: { label: 'Actions', className: 'text-right' },
        cell: ({ row }) => (
          <Button
            size="sm"
            variant={row.original.is_assigned ? 'outline' : 'default'}
            className="min-h-11 md:min-h-9"
            onClick={() => setSponsorFor(row.original)}
          >
            <UserPlus aria-hidden="true" />
            {row.original.is_assigned ? 'Change sponsor' : 'Assign sponsor'}
          </Button>
        ),
      },
    ],
    []
  );

  const loading =
    teachersQuery.isLoading ||
    assignmentsQuery.isLoading ||
    unassignedQuery.isLoading ||
    subjectsQuery.isLoading ||
    gradesQuery.isLoading ||
    sectionsQuery.isLoading;
  const failed = [teachersQuery, assignmentsQuery, unassignedQuery, sponsorsQuery].find((q) => q.isError);
  const perTeacher = Math.round((assignments.length / Math.max(1, teachers.length)) * 10) / 10;

  const renderTeacher = (teacher: Teacher) => {
    const list = byTeacher.get(norm(teacher.id)) ?? [];
    const ids = list.map((a) => a.id).filter((x): x is string => Boolean(x));
    const allSelected = ids.length > 0 && ids.every((id) => selectedIds.includes(id));
    return (
      <section key={teacher.id} className="space-y-3 rounded-xl border bg-card p-4" aria-label={teacherName(teacher)}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h2 className="font-semibold">{teacherName(teacher)}</h2>
            <p className="text-sm text-muted-foreground">
              {[teacher.email, teacher.employee_id, teacher.department].filter(Boolean).join(' · ')}
            </p>
            <div className="mt-2 flex flex-wrap gap-1">
              {teacher.status === 'active' ? (
                <StatusBadge status="success" label="Active" />
              ) : (
                <StatusBadge status="neutral" label={teacher.status ? teacher.status.charAt(0).toUpperCase() + teacher.status.slice(1) : 'Inactive'} />
              )}
              {teacher.is_class_teacher ? <StatusBadge status="info" label="Class sponsor" /> : null}
            </div>
          </div>
          {teacher.status === 'active' && canManage ? (
            <Button variant="outline" size="sm" className="min-h-11 md:min-h-9" onClick={() => setAssignTo(teacher)}>
              <BookOpen aria-hidden="true" />
              Assign subjects
            </Button>
          ) : null}
        </div>

        {list.length === 0 ? (
          <p className="text-sm text-muted-foreground">No subjects yet.</p>
        ) : (
          <>
            <div className="flex items-center gap-2 text-sm">
              <Checkbox
                id={`all-${teacher.id}`}
                checked={allSelected}
                onCheckedChange={(checked) =>
                  setSelectedIds((prev) => (checked ? [...new Set([...prev, ...ids])] : prev.filter((x) => !ids.includes(x))))
                }
              />
              <label htmlFor={`all-${teacher.id}`} className="font-medium">
                {list.length} subject{list.length === 1 ? '' : 's'} (select all)
              </label>
            </div>
            <ul className="divide-y rounded-lg border">
              {list.map((a) => {
                const id = a.id ?? slotKey(a);
                return (
                  <li key={id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center">
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      {a.id ? (
                        <Checkbox
                          id={`pick-${id}`}
                          checked={selectedIds.includes(a.id)}
                          onCheckedChange={(checked) => toggle(a.id as string, checked)}
                        />
                      ) : null}
                      <label htmlFor={`pick-${id}`} className="min-w-0">
                        <span className="block font-medium">{a.subject_name}</span>
                        <span className="block text-sm text-muted-foreground">
                          {[classLabel(a), a.room ? `Room ${a.room}` : ''].filter(Boolean).join(' · ')}
                        </span>
                      </label>
                    </div>
                    <div className="flex flex-wrap gap-2 sm:justify-end">
                      <Button variant="ghost" size="sm" className="min-h-11 md:min-h-9" onClick={() => setStudentsOf(a)}>
                        <Users aria-hidden="true" />
                        Students
                      </Button>
                      {canManage ? (
                        <>
                          <Button variant="ghost" size="sm" className="min-h-11 md:min-h-9" onClick={() => setEditing(a)}>
                            <Pencil aria-hidden="true" />
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="min-h-11 text-destructive hover:text-destructive md:min-h-9"
                            onClick={() => setToRemove(a)}
                          >
                            <Trash2 aria-hidden="true" />
                            Remove
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </section>
    );
  };

  const editingTeacher = editing ? teachers.find((t) => norm(t.id) === norm(editing.teacher_id)) : undefined;

  return (
    <PageShell
      title="Subject assignments"
      description={`Who teaches which subject in each class, and each class's sponsor${selectedAcademicYearName ? `, for ${selectedAcademicYearName}` : ''}.`}
    >
      {!yearLoading && !yearId ? (
        <EmptyState icon={BookOpen} description="Choose a school year first. If there is none, add one in Years and terms." />
      ) : (
        <>
          <CountTiles
            tiles={[
              { label: 'Teachers', value: teachersQuery.isLoading ? '–' : teachers.length },
              { label: 'Subjects with a teacher', value: assignmentsQuery.isLoading ? '–' : assignments.length },
              {
                label: 'Subjects without a teacher',
                value: unassignedQuery.isLoading ? '–' : unassigned.length,
                status: unassigned.length ? 'warning' : undefined,
              },
              { label: 'Subjects per teacher', value: loading ? '–' : perTeacher },
            ]}
          />

          <div role="tablist" aria-label="Views" className="flex flex-wrap gap-2">
            {VIEWS.map((v) => (
              <button
                key={v.key}
                type="button"
                role="tab"
                aria-selected={view === v.key}
                onClick={() => setView(v.key)}
                className={cn(
                  'min-h-11 rounded-md border px-4 text-sm font-medium md:min-h-9',
                  view === v.key ? 'border-primary bg-primary text-primary-foreground' : 'bg-background hover:bg-muted'
                )}
              >
                {v.label}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-3 md:flex-row md:items-end">
            <div className="grid flex-1 gap-2">
              <label htmlFor="assignments-search" className="text-sm font-medium">
                {SEARCH_LABEL[view]}
              </label>
              <Input
                id="assignments-search"
                type="search"
                className="h-11 text-base md:h-9 md:text-sm"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            {selectedIds.length > 0 ? (
              <div className="flex flex-wrap gap-2" role="group" aria-label="Selected assignments">
                <Button variant="outline" className="min-h-11 md:min-h-9" onClick={() => setMoveSelected(true)}>
                  Move {selectedIds.length} to another teacher
                </Button>
                <Button variant="destructive" className="min-h-11 md:min-h-9" onClick={() => setRemoveSelected(true)}>
                  Remove {selectedIds.length}
                </Button>
              </div>
            ) : null}
          </div>

          {failed ? (
            <EmptyState
              icon={BookOpen}
              title="The assignments didn't load"
              description={`${errorMessage(failed.error, 'The server didn’t answer.')} Check your connection and try again.`}
              action={<Button onClick={() => failed.refetch()}>Try again</Button>}
            />
          ) : view === 'subject' ? (
            loading ? (
              <Skeleton className="h-64 w-full rounded-xl" />
            ) : shownTeachers.length === 0 ? (
              <EmptyState
                icon={Users}
                description={term ? 'No teachers match your search.' : 'No teachers yet. Add teachers in Staff first.'}
              />
            ) : (
              <div className="space-y-4">{shownTeachers.map(renderTeacher)}</div>
            )
          ) : view === 'allocation' ? (
            <DataTable
              label="Subjects and their teachers"
              columns={slotColumns}
              data={shownSlots}
              loading={loading}
              getRowId={(a) => a.id ?? slotKey(a)}
              emptyState={
                <EmptyState
                  icon={BookOpen}
                  description={term ? 'No subjects match your search.' : 'No subjects yet. Add subjects to the classes first.'}
                />
              }
            />
          ) : (
            <DataTable
              label="Class sponsors"
              columns={sponsorColumns}
              data={shownSponsors}
              loading={sponsorsQuery.isLoading}
              getRowId={(s) => s.section_id}
              emptyState={
                <EmptyState icon={Users} description={term ? 'No classes match your search.' : 'No classes yet.'} />
              }
            />
          )}
        </>
      )}

      <AssignSubjectsDialog
        teacher={assignTo}
        onClose={() => setAssignTo(null)}
        slots={slots}
        grades={grades}
        subjects={subjects}
        academicYearId={yearId}
      />

      <EditAssignmentDialog
        assignment={editing as unknown as TeacherSubjectAssignment | null}
        title={editing ? `${editing.subject_name}, ${classLabel(editing)}` : ''}
        teacherLabel={editingTeacher ? teacherName(editingTeacher) : editing?.teacher_name || 'an unknown teacher'}
        onClose={() => setEditing(null)}
      />

      <AssignmentStudentsDialog
        assignment={
          studentsOf?.id ? { id: studentsOf.id, title: `${studentsOf.subject_name}, ${classLabel(studentsOf)}`, teacher: studentsOf.teacher_name } : null
        }
        onClose={() => setStudentsOf(null)}
      />

      <ChooseTeacherDialog
        open={Boolean(teacherFor) || moveSelected}
        title={
          moveSelected
            ? `Move ${selectedIds.length} subject${selectedIds.length === 1 ? '' : 's'}`
            : teacherFor?.is_assigned
              ? 'Change teacher'
              : 'Assign teacher'
        }
        description={
          moveSelected
            ? 'The selected subjects move to the teacher you choose.'
            : teacherFor
              ? `Who teaches ${teacherFor.subject_name} in ${classLabel(teacherFor)}?`
              : ''
        }
        initialTeacherId={moveSelected ? '' : (teacherFor?.teacher_id ?? '')}
        confirmLabel={moveSelected ? 'Move subjects' : 'Save teacher'}
        teachers={teachers}
        pending={reassign.isPending || create.isPending}
        onConfirm={chooseTeacher}
        onClose={() => {
          setTeacherFor(null);
          setMoveSelected(false);
        }}
      />

      <SponsorDialog
        section={
          sponsorFor ? { id: sponsorFor.section_id, name: classLabel(sponsorFor), teacherId: sponsorFor.teacher_id } : null
        }
        teachers={teachers}
        onClose={() => setSponsorFor(null)}
      />

      <ConfirmDialog
        open={Boolean(toRemove)}
        onOpenChange={(open) => !open && setToRemove(null)}
        title={toRemove ? `Remove ${toRemove.teacher_name || 'the teacher'} from ${toRemove.subject_name}?` : 'Remove the teacher?'}
        description={toRemove ? `${toRemove.subject_name} in ${classLabel(toRemove)} will have no teacher until you assign one.` : undefined}
        confirmLabel="Remove teacher"
        destructive
        loading={deleteOne.isPending}
        onConfirm={remove}
      />

      <ConfirmDialog
        open={removeSelected}
        onOpenChange={setRemoveSelected}
        title={`Remove ${selectedIds.length} assignment${selectedIds.length === 1 ? '' : 's'}?`}
        description="Those subjects will have no teacher until you assign one."
        confirmLabel="Remove assignments"
        destructive
        loading={deleteMany.isPending}
        onConfirm={removeMany}
      />
    </PageShell>
  );
}
