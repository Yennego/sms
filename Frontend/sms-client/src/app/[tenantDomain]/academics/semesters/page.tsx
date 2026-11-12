'use client';

// Semesters of a school year: add them, edit their names and dates, or delete them. Fee due dates
// follow the semester dates.

import * as React from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { AlertTriangle, CalendarRange, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';

import { useCurrentSemester } from '@/components/classes/queries-setup';
import { selectClass } from '@/components/students/admission-form';
import { errorMessage, formatDate } from '@/components/students/format';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { DataTable } from '@/components/ui/data-table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { PageShell } from '@/components/ui/page-shell';
import { StatusBadge } from '@/components/ui/status-badge';
import { notify } from '@/components/ui/toaster';
import { useAcademicYears } from '@/hooks/queries/enrollments';
import { useCreateSemester, useDeleteSemester, useSemesters, useUpdateSemester } from '@/hooks/queries/semesters-periods';
import type { Semester } from '@/services/api/semester-service';

type FormValues = { name: string; startDate: string; endDate: string; number: string };
const emptyForm: FormValues = { name: '', startDate: '', endDate: '', number: '' };
const inputClass = 'h-11 text-base md:h-9 md:text-sm';

export default function SemestersPage() {
  const years = useAcademicYears();
  const [yearChoice, setYearChoice] = React.useState('');
  const yearList = years.data ?? [];
  const yearId = yearChoice || (yearList.find((y) => y.is_current) ?? yearList[0])?.id || '';
  const yearName = yearList.find((y) => y.id === yearId)?.name ?? '';

  const semesters = useSemesters(yearId || null);
  const currentSemester = useCurrentSemester();
  const createSemester = useCreateSemester();
  const updateSemester = useUpdateSemester();
  const deleteSemester = useDeleteSemester(yearId);

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Semester | null>(null);
  const [form, setForm] = React.useState<FormValues>(emptyForm);
  const [formError, setFormError] = React.useState('');
  const [toDelete, setToDelete] = React.useState<Semester | null>(null);
  const saving = createSemester.isPending || updateSemester.isPending;

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setFormError('');
    setDialogOpen(true);
  };

  const openEdit = (s: Semester) => {
    setEditing(s);
    setForm({
      name: s.name,
      startDate: (s.start_date || '').slice(0, 10),
      endDate: (s.end_date || '').slice(0, 10),
      number: typeof s.semester_number === 'number' ? String(s.semester_number) : '',
    });
    setFormError('');
    setDialogOpen(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.startDate || !form.endDate) {
      setFormError('Enter a name, a start date and an end date.');
      return;
    }
    if (form.endDate <= form.startDate) {
      setFormError('Enter an end date after the start date.');
      return;
    }
    const number = form.number ? parseInt(form.number, 10) : undefined;
    try {
      if (editing) {
        await updateSemester.mutateAsync({
          id: editing.id,
          data: { name: form.name.trim(), start_date: form.startDate, end_date: form.endDate, semester_number: number },
        });
        notify.success(`${form.name.trim()} is saved.`);
      } else {
        await createSemester.mutateAsync({
          name: form.name.trim(),
          academic_year_id: yearId,
          start_date: form.startDate,
          end_date: form.endDate,
          semester_number: number ?? 1,
        });
        notify.success(`${form.name.trim()} is added to ${yearName}.`);
      }
      setDialogOpen(false);
      setEditing(null);
    } catch (err) {
      setFormError(errorMessage(err, "The semester wasn't saved. Check the dates and try again."));
    }
  };

  const remove = async () => {
    if (!toDelete) return;
    try {
      await deleteSemester.mutateAsync(toDelete.id);
      notify.success(`${toDelete.name} is deleted.`);
    } catch (err) {
      notify.error(errorMessage(err, "The semester wasn't deleted. Try again."));
      throw err;
    }
  };

  const columns = React.useMemo<ColumnDef<Semester>[]>(
    () => [
      {
        accessorKey: 'name',
        header: 'Semester',
        cell: ({ row }) => (
          <div>
            <p className="font-medium">{row.original.name}</p>
            {typeof row.original.semester_number === 'number' ? (
              <p className="text-sm text-muted-foreground">Semester {row.original.semester_number}</p>
            ) : null}
          </div>
        ),
      },
      {
        accessorKey: 'start_date',
        header: 'Dates',
        cell: ({ row }) => `${formatDate(row.original.start_date)} to ${formatDate(row.original.end_date)}`,
      },
      {
        id: 'status',
        accessorFn: (s) => (s.is_current ? 'Current' : 'Not current'),
        header: 'Status',
        cell: ({ row }) =>
          row.original.is_current ? (
            <StatusBadge status="success" label="Current" />
          ) : (
            <StatusBadge status="neutral" label="Not current" />
          ),
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        meta: { label: 'Actions', className: 'text-right' },
        cell: ({ row }) => (
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" size="sm" className="min-h-11 md:min-h-9" onClick={() => openEdit(row.original)}>
              <Pencil aria-hidden="true" />
              Edit
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="min-h-11 text-destructive hover:text-destructive md:min-h-9"
              onClick={() => setToDelete(row.original)}
            >
              <Trash2 aria-hidden="true" />
              Delete
            </Button>
          </div>
        ),
      },
    ],
    []
  );

  const currentNumber = currentSemester.data;

  return (
    <PageShell
      title="Semesters"
      description={
        currentNumber !== null && currentNumber !== undefined
          ? `The semesters of each school year. The school is in semester ${currentNumber}.`
          : 'The semesters of each school year.'
      }
      primaryAction={
        <Button className="min-h-11 md:min-h-9" onClick={openCreate} disabled={!yearId}>
          <Plus aria-hidden="true" />
          Add semester
        </Button>
      }
    >
      <div className="grid gap-2 sm:max-w-xs">
        <label htmlFor="semester-year" className="text-sm font-medium">
          School year
        </label>
        <select
          id="semester-year"
          className={selectClass}
          value={yearId}
          disabled={years.isLoading}
          onChange={(e) => setYearChoice(e.target.value)}
        >
          {years.isLoading ? <option value="">Loading years…</option> : null}
          {!years.isLoading && yearList.length === 0 ? <option value="">No school years</option> : null}
          {yearList.map((y) => (
            <option key={y.id} value={y.id}>
              {y.name}
              {y.is_current ? ' (current)' : ''}
            </option>
          ))}
        </select>
      </div>

      {years.isError || semesters.isError ? (
        <EmptyState
          icon={CalendarRange}
          title="The semesters didn't load"
          description={`${errorMessage(years.error ?? semesters.error, 'The server didn’t answer.')} Check your connection and try again.`}
          action={
            <Button onClick={() => (years.isError ? years.refetch() : semesters.refetch())}>Try again</Button>
          }
        />
      ) : !years.isLoading && yearList.length === 0 ? (
        <EmptyState
          icon={CalendarRange}
          description="Add a school year in Years and terms first, then its semesters."
        />
      ) : (
        <DataTable
          label={`Semesters of ${yearName}`}
          columns={columns}
          data={semesters.data ?? []}
          loading={years.isLoading || semesters.isLoading}
          pageSize={0}
          getRowId={(s) => s.id}
          initialSorting={[{ id: 'start_date', desc: false }]}
          emptyState={
            <EmptyState
              icon={CalendarRange}
              description={`${yearName || 'This year'} has no semesters yet. Add the first one.`}
              action={<Button onClick={openCreate}>Add semester</Button>}
            />
          }
        />
      )}

      <Dialog open={dialogOpen} onOpenChange={(open) => !saving && setDialogOpen(open)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? `Edit ${editing.name}` : `Add a semester to ${yearName}`}</DialogTitle>
            <DialogDescription>The semester&apos;s name, number and first and last day.</DialogDescription>
          </DialogHeader>
          <form id="semester-form" onSubmit={save} className="grid gap-4" noValidate>
            {editing ? (
              <div role="note" className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                <AlertTriangle className="size-5 shrink-0" aria-hidden="true" />
                <p>Changing semester dates changes fee due dates.</p>
              </div>
            ) : null}
            <FormField label="Name" required>
              <Input
                className={inputClass}
                placeholder="First semester"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              />
            </FormField>
            <FormField label="Semester number" description="1 for the first semester, 2 for the second.">
              <Input
                type="number"
                inputMode="numeric"
                min={1}
                max={4}
                className={inputClass}
                value={form.number}
                onChange={(e) => setForm((p) => ({ ...p, number: e.target.value }))}
              />
            </FormField>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Start date" required>
                <Input
                  type="date"
                  className={inputClass}
                  value={form.startDate}
                  onChange={(e) => setForm((p) => ({ ...p, startDate: e.target.value }))}
                />
              </FormField>
              <FormField label="End date" required>
                <Input
                  type="date"
                  className={inputClass}
                  value={form.endDate}
                  min={form.startDate || undefined}
                  onChange={(e) => setForm((p) => ({ ...p, endDate: e.target.value }))}
                />
              </FormField>
            </div>
            {formError ? (
              <p role="alert" className="text-sm font-medium text-destructive">
                {formError}
              </p>
            ) : null}
          </form>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="min-h-11 md:min-h-9"
              onClick={() => setDialogOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" form="semester-form" className="min-h-11 md:min-h-9" disabled={saving}>
              {saving ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
              {editing ? 'Save semester' : 'Add semester'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(toDelete)}
        onOpenChange={(open) => !open && setToDelete(null)}
        title={`Delete ${toDelete?.name ?? 'this semester'}?`}
        description="The semester and its dates are removed. This can't be undone."
        confirmLabel="Delete semester"
        destructive
        loading={deleteSemester.isPending}
        onConfirm={remove}
      />
    </PageShell>
  );
}
