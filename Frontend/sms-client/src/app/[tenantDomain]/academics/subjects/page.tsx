'use client';

// Subjects: the school's list of subjects. Classes are given subjects from it (Setup step 4), and
// teachers are given subjects in their classes. Staff who manage subjects add, change and delete them.

import * as React from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { BookOpen, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';

import { CountTiles } from '@/components/attendance/attendance-ui';
import {
  useClassesAccess,
  useCreateSubject,
  useDeleteSubject,
  useSubjects,
  useUpdateSubject,
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
import { StatusBadge } from '@/components/ui/status-badge';
import { Switch } from '@/components/ui/switch';
import { notify } from '@/components/ui/toaster';
import type { Subject } from '@/types/subject';

export default function SubjectsPage() {
  const { canManageSubjects } = useClassesAccess();
  const subjectsQuery = useSubjects();
  const subjects = React.useMemo(() => subjectsQuery.data ?? [], [subjectsQuery.data]);
  const deleteSubject = useDeleteSubject();
  const [form, setForm] = React.useState<{ subject: Subject | null } | null>(null);
  const [deleting, setDeleting] = React.useState<Subject | null>(null);

  const active = subjects.filter((s) => s.is_active).length;
  const hours = subjects.filter((s) => s.is_active).reduce((sum, s) => sum + (s.credits || 0), 0);

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      await deleteSubject.mutateAsync(deleting.id);
      notify.success(`${deleting.name} is deleted.`);
    } catch (err) {
      notify.error(errorMessage(err, `${deleting.name} wasn't deleted. Try again.`));
      throw err;
    }
  };

  const columns = React.useMemo<ColumnDef<Subject>[]>(
    () => [
      {
        accessorKey: 'name',
        header: 'Subject',
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="font-medium">{row.original.name}</p>
            {row.original.description ? (
              <p className="line-clamp-2 text-sm text-muted-foreground">{row.original.description}</p>
            ) : null}
          </div>
        ),
      },
      { accessorKey: 'code', header: 'Code', cell: ({ row }) => <span className="font-mono text-sm">{row.original.code}</span> },
      {
        id: 'hours',
        header: 'Hours per week',
        accessorFn: (s) => s.credits ?? 0,
        cell: ({ getValue }) => <span className="tabular-nums">{getValue<number>()}</span>,
      },
      {
        id: 'status',
        header: 'Status',
        accessorFn: (s) => (s.is_active ? 'Active' : 'Not in use'),
        cell: ({ row }) =>
          row.original.is_active ? (
            <StatusBadge status="success" label="Active" />
          ) : (
            <StatusBadge status="neutral" label="Not in use" />
          ),
      },
      ...(canManageSubjects
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
                    onClick={() => setForm({ subject: row.original })}
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
            } satisfies ColumnDef<Subject>,
          ]
        : []),
    ],
    [canManageSubjects]
  );

  const addButton = canManageSubjects ? (
    <Button className="min-h-11 md:min-h-9" onClick={() => setForm({ subject: null })}>
      <Plus aria-hidden="true" />
      Add a subject
    </Button>
  ) : undefined;

  return (
    <PageShell
      title="Subjects"
      description={`The subjects your school teaches. Classes are given subjects from this list.${
        canManageSubjects ? '' : ' You can look, but only staff who manage subjects can change them.'
      }`}
      primaryAction={addButton}
    >
      {subjectsQuery.isError ? (
        <EmptyState
          icon={RefreshCw}
          title="The subjects didn't load"
          description={`${errorMessage(subjectsQuery.error, "The server didn't answer.")} Check your connection and try again.`}
          action={<Button onClick={() => subjectsQuery.refetch()}>Try again</Button>}
        />
      ) : (
        <>
          {!subjectsQuery.isLoading && subjects.length > 0 ? (
            <CountTiles
              className="lg:grid-cols-3"
              tiles={[
                { label: 'Subjects', value: subjects.length },
                { label: 'Active', value: active },
                { label: 'Hours per week (active)', value: hours },
              ]}
            />
          ) : null}
          <DataTable
            label="Subjects"
            columns={columns}
            data={subjects}
            loading={subjectsQuery.isLoading}
            searchable
            searchPlaceholder="Search by name or code"
            getRowId={(s) => s.id}
            initialSorting={[{ id: 'name', desc: false }]}
            pageSize={50}
            emptyState={
              <EmptyState
                icon={BookOpen}
                title="No subjects yet"
                description={
                  canManageSubjects
                    ? 'Add the subjects your school teaches, for example Mathematics and English.'
                    : 'Staff who manage subjects add them here.'
                }
                action={
                  canManageSubjects ? <Button onClick={() => setForm({ subject: null })}>Add a subject</Button> : undefined
                }
              />
            }
          />
        </>
      )}

      {form ? (
        <SubjectFormDialog key={form.subject?.id ?? 'new'} subject={form.subject} onClose={() => setForm(null)} />
      ) : null}

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete ${deleting?.name ?? 'this subject'}?`}
        description="Teachers lose it from their subjects. To keep its history, switch it off instead (Edit, then Active). This can't be undone."
        confirmLabel="Delete subject"
        destructive
        onConfirm={confirmDelete}
      />
    </PageShell>
  );
}

type FormErrors = Partial<Record<'name' | 'code' | 'hours', string>>;

/** Add a subject, or change one. */
function SubjectFormDialog({ subject, onClose }: { subject: Subject | null; onClose: () => void }) {
  const createSubject = useCreateSubject();
  const updateSubject = useUpdateSubject();
  const busy = createSubject.isPending || updateSubject.isPending;
  const [name, setName] = React.useState(subject?.name ?? '');
  const [code, setCode] = React.useState(subject?.code ?? '');
  const [hours, setHours] = React.useState(String(subject?.credits ?? 0));
  const [description, setDescription] = React.useState(subject?.description ?? '');
  const [isActive, setIsActive] = React.useState(subject?.is_active ?? true);
  const [errors, setErrors] = React.useState<FormErrors>({});

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const credits = Number(hours || 0);
    const next: FormErrors = {};
    if (!name.trim()) next.name = 'Enter the subject name, for example Mathematics.';
    if (!code.trim()) next.code = 'Enter a short code, for example MATH.';
    if (!Number.isInteger(credits) || credits < 0 || credits > 60) next.hours = 'Enter the hours per week, from 0 to 60.';
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    const data = {
      name: name.trim(),
      code: code.trim().toUpperCase(),
      description: description.trim() || undefined,
      is_active: isActive,
      credits,
    };
    try {
      if (subject) {
        await updateSubject.mutateAsync({ id: subject.id, data: { ...data, description: description.trim() } });
        notify.success(`${data.name} is saved.`);
      } else {
        await createSubject.mutateAsync(data);
        notify.success(`${data.name} is added.`);
      }
      onClose();
    } catch (err) {
      notify.error(errorMessage(err, subject ? "The subject wasn't saved. Try again." : "The subject wasn't added. Try again."));
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{subject ? `Edit ${subject.name}` : 'Add a subject'}</DialogTitle>
          <DialogDescription>
            {subject ? 'Changes show everywhere the subject is taught.' : 'After adding it, give it to classes under Classes → Setup.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={save} className="mt-4 grid gap-4" noValidate>
          <FormField label="Subject name" error={errors.name} required>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Mathematics" className="h-11 md:h-9" />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Code" error={errors.code} required>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="MATH"
                className="h-11 uppercase md:h-9"
                maxLength={20}
              />
            </FormField>
            <FormField label="Hours per week" error={errors.hours}>
              <Input
                type="number"
                inputMode="numeric"
                min={0}
                max={60}
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                className="h-11 md:h-9"
              />
            </FormField>
          </div>
          <FormField label="Description" description="Optional.">
            <Input value={description} onChange={(e) => setDescription(e.target.value)} className="h-11 md:h-9" />
          </FormField>
          <div className="flex items-center justify-between gap-4 rounded-xl border p-4">
            <div>
              <label htmlFor="subject-active" className="text-sm font-medium">
                Active
              </label>
              <p className="text-sm text-muted-foreground">Subjects that are switched off can&apos;t be given to classes.</p>
            </div>
            <Switch id="subject-active" checked={isActive} onCheckedChange={setIsActive} />
          </div>
          <DialogFooter className="mt-2 gap-2 sm:space-x-0">
            <Button type="button" variant="outline" className="min-h-11 md:min-h-9" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" className="min-h-11 md:min-h-9" disabled={busy}>
              {subject ? 'Save subject' : 'Add subject'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
