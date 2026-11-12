'use client';

// Years and terms: the school years, which one is current, and their dates. Add a year, edit its
// name and dates, make it current, archive it (read-only) or delete it.

import * as React from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { AlertTriangle, Archive, CalendarDays, CheckCircle2, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';

import { errorMessage, formatDate, isoDay } from '@/components/students/format';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { DataTable } from '@/components/ui/data-table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { PageShell } from '@/components/ui/page-shell';
import { StatusBadge } from '@/components/ui/status-badge';
import { Switch } from '@/components/ui/switch';
import { notify } from '@/components/ui/toaster';
import {
  useAcademicYearsList,
  useArchiveAcademicYear,
  useCreateAcademicYear,
  useDeleteAcademicYear,
  useSetCurrentAcademicYear,
  useUpdateAcademicYear,
} from '@/hooks/queries/academic-years';

type Year = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  isArchived: boolean;
  isUpcoming: boolean;
  totalStudents: number;
  totalClasses: number;
};

type RawYear = {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
  is_archived?: boolean;
  status?: string;
  total_students?: number;
  total_classes?: number;
};

type FormValues = { name: string; startDate: string; endDate: string; isCurrent: boolean };
const emptyForm: FormValues = { name: '', startDate: '', endDate: '', isCurrent: false };
const inputClass = 'h-11 text-base md:h-9 md:text-sm';

function YearStatus({ year }: { year: Year }) {
  return (
    <div className="flex flex-wrap gap-1">
      {year.isCurrent ? (
        <StatusBadge status="success" label="Current" />
      ) : year.isUpcoming ? (
        <StatusBadge status="info" label="Upcoming" />
      ) : (
        <StatusBadge status="neutral" label="Not current" />
      )}
      {year.isArchived ? <StatusBadge status="warning" icon={Archive} label="Archived" /> : null}
    </div>
  );
}

