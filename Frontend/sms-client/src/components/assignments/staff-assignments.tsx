'use client';

// Assignments for staff: filter by subject, teacher, grade and section. Teachers and admins also
// set, edit, publish (or move back to draft), delete, and open the gradebook to enter marks.

import * as React from 'react';
import Link from 'next/link';
import type { ColumnDef } from '@tanstack/react-table';
import { Eye, EyeOff, FileText, Pencil, Table2, Trash2, X } from 'lucide-react';

import { CountTiles } from '@/components/attendance/attendance-ui';
import { PublishedBadge } from '@/components/assignments/assignment-ui';
import { useDeleteAssignment, useSetPublished, type AssignmentListFilters } from '@/components/assignments/queries';
import { selectClass } from '@/components/students/admission-form';
import { errorMessage, formatDate } from '@/components/students/format';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { DataTable } from '@/components/ui/data-table';
import { DropdownMenu } from '@/components/ui/dropdown-menu';
import { EmptyState } from '@/components/ui/empty-state';
import { notify } from '@/components/ui/toaster';
import type { Assignment } from '@/services/api/assignment-service';
import { useSchoolYears } from '@/components/classes/queries';

type Item = { id: string; name: string };

interface Props {
  assignments: Assignment[];
  loading: boolean;
  error: unknown;
  onRetry: () => void;
  filters: AssignmentListFilters;
  onFiltersChange: (next: AssignmentListFilters) => void;
  subjects: Item[];
  teachers: Item[];
  grades: Item[];
  sections: Item[];
  canManage: boolean;
  gradebookHref: string;
  onCreate: () => void;
  onEdit: (a: Assignment) => void;
}

const nameOf = (list: Item[], id?: string) => (id ? list.find((i) => i.id === id)?.name : undefined);

function FilterSelect({
  id,
  label,
  value,
  onChange,
  allLabel,
  items,
  disabled,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  allLabel: string;
  items: Item[];
  disabled?: boolean;
}) {
  return (
    <div className="grid gap-2">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <select id={id} className={selectClass} value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}>
        <option value="">{allLabel}</option>
        {items.map((i) => (
          <option key={i.id} value={i.id}>
            {i.name}
          </option>
        ))}
      </select>
    </div>
  );
}

