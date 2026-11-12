'use client';

// Sections: each grade level is split into sections (A, B, ...). Every school year, each section of
// a level becomes a class, which holds the seats. Staff who manage classes add, rename and delete them.

import * as React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import type { ColumnDef } from '@tanstack/react-table';
import { Layers, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';

import { LabeledSelect } from '@/components/class-placement/roster-controls';
import {
  useClassesAccess,
  useCreateSection,
  useDeleteSection,
  useGradeLevels,
  useGradeSections,
  useUpdateSection,
} from '@/components/classes/queries';
import { errorMessage } from '@/components/students/format';
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
import { Textarea } from '@/components/ui/textarea';
import { notify } from '@/components/ui/toaster';
import type { Section } from '@/types/section';

export default function SectionsPage() {
  const params = useParams();
  const school = params?.tenantDomain as string;
  const { canManageClasses } = useClassesAccess();

  const levelsQuery = useGradeLevels();
  const levels = React.useMemo(() => levelsQuery.data ?? [], [levelsQuery.data]);
  const [chosenGradeId, setGradeId] = React.useState('');
  const gradeId = chosenGradeId || levels[0]?.id || '';
  const level = levels.find((l) => l.id === gradeId) ?? null;

  const sectionsQuery = useGradeSections(gradeId);
  const sections = sectionsQuery.data ?? [];
  const deleteSection = useDeleteSection();
  const [form, setForm] = React.useState<{ section: Section | null } | null>(null);
  const [deleting, setDeleting] = React.useState<Section | null>(null);

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      await deleteSection.mutateAsync(deleting.id);
      notify.success(`${deleting.name} is deleted.`);
    } catch (err) {
      notify.error(errorMessage(err, `${deleting.name} wasn't deleted. Try again.`));
      throw err;
    }
  };

  const columns = React.useMemo<ColumnDef<Section>[]>(
    () => [
      {
        accessorKey: 'name',
        header: 'Section',
        cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
      },
      {
        accessorKey: 'description',
        header: 'Notes',
        cell: ({ row }) => row.original.description || <span className="text-muted-foreground">No notes</span>,
      },
      ...(canManageClasses
        ? [
            {
              id: 'actions',
              header: '',
              enableSorting: false,
              meta: { label: 'Actions', className: 'text-right' },
              cell: ({ row }) => (
                <div className="flex flex-wrap justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="min-h-11 md:min-h-9"
                    onClick={() => setForm({ section: row.original })}
                  >
                    <Pencil aria-hidden="true" />
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="min-h-11 text-destructive hover:text-destructive md:min-h-9"
                    onClick={() => setDeleting(row.original)}
                    aria-label={`Delete ${row.original.name}`}
                  >
                    <Trash2 aria-hidden="true" />
                    <span className="md:sr-only">Delete</span>
                  </Button>
                </div>
              ),
            } satisfies ColumnDef<Section>,
          ]
        : []),
    ],
    [canManageClasses]
  );

  const description = `Each grade level is split into sections, for example A and B. Every school year, each section becomes a class.${
    canManageClasses ? '' : ' You can look, but only staff who manage classes can change them.'
  }`;

  const addButton =
    canManageClasses && level ? (
      <Button className="min-h-11 md:min-h-9" onClick={() => setForm({ section: null })}>
        <Plus aria-hidden="true" />
        Add a section
      </Button>
    ) : undefined;

  return (
    <PageShell title="Sections" description={description} primaryAction={addButton}>
      {levelsQuery.isLoading ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : levelsQuery.isError ? (
        <EmptyState
          icon={RefreshCw}
          title="The grade levels didn't load"
          description={`${errorMessage(levelsQuery.error, "The server didn't answer.")} Check your connection and try again.`}
          action={<Button onClick={() => levelsQuery.refetch()}>Try again</Button>}
        />
      ) : levels.length === 0 ? (
        <EmptyState
          icon={Layers}
          title="No grade levels yet"
          description="Sections belong to a grade level. Add the grade levels first."
          action={
            <Button asChild>
              <Link href={`/${school}/academics/grades`}>Open grade levels</Link>
            </Button>
          }
        />
      ) : (
        <>
          <LabeledSelect label="Grade level" value={gradeId} onChange={setGradeId} hideLabel={false}>
            {levels.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </LabeledSelect>

          {sectionsQuery.isError ? (
            <EmptyState
              icon={RefreshCw}
              title="The sections didn't load"
              description={`${errorMessage(sectionsQuery.error, "The server didn't answer.")} Check your connection and try again.`}
              action={<Button onClick={() => sectionsQuery.refetch()}>Try again</Button>}
            />
          ) : (
            <DataTable
              label={`Sections of ${level?.name ?? 'the grade level'}`}
              columns={columns}
              data={sections}
              loading={sectionsQuery.isLoading}
              getRowId={(s) => s.id}
              initialSorting={[{ id: 'name', desc: false }]}
              pageSize={0}
              emptyState={
                <EmptyState
                  icon={Layers}
                  title={`${level?.name ?? 'This grade level'} has no sections yet`}
                  description={
                    canManageClasses
                      ? 'Add a section to start making classes for this grade level.'
                      : 'Staff who manage classes add sections here.'
                  }
                  action={
                    canManageClasses ? (
                      <Button onClick={() => setForm({ section: null })}>Add a section</Button>
                    ) : undefined
                  }
                />
              }
            />
          )}
        </>
      )}

      {form && level ? (
        <SectionFormDialog
          key={form.section?.id ?? 'new'}
          section={form.section}
          gradeId={level.id}
          gradeName={level.name}
          onClose={() => setForm(null)}
        />
      ) : null}

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete ${deleting?.name ?? 'this section'} of ${level?.name ?? 'this grade level'}?`}
        description="Its timetables are deleted with it. This can't be undone."
        confirmLabel="Delete section"
        destructive
        onConfirm={confirmDelete}
      />
    </PageShell>
  );
}

/** Add a section to a grade level, or rename one. */
function SectionFormDialog({
  section,
  gradeId,
  gradeName,
  onClose,
}: {
  section: Section | null;
  gradeId: string;
  gradeName: string;
  onClose: () => void;
}) {
  const createSection = useCreateSection();
  const updateSection = useUpdateSection();
  const busy = createSection.isPending || updateSection.isPending;
  const [name, setName] = React.useState(section?.name ?? '');
  const [notes, setNotes] = React.useState(section?.description ?? '');
  const [nameError, setNameError] = React.useState<string>();

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError('Enter the section name, for example A.');
      return;
    }
    setNameError(undefined);
    const data = { name: trimmed, grade_id: gradeId, description: notes.trim() || undefined };
    try {
      if (section) {
        await updateSection.mutateAsync({ id: section.id, data: { ...data, description: notes.trim() } });
        notify.success(`${trimmed} is saved.`);
      } else {
        await createSection.mutateAsync(data);
        notify.success(`${trimmed} is added to ${gradeName}.`);
      }
      onClose();
    } catch (err) {
      notify.error(errorMessage(err, section ? "The section wasn't saved. Try again." : "The section wasn't added. Try again."));
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{section ? `Edit ${section.name}` : `Add a section to ${gradeName}`}</DialogTitle>
          <DialogDescription>
            {section ? `A section of ${gradeName}.` : 'Every school year, the section becomes a class of this grade level.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={save} className="mt-4 grid gap-4" noValidate>
          <FormField label="Section name" error={nameError} required>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="For example, A or Blue"
              className="h-11 md:h-9"
              maxLength={50}
            />
          </FormField>
          <FormField label="Notes" description="Optional.">
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </FormField>
          <DialogFooter className="mt-2 gap-2 sm:space-x-0">
            <Button type="button" variant="outline" className="min-h-11 md:min-h-9" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" className="min-h-11 md:min-h-9" disabled={busy}>
              {section ? 'Save section' : 'Add section'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