export default function AcademicYearsPage() {
  const [includeArchived, setIncludeArchived] = React.useState(false);
  const list = useAcademicYearsList(includeArchived);
  const createYear = useCreateAcademicYear();
  const updateYear = useUpdateAcademicYear();
  const deleteYear = useDeleteAcademicYear();
  const setCurrent = useSetCurrentAcademicYear();
  const archiveYear = useArchiveAcademicYear();

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Year | null>(null);
  const [form, setForm] = React.useState<FormValues>(emptyForm);
  const [formError, setFormError] = React.useState('');
  const [toDelete, setToDelete] = React.useState<Year | null>(null);
  const [toArchive, setToArchive] = React.useState<Year | null>(null);

  const years = React.useMemo<Year[]>(() => {
    const today = isoDay(new Date());
    return ((list.data ?? []) as RawYear[]).map((y) => ({
      id: y.id,
      name: y.name,
      startDate: (y.start_date || '').slice(0, 10),
      endDate: (y.end_date || '').slice(0, 10),
      isCurrent: Boolean(y.is_current),
      isArchived: Boolean(y.is_archived || y.status === 'archived'),
      isUpcoming: (y.start_date || '').slice(0, 10) > today,
      totalStudents: y.total_students || 0,
      totalClasses: y.total_classes || 0,
    }));
  }, [list.data]);
  const currentYear = years.find((y) => y.isCurrent);
  const saving = createYear.isPending || updateYear.isPending;

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setFormError('');
    setDialogOpen(true);
  };

  const openEdit = (year: Year) => {
    setEditing(year);
    setForm({ name: year.name, startDate: year.startDate, endDate: year.endDate, isCurrent: year.isCurrent });
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
    const payload = { name: form.name.trim(), start_date: form.startDate, end_date: form.endDate, is_current: form.isCurrent };
    try {
      if (editing) {
        await updateYear.mutateAsync({ id: editing.id, data: payload });
        notify.success(`${payload.name} is saved.`);
      } else {
        await createYear.mutateAsync(payload);
        notify.success(`${payload.name} is added. Add its semesters next.`);
      }
      setDialogOpen(false);
      setEditing(null);
    } catch (err) {
      setFormError(errorMessage(err, "The year wasn't saved. Check the dates and try again."));
    }
  };

  const makeCurrent = async (year: Year) => {
    try {
      await setCurrent.mutateAsync(year.id);
      notify.success(`${year.name} is now the current year.`);
    } catch (err) {
      notify.error(errorMessage(err, "The current year wasn't changed. Try again."));
    }
  };

  const archive = async () => {
    if (!toArchive) return;
    try {
      await archiveYear.mutateAsync(toArchive.id);
      notify.success(`${toArchive.name} is archived.`);
    } catch (err) {
      notify.error(errorMessage(err, "The year wasn't archived. Try again."));
      throw err;
    }
  };

  const remove = async () => {
    if (!toDelete) return;
    try {
      await deleteYear.mutateAsync(toDelete.id);
      notify.success(`${toDelete.name} is deleted.`);
    } catch (err) {
      notify.error(errorMessage(err, "The year wasn't deleted. Try again."));
      throw err;
    }
  };

  const columns = React.useMemo<ColumnDef<Year>[]>(
    () => [
      {
        accessorKey: 'name',
        header: 'Year',
        cell: ({ row }) => (
          <div>
            <p className="font-medium">{row.original.name}</p>
            <p className="text-sm text-muted-foreground">
              {formatDate(row.original.startDate)} to {formatDate(row.original.endDate)}
            </p>
          </div>
        ),
      },
      {
        id: 'status',
        accessorFn: (y) => (y.isCurrent ? 'Current' : y.isUpcoming ? 'Upcoming' : 'Not current'),
        header: 'Status',
        cell: ({ row }) => <YearStatus year={row.original} />,
      },
      {
        accessorKey: 'totalStudents',
        header: 'Students',
        meta: { className: 'tabular-nums', hideOnMobile: true },
      },
      {
        accessorKey: 'totalClasses',
        header: 'Classes',
        meta: { className: 'tabular-nums', hideOnMobile: true },
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        meta: { label: 'Actions', className: 'text-right' },
        cell: ({ row }) => {
          const year = row.original;
          return (
            <div className="flex flex-wrap justify-end gap-2">
              {!year.isArchived ? (
                <>
                  <Button variant="outline" size="sm" className="min-h-11 md:min-h-9" onClick={() => openEdit(year)}>
                    <Pencil aria-hidden="true" />
                    Edit
                  </Button>
                  {!year.isCurrent ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="min-h-11 md:min-h-9"
                      onClick={() => makeCurrent(year)}
                      disabled={setCurrent.isPending}
                    >
                      <CheckCircle2 aria-hidden="true" />
                      Make current
                    </Button>
                  ) : null}
                  <Button variant="outline" size="sm" className="min-h-11 md:min-h-9" onClick={() => setToArchive(year)}>
                    <Archive aria-hidden="true" />
                    Archive
                  </Button>
                </>
              ) : null}
              {!year.isCurrent && !year.isArchived ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="min-h-11 text-destructive hover:text-destructive md:min-h-9"
                  onClick={() => setToDelete(year)}
                >
                  <Trash2 aria-hidden="true" />
                  Delete
                </Button>
              ) : null}
            </div>
          );
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [setCurrent.isPending]
  );

  return (
    <PageShell
      title="Years and terms"
      description="The school years and which one is current. Classes, enrollments, fees and attendance follow the current year."
      secondaryActions={
        <div className="flex items-center gap-2">
          <Switch id="show-archived" checked={includeArchived} onCheckedChange={setIncludeArchived} />
          <label htmlFor="show-archived" className="text-sm font-medium">
            Show archived years
          </label>
        </div>
      }
      primaryAction={
        <Button className="min-h-11 md:min-h-9" onClick={openCreate}>
          <Plus aria-hidden="true" />
          Add school year
        </Button>
      }
    >
      {list.isLoading ? null : currentYear ? (
        <div role="status" className="flex gap-3 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-900">
          <CheckCircle2 className="size-5 shrink-0" aria-hidden="true" />
          <p>
            <span className="font-semibold">Current year: {currentYear.name}</span>, {formatDate(currentYear.startDate)} to{' '}
            {formatDate(currentYear.endDate)}.
          </p>
        </div>
      ) : list.isSuccess && years.length > 0 ? (
        <div role="status" className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <AlertTriangle className="size-5 shrink-0" aria-hidden="true" />
          <p>No year is current, so enrollments, fees and attendance can&apos;t start. Make a year current.</p>
        </div>
      ) : null}

      {list.isError ? (
        <EmptyState
          icon={CalendarDays}
          title="The school years didn't load"
          description={`${errorMessage(list.error, 'The server didn’t answer.')} Check your connection and try again.`}
          action={<Button onClick={() => list.refetch()}>Try again</Button>}
        />
      ) : (
        <DataTable
          label="School years"
          columns={columns}
          data={years}
          loading={list.isLoading}
          pageSize={0}
          getRowId={(y) => y.id}
          initialSorting={[{ id: 'name', desc: true }]}
          emptyState={
            <EmptyState
              icon={CalendarDays}
              description="No school years yet. Add the first year to start enrolling students and creating classes."
              action={<Button onClick={openCreate}>Add school year</Button>}
            />
          }
        />
      )}

      <Dialog open={dialogOpen} onOpenChange={(open) => !saving && setDialogOpen(open)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? `Edit ${editing.name}` : 'Add school year'}</DialogTitle>
            <DialogDescription>The name and the first and last day of the school year.</DialogDescription>
          </DialogHeader>
          <form id="year-form" onSubmit={save} className="grid gap-4" noValidate>
            {editing ? (
              <div role="note" className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                <AlertTriangle className="size-5 shrink-0" aria-hidden="true" />
                <p>
                  Changing the start date changes the year on new receipt numbers; changing semester dates changes fee due
                  dates.
                </p>
              </div>
            ) : null}
            <FormField label="Name" required>
              <Input
                className={inputClass}
                placeholder="2026/2027"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
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
            <div className="flex items-center gap-3">
              <Switch
                id="year-current"
                checked={form.isCurrent}
                onCheckedChange={(checked) => setForm((p) => ({ ...p, isCurrent: checked }))}
              />
              <label htmlFor="year-current" className="text-sm font-medium">
                Make this the current year
              </label>
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
            <Button type="submit" form="year-form" className="min-h-11 md:min-h-9" disabled={saving}>
              {saving ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
              {editing ? 'Save year' : 'Add year'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(toArchive)}
        onOpenChange={(open) => !open && setToArchive(null)}
        title={`Archive ${toArchive?.name ?? 'this year'}?`}
        description="The year becomes read-only: its classes, enrollments and results can be viewed but not changed."
        confirmLabel="Archive year"
        loading={archiveYear.isPending}
        onConfirm={archive}
      />

      <ConfirmDialog
        open={Boolean(toDelete)}
        onOpenChange={(open) => !open && setToDelete(null)}
        title={`Delete ${toDelete?.name ?? 'this year'}?`}
        description="The year is removed with its dates. This can't be undone. To keep its records, archive it instead."
        confirmLabel="Delete year"
        destructive
        loading={deleteYear.isPending}
        onConfirm={remove}
      />
    </PageShell>
  );
}