export function StaffAssignments({
  assignments,
  loading,
  error,
  onRetry,
  filters,
  onFiltersChange,
  subjects,
  teachers,
  grades,
  sections,
  canManage,
  gradebookHref,
  onCreate,
  onEdit,
}: Props) {
  const publish = useSetPublished();
  const remove = useDeleteAssignment();
  const [deleting, setDeleting] = React.useState<Assignment | null>(null);

  const schoolYears = useSchoolYears();
  const set = (patch: Partial<AssignmentListFilters>) => onFiltersChange({ ...filters, ...patch });
  const filtered = Boolean(
    filters.subjectId || filters.teacherId || filters.gradeId || filters.sectionId || filters.yearId !== undefined
  );
  const clear = () => onFiltersChange({ subjectId: '', teacherId: '', gradeId: '', sectionId: '' });

  const togglePublished = React.useCallback(
    async (a: Assignment) => {
      try {
        await publish.mutateAsync({ id: a.id, publish: !a.is_published });
        notify.success(
          a.is_published ? `${a.title} is back to draft. Students no longer see it.` : `${a.title} is published. Students can see it now.`
        );
      } catch (err) {
        notify.error(errorMessage(err, "The assignment wasn't changed. Check your connection and try again."));
      }
    },
    [publish]
  );

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      await remove.mutateAsync(deleting.id);
      notify.success(`${deleting.title} is deleted.`);
    } catch (err) {
      notify.error(errorMessage(err, "The assignment wasn't deleted. Check your connection and try again."));
      throw err; // keep the dialog open
    }
  };

  const columns = React.useMemo<ColumnDef<Assignment>[]>(
    () => [
      {
        accessorKey: 'title',
        header: 'Assignment',
        cell: ({ row }) => {
          const a = row.original;
          const teacher = a.teacher_name || nameOf(teachers, a.teacher_id);
          return (
            <div>
              <p className="font-medium">{a.title}</p>
              {teacher ? <p className="text-sm text-muted-foreground">{teacher}</p> : null}
            </div>
          );
        },
      },
      {
        id: 'class',
        header: 'Class and subject',
        accessorFn: (a) => {
          const grade = a.grade_name || nameOf(grades, a.grade_id) || 'Grade';
          return a.section_id ? `${grade} - ${a.section_name || 'Section'}` : grade;
        },
        cell: ({ row, getValue }) => (
          <div>
            <p>{getValue<string>()}</p>
            <p className="text-sm text-muted-foreground">
              {row.original.subject_name || nameOf(subjects, row.original.subject_id) || 'Subject'}
            </p>
          </div>
        ),
      },
      {
        accessorKey: 'due_date',
        header: 'Due',
        cell: ({ row }) => <span className="whitespace-nowrap">{formatDate(row.original.due_date)}</span>,
      },
      {
        accessorKey: 'max_score',
        header: 'Out of',
        meta: { hideOnMobile: true, className: 'tabular-nums' },
      },
      {
        id: 'status',
        header: 'Status',
        accessorFn: (a) => (a.is_published ? 'Published' : 'Draft'),
        cell: ({ row }) => <PublishedBadge assignment={row.original} />,
      },
      ...(canManage
        ? [
            {
              id: 'actions',
              header: '',
              enableSorting: false,
              meta: { label: 'Actions', className: 'text-right' },
              cell: ({ row }) => {
                const a = row.original;
                return (
                  <div className="flex items-center justify-end gap-1">
                    {a.is_published ? (
                      <Button asChild size="sm" variant="outline" className="min-h-11 md:min-h-9">
                        <Link href={gradebookHref}>
                          <Table2 aria-hidden="true" />
                          Enter marks
                        </Link>
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        className="min-h-11 md:min-h-9"
                        onClick={() => togglePublished(a)}
                        disabled={publish.isPending}
                      >
                        <Eye aria-hidden="true" />
                        Publish
                      </Button>
                    )}
                    <DropdownMenu
                      label={`More actions for ${a.title}`}
                      items={[
                        { label: 'Edit', icon: Pencil, onSelect: () => onEdit(a) },
                        a.is_published
                          ? { label: 'Move back to draft', icon: EyeOff, onSelect: () => togglePublished(a) }
                          : { label: 'Enter marks', icon: Table2, href: gradebookHref },
                        'separator',
                        { label: 'Delete', icon: Trash2, destructive: true, onSelect: () => setDeleting(a) },
                      ]}
                    />
                  </div>
                );
              },
            } satisfies ColumnDef<Assignment>,
          ]
        : []),
    ],
    [teachers, grades, subjects, canManage, gradebookHref, publish.isPending, togglePublished, onEdit]
  );

  const published = assignments.filter((a) => a.is_published).length;

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[repeat(5,minmax(0,1fr))_auto] lg:items-end">
        <FilterSelect
          id="as-year"
          label="School year"
          value={filters.yearId ?? schoolYears.current?.id ?? ''}
          onChange={(v) => set({ yearId: v })}
          allLabel="All years"
          items={schoolYears.years.map((y) => ({ id: y.id, name: y.is_current ? `${y.name} (current)` : y.name }))}
        />
        <FilterSelect
          id="as-subject"
          label="Subject"
          value={filters.subjectId}
          onChange={(v) => set({ subjectId: v })}
          allLabel="All subjects"
          items={subjects}
        />
        <FilterSelect
          id="as-teacher"
          label="Teacher"
          value={filters.teacherId}
          onChange={(v) => set({ teacherId: v })}
          allLabel="All teachers"
          items={teachers}
        />
        <FilterSelect
          id="as-grade"
          label="Grade"
          value={filters.gradeId}
          onChange={(v) => set({ gradeId: v, sectionId: '' })}
          allLabel="All grades"
          items={grades}
        />
        <FilterSelect
          id="as-section"
          label="Section"
          value={filters.sectionId}
          onChange={(v) => set({ sectionId: v })}
          allLabel={filters.gradeId ? 'All sections' : 'Choose a grade first'}
          items={filters.gradeId ? sections : []}
          disabled={!filters.gradeId}
        />
        {filtered ? (
          <Button variant="outline" className="min-h-11 md:min-h-9" onClick={clear}>
            <X aria-hidden="true" />
            Clear filters
          </Button>
        ) : null}
      </div>

      {!loading && !error ? (
        <CountTiles
          className="grid-cols-3 sm:grid-cols-3 lg:grid-cols-3"
          tiles={[
            { label: 'In this list', value: assignments.length },
            { label: 'Published', value: published, status: 'success' },
            { label: 'Drafts', value: assignments.length - published },
          ]}
        />
      ) : null}

      {error ? (
        <EmptyState
          icon={FileText}
          description={`${errorMessage(error, "The assignments didn't load.")} Check your connection and try again.`}
          action={
            <Button variant="outline" onClick={onRetry}>
              Try again
            </Button>
          }
        />
      ) : (
        <DataTable
          label="Assignments"
          columns={columns}
          data={assignments}
          loading={loading}
          getRowId={(a) => a.id}
          initialSorting={[{ id: 'due_date', desc: true }]}
          emptyState={
            filtered ? (
              <EmptyState
                icon={FileText}
                description="No assignments match these filters."
                action={
                  <Button variant="outline" onClick={clear}>
                    Clear filters
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon={FileText}
                description={canManage ? 'No assignments yet. Set the first one for a class.' : 'No assignments yet.'}
                action={canManage ? <Button onClick={onCreate}>New assignment</Button> : undefined}
              />
            )
          }
        />
      )}

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={deleting ? `Delete ${deleting.title}?` : 'Delete assignment?'}
        description="Students will no longer see it, and work handed in for it won't show here. This can't be undone."
        confirmLabel="Delete assignment"
        destructive
        loading={remove.isPending}
        onConfirm={confirmDelete}
      />
    </>
  );
}
