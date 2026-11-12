'use client';

// Grade levels: the school's levels in order (Kindergarten, Grade 1, ...). Each level has sections,
// and the order decides where students move up to. Staff who manage classes add, change and delete them.

import * as React from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { GraduationCap, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';

import {
  useClassesAccess,
  useCreateGradeLevel,
  useDeleteGradeLevel,
  useGradeLevels,
  useSections,
  useUpdateGradeLevel,
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
import { Textarea } from '@/components/ui/textarea';
import { notify } from '@/components/ui/toaster';
import type { AcademicGrade } from '@/types/academic-grade';

export default function GradeLevelsPage() {
  const { canManageClasses } = useClassesAccess();
  const levelsQuery = useGradeLevels();
  const sectionsQuery = useSections();
  const levels = React.useMemo(() => levelsQuery.data ?? [], [levelsQuery.data]);
  const deleteLevel = useDeleteGradeLevel();
  const [form, setForm] = React.useState<{ level: AcademicGrade | null } | null>(null);
  const [deleting, setDeleting] = React.useState<AcademicGrade | null>(null);

  const sectionCount = React.useMemo(() => {
    const map: Record<string, number> = {};
    for (const s of sectionsQuery.data ?? []) map[s.grade_id] = (map[s.grade_id] ?? 0) + 1;
    return map;
  }, [sectionsQuery.data]);

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      await deleteLevel.mutateAsync(deleting.id);
      notify.success(`${deleting.name} is deleted.`);
    } catch (err) {
      notify.error(errorMessage(err, `${deleting.name} wasn't deleted. Try again.`));
      throw err;
    }
  };

  const columns = React.useMemo<ColumnDef<AcademicGrade>[]>(
    () => [
      {
        accessorKey: 'sequence',
        header: 'Order',
        cell: ({ row }) => <span className="tabular-nums">{row.original.sequence}</span>,
      },
      {
        accessorKey: 'name',
        header: 'Grade level',
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="font-medium">{row.original.name}</p>
            {row.original.description ? (
              <p className="line-clamp-2 text-sm text-muted-foreground">{row.original.description}</p>
            ) : null}
          </div>
        ),
      },
      {
        id: 'age',
        header: 'Ages',
        meta: { hideOnMobile: true },
        accessorFn: (l) => l.age_range ?? '',
        cell: ({ row }) => row.original.age_range || <span className="text-muted-foreground">Not set</span>,
      },
      {
        id: 'sections',
        header: 'Sections',
        accessorFn: (l) => sectionCount[l.id] ?? 0,
        cell: ({ row }) => {
          const n = sectionCount[row.original.id] ?? 0;
          if (sectionsQuery.isLoading) return null;
          return n > 0 ? <span className="tabular-nums">{n}</span> : <StatusBadge status="pending" label="No sections" />;
        },
      },
      {
        id: 'status',
        header: 'Status',
        accessorFn: (l) => (l.is_active ? 'Active' : 'Not in use'),
        cell: ({ row }) =>
          row.original.is_active ? (
            <StatusBadge status="success" label="Active" />
          ) : (
            <StatusBadge status="neutral" label="Not in use" />
          ),
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
                    onClick={() => setForm({ level: row.original })}
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
            } satisfies ColumnDef<AcademicGrade>,
          ]
        : []),
    ],
    [canManageClasses, sectionCount, sectionsQuery.isLoading]
  );

  const addButton = canManageClasses ? (
    <Button className="min-h-11 md:min-h-9" onClick={() => setForm({ level: null })}>
      <Plus aria-hidden="true" />
      Add a grade level
    </Button>
  ) : undefined;

  const nextOrder = levels.length > 0 ? Math.max(...levels.map((l) => l.sequence)) + 1 : 1;

  return (
    <PageShell
      title="Grade levels"
      description={`Your school's levels in order. Students move up from one level to the next, and each level is split into sections.${
        canManageClasses ? '' : ' You can look, but only staff who manage classes can change them.'
      }`}
      primaryAction={addButton}
    >
      {levelsQuery.isError ? (
        <EmptyState
          icon={RefreshCw}
          title="The grade levels didn't load"
          description={`${errorMessage(levelsQuery.error, "The server didn't answer.")} Check your connection and try again.`}
          action={<Button onClick={() => levelsQuery.refetch()}>Try again</Button>}
        />
      ) : (
        <DataTable
          label="Grade levels"
          columns={columns}
          data={levels}
          loading={levelsQuery.isLoading}
          getRowId={(l) => l.id}
          initialSorting={[{ id: 'sequence', desc: false }]}
          pageSize={0}
          emptyState={
            <EmptyState
              icon={GraduationCap}
              title="No grade levels yet"
              description={
                canManageClasses
                  ? 'Add your levels in order, for example Kindergarten, Grade 1 and Grade 2.'
                  : 'Staff who manage classes add grade levels here.'
              }
              action={
                canManageClasses ? <Button onClick={() => setForm({ level: null })}>Add a grade level</Button> : undefined
              }
            />
          }
        />
      )}

      {form ? (
        <GradeLevelFormDialog
          key={form.level?.id ?? 'new'}
          level={form.level}
          nextOrder={nextOrder}
          onClose={() => setForm(null)}
        />
      ) : null}

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete ${deleting?.name ?? 'this grade level'}?`}
        description="Its sections, their timetables and its promotion rules are deleted with it. This can't be undone."
        confirmLabel="Delete grade level"
        destructive
        onConfirm={confirmDelete}
      />
    </PageShell>
  );
}

type FormErrors = Partial<Record<'name' | 'order', string>>;

/** Add a grade level, or change one. */
function GradeLevelFormDialog({
  level,
  nextOrder,
  onClose,
}: {
  level: AcademicGrade | null;
  nextOrder: number;
  onClose: () => void;
}) {
  const createLevel = useCreateGradeLevel();
  const updateLevel = useUpdateGradeLevel();
  const busy = createLevel.isPending || updateLevel.isPending;
  const [name, setName] = React.useState(level?.name ?? '');
  const [order, setOrder] = React.useState(String(level?.sequence ?? nextOrder));
  const [ageRange, setAgeRange] = React.useState(level?.age_range ?? '');
  const [description, setDescription] = React.useState(level?.description ?? '');
  const [isActive, setIsActive] = React.useState(level?.is_active ?? true);
  const [errors, setErrors] = React.useState<FormErrors>({});

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const sequence = Number(order);
    const next: FormErrors = {};
    if (!name.trim()) next.name = 'Enter the grade level name, for example Grade 1.';
    if (order.trim() === '' || !Number.isInteger(sequence) || sequence < 0 || sequence > 100) {
      next.order = 'Enter its place in the order, from 0 to 100.';
    }
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    const data = {
      name: name.trim(),
      sequence,
      age_range: ageRange.trim() || undefined,
      description: description.trim() || undefined,
      is_active: isActive,
    };
    try {
      if (level) {
        await updateLevel.mutateAsync({
          id: level.id,
          data: { ...data, age_range: ageRange.trim(), description: description.trim() },
        });
        notify.success(`${data.name} is saved.`);
      } else {
        await createLevel.mutateAsync(data);
        notify.success(`${data.name} is added. Add its sections next.`);
      }
      onClose();
    } catch (err) {
      notify.error(
        errorMessage(err, level ? "The grade level wasn't saved. Try again." : "The grade level wasn't added. Try again.")
      );
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{level ? `Edit ${level.name}` : 'Add a grade level'}</DialogTitle>
          <DialogDescription>The order decides which level students move up to: lower numbers come first.</DialogDescription>
        </DialogHeader>
        <form onSubmit={save} className="mt-4 grid gap-4" noValidate>
          <FormField label="Grade level name" error={errors.name} required>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="For example, Grade 1 or Kindergarten"
              className="h-11 md:h-9"
            />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Order" error={errors.order} required>
              <Input
                type="number"
                inputMode="numeric"
                min={0}
                max={100}
                value={order}
                onChange={(e) => setOrder(e.target.value)}
                className="h-11 md:h-9"
              />
            </FormField>
            <FormField label="Ages" description="Optional.">
              <Input
                value={ageRange}
                onChange={(e) => setAgeRange(e.target.value)}
                placeholder="For example, 6 to 7"
                className="h-11 md:h-9"
              />
            </FormField>
          </div>
          <FormField label="Description" description="Optional.">
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </FormField>
          <div className="flex items-center justify-between gap-4 rounded-xl border p-4">
            <div>
              <label htmlFor="level-active" className="text-sm font-medium">
                Active
              </label>
              <p className="text-sm text-muted-foreground">Switch it off for a level the school no longer teaches.</p>
            </div>
            <Switch id="level-active" checked={isActive} onCheckedChange={setIsActive} />
          </div>
          <DialogFooter className="mt-2 gap-2 sm:space-x-0">
            <Button type="button" variant="outline" className="min-h-11 md:min-h-9" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" className="min-h-11 md:min-h-9" disabled={busy}>
              {level ? 'Save grade level' : 'Add grade level'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
