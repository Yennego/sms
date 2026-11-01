'use client';

// The three parts of Fee setup: fee schedules for a semester (per grade level or all grade
// levels, × category, with USD and LRD amounts), the semester's installment plan (due dates and
// percents adding up to 100) and fee categories. Plus the "Issue invoices" sheet.
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { ColumnDef } from '@tanstack/react-table';
import { CalendarPlus, CheckCircle2, Loader2, Pencil, Plus, Tags, Trash2, Wallet } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { DataTable } from '@/components/ui/data-table';
import { DropdownMenu } from '@/components/ui/dropdown-menu';
import { EmptyState } from '@/components/ui/empty-state';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Sheet } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/ui/status-badge';
import { Textarea } from '@/components/ui/textarea';
import { notify } from '@/components/ui/toaster';
import { errorMessage, formatDate } from '@/components/students/format';
import { className as classLabel, useYearClasses } from '@/components/class-placement/queries';
import type { AcademicGrade } from '@/types/academic-grade';
import type { Semester } from '@/services/api/semester-service';
import type { FeeCategory, FeeSchedule, IssueInvoicesResult } from '@/services/api/fees-service';
import { centsToDecimal, formatAmount, formatPercent, isPositive, toCents } from './money';
import {
  useDeleteFeeCategory,
  useDeleteFeeSchedule,
  useFeeCategories,
  useFeeSchedules,
  useInstallmentPlan,
  useIssueInvoices,
  useSaveFeeCategory,
  useSaveFeeSchedule,
  useSaveInstallmentPlan,
} from './queries';
import { inputClassName, LoadError, nativeSelectClassName } from './shared';

const AMOUNT_RE = /^\d{1,10}(\.\d{1,2})?$/;
const ALL_GRADES = '__all__';

function saveError(error: unknown, fallback: string) {
  notify.error(errorMessage(error, fallback));
}

// ---- Schedules -----------------------------------------------------------------------------------

const scheduleSchema = z
  .object({
    grade_id: z.string().min(1, 'Choose a grade level, or all grade levels'),
    category_id: z.string().min(1, 'Choose a fee category'),
    amount_usd: z.string().trim().refine((v) => v === '' || AMOUNT_RE.test(v), 'Enter an amount like 150 or 150.50'),
    amount_lrd: z.string().trim().refine((v) => v === '' || AMOUNT_RE.test(v), 'Enter an amount like 27000 or 27000.50'),
  })
  .refine((v) => isPositive(v.amount_usd) || isPositive(v.amount_lrd), {
    path: ['amount_usd'],
    message: 'Enter the amount in USD, LRD or both',
  });

type ScheduleValues = z.infer<typeof scheduleSchema>;

function ScheduleSheet({
  open,
  onOpenChange,
  schedule,
  yearId,
  semesterId,
  grades,
  categories,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schedule: FeeSchedule | null;
  yearId: string;
  semesterId: string;
  grades: AcademicGrade[];
  categories: FeeCategory[];
}) {
  const formId = React.useId();
  const save = useSaveFeeSchedule();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ScheduleValues>({ resolver: zodResolver(scheduleSchema) });

  React.useEffect(() => {
    if (!open) return;
    reset({
      grade_id: schedule ? schedule.grade_id ?? ALL_GRADES : '',
      category_id: schedule?.category_id ?? '',
      amount_usd: schedule?.amount_usd ?? '',
      amount_lrd: schedule?.amount_lrd ?? '',
    });
  }, [open, schedule, reset]);

  const onSubmit = handleSubmit(async (v) => {
    try {
      await save.mutateAsync({
        id: schedule?.id,
        input: {
          academic_year_id: yearId,
          semester_id: semesterId,
          grade_id: v.grade_id === ALL_GRADES ? null : v.grade_id,
          category_id: v.category_id,
          amount_usd: isPositive(v.amount_usd) ? v.amount_usd : null,
          amount_lrd: isPositive(v.amount_lrd) ? v.amount_lrd : null,
        },
      });
      notify.success(schedule ? 'Fee saved' : 'Fee added', {
        description: 'Issue invoices to put it on students’ bills.',
      });
      onOpenChange(false);
    } catch (error) {
      saveError(error, "Couldn't save this fee. Check the details and try again.");
    }
  });

  const activeCategories = categories.filter((c) => c.is_active || c.id === schedule?.category_id);
  // Once a fee is on bills only its amounts can change.
  const locked = Boolean(schedule?.invoiced);

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => !save.isPending && onOpenChange(next)}
      title={schedule ? 'Edit fee' : 'Add fee'}
      description="Give the amount in USD, LRD or both. Families pay in one currency for the year."
      className="sm:max-w-md"
      footer={
        <>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={save.isPending}>
            Cancel
          </Button>
          <Button type="submit" form={formId} disabled={save.isPending}>
            {save.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
            {schedule ? 'Save fee' : 'Add fee'}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={onSubmit} noValidate className="grid gap-5">
        {locked && schedule ? (
          <div className="grid gap-1 text-sm">
            <p className="font-medium text-foreground">
              {schedule.category_name || 'Fee'} · {schedule.grade_id === null ? 'All grade levels' : schedule.grade_name || 'Grade level'}
            </p>
            <p className="text-muted-foreground">
              This fee is already on students&apos; bills, so only the amounts can change. New amounts apply to bills issued
              from now on.
            </p>
          </div>
        ) : (
          <>
            <FormField label="Grade level" error={errors.grade_id?.message} required>
              <select className={nativeSelectClassName} {...register('grade_id')}>
                <option value="">Choose</option>
                <option value={ALL_GRADES}>All grade levels</option>
                {grades.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField
              label="Category"
              error={errors.category_id?.message}
              required
              description={activeCategories.length === 0 ? 'Add a fee category first (Categories tab).' : undefined}
            >
              <select className={nativeSelectClassName} {...register('category_id')}>
                <option value="">Choose</option>
                {activeCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </FormField>
          </>
        )}
        <FormField label="Amount in USD" error={errors.amount_usd?.message}>
          <Input inputMode="decimal" placeholder="0.00" className={inputClassName} {...register('amount_usd')} />
        </FormField>
        <FormField label="Amount in LRD" error={errors.amount_lrd?.message}>
          <Input inputMode="decimal" placeholder="0.00" className={inputClassName} {...register('amount_lrd')} />
        </FormField>
      </form>
    </Sheet>
  );
}

export function SchedulesPanel({
  yearId,
  semesterId,
  grades,
  canEdit,
}: {
  yearId: string;
  semesterId: string;
  grades: AcademicGrade[];
  canEdit: boolean;
}) {
  const q = useFeeSchedules(yearId, semesterId);
  const categoriesData = useFeeCategories().data;
  const categories = React.useMemo(() => categoriesData ?? [], [categoriesData]);
  const remove = useDeleteFeeSchedule();
  const [editing, setEditing] = React.useState<FeeSchedule | null>(null);
  const [adding, setAdding] = React.useState(false);
  const [deleting, setDeleting] = React.useState<FeeSchedule | null>(null);

  const gradeName = React.useCallback(
    (s: FeeSchedule) =>
      s.grade_id === null ? 'All grade levels' : s.grade_name || grades.find((g) => g.id === s.grade_id)?.name || 'Grade level',
    [grades]
  );
  const categoryName = React.useCallback(
    (s: FeeSchedule) => s.category_name || categories.find((c) => c.id === s.category_id)?.name || 'Fee',
    [categories]
  );

  const rows = React.useMemo(() => {
    const order = new Map(grades.map((g, i) => [g.id, i]));
    return [...(q.data ?? [])].sort((a, b) => {
      const ga = a.grade_id === null ? -1 : order.get(a.grade_id) ?? 999;
      const gb = b.grade_id === null ? -1 : order.get(b.grade_id) ?? 999;
      return ga - gb || categoryName(a).localeCompare(categoryName(b));
    });
  }, [q.data, grades, categoryName]);

  const columns = React.useMemo<ColumnDef<FeeSchedule>[]>(
    () => [
      { id: 'grade', enableSorting: false, header: 'Grade level', cell: ({ row }) => gradeName(row.original) },
      { id: 'category', enableSorting: false, header: 'Category', cell: ({ row }) => categoryName(row.original) },
      {
        id: 'usd',
        enableSorting: false,
        header: 'USD',
        cell: ({ row }) => <span className="tabular-nums">{row.original.amount_usd ? formatAmount(row.original.amount_usd) : '—'}</span>,
        meta: { className: 'text-right' },
      },
      {
        id: 'lrd',
        enableSorting: false,
        header: 'LRD',
        cell: ({ row }) => <span className="tabular-nums">{row.original.amount_lrd ? formatAmount(row.original.amount_lrd) : '—'}</span>,
        meta: { className: 'text-right' },
      },
      ...(canEdit
        ? ([
            {
              id: 'actions',
              enableSorting: false,
              header: () => <span className="sr-only">Actions</span>,
              cell: ({ row }) => (
                <div className="flex justify-end">
                  <DropdownMenu
                    label={`Actions for ${categoryName(row.original)}, ${gradeName(row.original)}`}
                    items={[
                      { label: 'Edit fee', icon: Pencil, onSelect: () => setEditing(row.original) },
                      // A fee already on bills can't be deleted (the server refuses).
                      ...(row.original.invoiced
                        ? []
                        : [{ label: 'Delete fee', icon: Trash2, destructive: true, onSelect: () => setDeleting(row.original) }]),
                    ]}
                  />
                </div>
              ),
              meta: { label: 'Actions', className: 'text-right' },
            },
          ] as ColumnDef<FeeSchedule>[])
        : []),
    ],
    [canEdit, gradeName, categoryName]
  );

  if (q.isError) return <LoadError error={q.error} what="fees" onRetry={() => q.refetch()} />;

  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          A fee for “All grade levels” applies to every student; a grade level fee only to that grade.
        </p>
        {canEdit ? (
          <Button variant="outline" className="min-h-11 md:min-h-9" onClick={() => setAdding(true)}>
            <Plus aria-hidden="true" />
            Add fee
          </Button>
        ) : null}
      </div>
      <DataTable
        label="Fees for this semester"
        columns={columns}
        data={rows}
        loading={q.isLoading}
        pageSize={0}
        getRowId={(s) => s.id}
        emptyState={
          <EmptyState
            icon={Wallet}
            title="No fees for this semester"
            description="Add each fee (tuition, registration, ...) with its amount, per grade level or for all grade levels."
            action={canEdit ? <Button onClick={() => setAdding(true)}>Add fee</Button> : undefined}
          />
        }
      />
      <ScheduleSheet
        open={adding || Boolean(editing)}
        onOpenChange={(open) => {
          if (!open) {
            setAdding(false);
            setEditing(null);
          }
        }}
        schedule={editing}
        yearId={yearId}
        semesterId={semesterId}
        grades={grades}
        categories={categories}
      />
      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={deleting ? `Delete ${categoryName(deleting)} for ${gradeName(deleting)}?` : 'Delete fee?'}
        description="It won't be added to new bills. A fee that is already on students' bills can't be deleted."
        confirmLabel="Delete fee"
        destructive
        loading={remove.isPending}
        onConfirm={async () => {
          if (!deleting) return;
          try {
            await remove.mutateAsync(deleting.id);
            notify.success('Fee deleted');
          } catch (error) {
            saveError(error, "Couldn't delete this fee. Check your connection and try again.");
            throw error;
          }
        }}
      />
    </section>
  );
}

// ---- Installment plan ----------------------------------------------------------------------------

interface PlanRow {
  key: number;
  due_date: string;
  percent: string;
}

let rowKey = 0;
const newRow = (due_date = '', percent = ''): PlanRow => ({ key: ++rowKey, due_date, percent });

export function InstallmentPlanPanel({
  yearId,
  semester,
  canEdit,
}: {
  yearId: string;
  semester: Semester;
  canEdit: boolean;
}) {
  const q = useInstallmentPlan(yearId, semester.id);
  const save = useSaveInstallmentPlan();
  const [rows, setRows] = React.useState<PlanRow[] | null>(null);
  const [errors, setErrors] = React.useState<string[]>([]);

  // Load the saved plan into the editor (again when the semester changes).
  React.useEffect(() => {
    if (!q.isSuccess) return;
    const saved = [...(q.data?.installments ?? [])].sort((a, b) => a.due_date.localeCompare(b.due_date));
    const defaultDue = q.data?.default_due_date ?? semester.end_date;
    setRows(
      saved.length > 0
        ? saved.map((i) => newRow(i.due_date.slice(0, 10), centsToDecimal(toCents(i.percent) ?? BigInt(0)).replace(/\.00$/, '')))
        : [newRow(defaultDue?.slice(0, 10) ?? '', '100')]
    );
    setErrors([]);
  }, [q.isSuccess, q.data, semester.end_date]);

  if (q.isError) return <LoadError error={q.error} what="the installment plan" onRetry={() => q.refetch()} />;
  if (!rows) return <Skeleton className="h-40" />;

  const totalCents = rows.reduce((sum, r) => sum + (toCents(r.percent) ?? BigInt(0)), BigInt(0));
  const totalText = formatPercent(centsToDecimal(totalCents));
  const adds = totalCents === BigInt(10000);

  const update = (key: number, patch: Partial<PlanRow>) =>
    setRows((prev) => (prev ?? []).map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const onSave = async () => {
    const problems: string[] = [];
    const dates = new Set<string>();
    rows.forEach((r, i) => {
      const n = i + 1;
      if (!r.due_date) problems.push(`Installment ${n}: choose a due date.`);
      else if (dates.has(r.due_date)) problems.push(`Installment ${n}: two installments can't share a due date.`);
      dates.add(r.due_date);
      if (!AMOUNT_RE.test(r.percent.trim()) || !isPositive(r.percent)) problems.push(`Installment ${n}: enter a percent above 0, e.g. 50.`);
    });
    if (rows.length === 0) problems.push('Add at least one installment.');
    if (!adds) problems.push(`The percents add up to ${totalText}. Make them add up to 100%.`);
    setErrors(problems);
    if (problems.length > 0) return;
    try {
      const sorted = [...rows].sort((a, b) => a.due_date.localeCompare(b.due_date));
      await save.mutateAsync({
        yearId,
        semesterId: semester.id,
        items: sorted.map((r) => ({ due_date: r.due_date, percent: r.percent.trim() })),
      });
      notify.success('Installment plan saved', { description: `${semester.name}: ${sorted.length} installment${sorted.length === 1 ? '' : 's'}.` });
    } catch (error) {
      saveError(error, "Couldn't save the plan. Check the dates and percents and try again.");
    }
  };

  return (
    <section className="grid gap-4">
      <p className="max-w-prose text-sm text-muted-foreground">
        When each share of the {semester.name} bill is due. Families can pay any amount at any time; these dates only
        decide what counts as overdue.
      </p>

      <ol className="grid gap-3">
        {rows.map((r, i) => (
          <li key={r.key} className="grid gap-3 rounded-xl border p-3 sm:grid-cols-[auto_1fr_10rem_auto] sm:items-end">
            <span className="text-sm font-medium text-foreground sm:pb-2">Installment {i + 1}</span>
            <FormField label="Due date">
              <Input
                type="date"
                value={r.due_date}
                disabled={!canEdit}
                min={semester.start_date?.slice(0, 10)}
                onChange={(e) => update(r.key, { due_date: e.target.value })}
                className={inputClassName}
              />
            </FormField>
            <FormField label="Share of the bill (%)">
              <Input
                inputMode="decimal"
                value={r.percent}
                disabled={!canEdit}
                onChange={(e) => update(r.key, { percent: e.target.value })}
                className={inputClassName}
              />
            </FormField>
            {canEdit ? (
              <Button
                type="button"
                variant="ghost"
                className="min-h-11 md:min-h-9"
                disabled={rows.length <= 1}
                onClick={() => setRows((prev) => (prev ?? []).filter((x) => x.key !== r.key))}
                aria-label={`Remove installment ${i + 1}`}
              >
                <Trash2 aria-hidden="true" />
                <span className="sm:sr-only">Remove</span>
              </Button>
            ) : null}
          </li>
        ))}
      </ol>

      <p className={cn('text-sm font-medium', adds ? 'text-green-800' : 'text-amber-900')} aria-live="polite">
        {adds ? 'Adds up to 100%.' : `Adds up to ${totalText}. It needs to be 100%.`}
      </p>

      {errors.length > 0 ? (
        <ul role="alert" className="grid gap-1 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      ) : null}

      {canEdit ? (
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="button" variant="outline" className="min-h-11 md:min-h-9" onClick={() => setRows((prev) => [...(prev ?? []), newRow()])}>
            <CalendarPlus aria-hidden="true" />
            Add installment
          </Button>
          <Button type="button" className="min-h-11 md:min-h-9" onClick={onSave} disabled={save.isPending}>
            {save.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
            Save installment plan
          </Button>
        </div>
      ) : null}
    </section>
  );
}

// ---- Categories ----------------------------------------------------------------------------------

const categorySchema = z.object({
  name: z.string().trim().min(2, 'Enter a name, e.g. Tuition').max(100, 'Keep the name under 100 characters'),
  description: z.string().trim().max(500, 'Keep the description under 500 characters'),
  is_active: z.boolean(),
});
type CategoryValues = z.infer<typeof categorySchema>;

function CategorySheet({
  open,
  onOpenChange,
  category,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: FeeCategory | null;
}) {
  const formId = React.useId();
  const save = useSaveFeeCategory();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CategoryValues>({ resolver: zodResolver(categorySchema) });

  React.useEffect(() => {
    if (open) reset({ name: category?.name ?? '', description: category?.description ?? '', is_active: category?.is_active ?? true });
  }, [open, category, reset]);

  const onSubmit = handleSubmit(async (v) => {
    try {
      await save.mutateAsync({ id: category?.id, input: { name: v.name, description: v.description || null, is_active: v.is_active } });
      notify.success(category ? 'Category saved' : `${v.name} added`);
      onOpenChange(false);
    } catch (error) {
      saveError(error, "Couldn't save this category. Check the name and try again.");
    }
  });

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => !save.isPending && onOpenChange(next)}
      title={category ? 'Edit category' : 'Add category'}
      description="Categories group fees on bills and reports, e.g. Tuition, Registration, Uniform."
      className="sm:max-w-md"
      footer={
        <>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={save.isPending}>
            Cancel
          </Button>
          <Button type="submit" form={formId} disabled={save.isPending}>
            {save.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
            {category ? 'Save category' : 'Add category'}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={onSubmit} noValidate className="grid gap-5">
        <FormField label="Name" error={errors.name?.message} required>
          <Input autoComplete="off" className={inputClassName} {...register('name')} />
        </FormField>
        <FormField label="Description" error={errors.description?.message}>
          <Textarea rows={2} {...register('description')} />
        </FormField>
        <label className="flex min-h-11 items-center gap-3 text-sm">
          <input type="checkbox" className="size-5 accent-primary" {...register('is_active')} />
          In use (new fees can use this category)
        </label>
      </form>
    </Sheet>
  );
}

export function CategoriesPanel({ canEdit }: { canEdit: boolean }) {
  const q = useFeeCategories();
  const remove = useDeleteFeeCategory();
  const [editing, setEditing] = React.useState<FeeCategory | null>(null);
  const [adding, setAdding] = React.useState(false);
  const [deleting, setDeleting] = React.useState<FeeCategory | null>(null);

  const columns = React.useMemo<ColumnDef<FeeCategory>[]>(
    () => [
      {
        id: 'name',
        enableSorting: false,
        header: 'Category',
        cell: ({ row }) => (
          <div>
            <p className="font-medium text-foreground">{row.original.name}</p>
            {row.original.description ? <p className="text-xs text-muted-foreground">{row.original.description}</p> : null}
          </div>
        ),
      },
      {
        id: 'status',
        enableSorting: false,
        header: 'Status',
        cell: ({ row }) =>
          row.original.is_active ? <StatusBadge status="success" label="In use" /> : <StatusBadge status="neutral" label="Not in use" />,
      },
      ...(canEdit
        ? ([
            {
              id: 'actions',
              enableSorting: false,
              header: () => <span className="sr-only">Actions</span>,
              cell: ({ row }) => (
                <div className="flex justify-end">
                  <DropdownMenu
                    label={`Actions for ${row.original.name}`}
                    items={[
                      { label: 'Edit category', icon: Pencil, onSelect: () => setEditing(row.original) },
                      // A category on fees or bills can't be deleted (the server refuses); it can be switched off.
                      ...(row.original.in_use
                        ? []
                        : [{ label: 'Delete category', icon: Trash2, destructive: true, onSelect: () => setDeleting(row.original) }]),
                    ]}
                  />
                </div>
              ),
              meta: { label: 'Actions', className: 'text-right' },
            },
          ] as ColumnDef<FeeCategory>[])
        : []),
    ],
    [canEdit]
  );

  if (q.isError) return <LoadError error={q.error} what="fee categories" onRetry={() => q.refetch()} />;

  return (
    <section className="grid gap-4">
      {canEdit ? (
        <div className="flex justify-end">
          <Button variant="outline" className="min-h-11 md:min-h-9" onClick={() => setAdding(true)}>
            <Plus aria-hidden="true" />
            Add category
          </Button>
        </div>
      ) : null}
      <DataTable
        label="Fee categories"
        columns={columns}
        data={q.data ?? []}
        loading={q.isLoading}
        pageSize={0}
        getRowId={(c) => c.id}
        emptyState={
          <EmptyState
            icon={Tags}
            title="No fee categories yet"
            description="Add categories such as Tuition and Registration, then set the fees for each semester."
            action={canEdit ? <Button onClick={() => setAdding(true)}>Add category</Button> : undefined}
          />
        }
      />
      <CategorySheet
        open={adding || Boolean(editing)}
        onOpenChange={(open) => {
          if (!open) {
            setAdding(false);
            setEditing(null);
          }
        }}
        category={editing}
      />
      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={deleting ? `Delete ${deleting.name}?` : 'Delete category?'}
        description="A category that has fees set can't be deleted; mark it “not in use” instead."
        confirmLabel="Delete category"
        destructive
        loading={remove.isPending}
        onConfirm={async () => {
          if (!deleting) return;
          try {
            await remove.mutateAsync(deleting.id);
            notify.success(`${deleting.name} deleted`);
          } catch (error) {
            saveError(error, "Couldn't delete this category. Check your connection and try again.");
            throw error;
          }
        }}
      />
    </section>
  );
}

// ---- Issue invoices ------------------------------------------------------------------------------

const RESULT_LABELS: Record<string, string> = {
  students: 'Students enrolled',
  invoices_created: 'New bills issued',
  invoices_updated: 'Bills with new fees added',
  lines_added: 'Fee lines added',
  unchanged: 'Bills already up to date',
  skipped_void: 'Skipped: their bill was voided',
  no_schedule: 'Skipped: no fee set for their grade level',
};

function resultLabel(key: string): string {
  if (RESULT_LABELS[key]) return RESULT_LABELS[key];
  const text = key.replace(/_/g, ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function IssueInvoicesSheet({
  open,
  onOpenChange,
  yearId,
  semesters,
  defaultSemesterId,
  grades,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  yearId: string;
  semesters: Semester[];
  defaultSemesterId: string;
  grades: AcademicGrade[];
}) {
  const issue = useIssueInvoices();
  const classes = useYearClasses(open ? yearId : undefined).data ?? [];
  const [semesterId, setSemesterId] = React.useState(defaultSemesterId);
  const [gradeId, setGradeId] = React.useState('');
  const [classId, setClassId] = React.useState('');
  const [result, setResult] = React.useState<IssueInvoicesResult | null>(null);
  const ids = { semester: React.useId(), grade: React.useId(), klass: React.useId() };

  React.useEffect(() => {
    if (open) {
      setSemesterId(defaultSemesterId);
      setGradeId('');
      setClassId('');
      setResult(null);
    }
  }, [open, defaultSemesterId]);

  const classOptions = gradeId ? classes.filter((c) => c.grade_id === gradeId) : classes;
  const semesterName = semesters.find((s) => s.id === semesterId)?.name ?? 'the semester';

  const run = async () => {
    if (!semesterId) return;
    try {
      const r = await issue.mutateAsync({
        academic_year_id: yearId,
        semester_id: semesterId,
        grade_id: gradeId || null,
        class_id: classId || null,
      });
      setResult(r);
      notify.success(`Invoices issued for ${semesterName}`);
    } catch (error) {
      saveError(error, "Couldn't issue invoices. Check that fees are set for this semester and try again.");
    }
  };

  // Skips are listed only when something was skipped.
  const counts = result
    ? Object.entries(result).filter(
        ([k, v]) => typeof v === 'number' && (v > 0 || (k !== 'skipped_void' && k !== 'no_schedule'))
      )
    : [];
  const problems = result?.problems ?? [];

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => !issue.isPending && onOpenChange(next)}
      title="Issue invoices"
      description="Bills every active student for the semester's fees. Running it again only adds fees that aren't on a bill yet."
      className="sm:max-w-md"
      footer={
        result ? (
          <Button type="button" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        ) : (
          <>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={issue.isPending}>
              Cancel
            </Button>
            <Button type="button" onClick={run} disabled={!semesterId || issue.isPending}>
              {issue.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
              Issue invoices
            </Button>
          </>
        )
      }
    >
      {result ? (
        <div className="grid gap-4" role="status">
          <p className="flex items-center gap-2 font-medium text-foreground">
            <CheckCircle2 className="size-5 text-green-700" aria-hidden="true" />
            Done for {semesterName}.
          </p>
          {counts.length > 0 ? (
            <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 text-sm">
              {counts.map(([k, v]) => (
                <React.Fragment key={k}>
                  <dt className="text-muted-foreground">{resultLabel(k)}</dt>
                  <dd className="text-right font-medium tabular-nums">{Number(v).toLocaleString('en-US')}</dd>
                </React.Fragment>
              ))}
            </dl>
          ) : null}
          {problems.length > 0 ? (
            <div className="grid gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
              <p className="font-medium">
                {problems.length === 1 ? '1 student needs a look' : `${problems.length} students need a look`}
              </p>
              <ul className="grid gap-1">
                {problems.map((p, i) => (
                  <li key={`${p.student_id}-${i}`}>
                    {p.student_name ? <span className="font-medium">{p.student_name}: </span> : null}
                    {p.detail}
                  </li>
                ))}
              </ul>
              <p>Add the missing amount to the fee, then issue invoices again.</p>
            </div>
          ) : null}
          <p className="text-sm text-muted-foreground">Students&apos; balances are on the Student accounts page.</p>
        </div>
      ) : (
        <div className="grid gap-5">
          <div className="grid gap-2">
            <label htmlFor={ids.semester} className="text-sm font-medium">
              Semester <span className="text-destructive" aria-hidden="true">*</span>
            </label>
            <select id={ids.semester} className={nativeSelectClassName} value={semesterId} onChange={(e) => setSemesterId(e.target.value)}>
              <option value="">Choose</option>
              {semesters.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {s.start_date ? ` (from ${formatDate(s.start_date)})` : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-2">
            <label htmlFor={ids.grade} className="text-sm font-medium">
              Grade level
            </label>
            <select
              id={ids.grade}
              className={nativeSelectClassName}
              value={gradeId}
              onChange={(e) => {
                setGradeId(e.target.value);
                setClassId('');
              }}
            >
              <option value="">All grade levels</option>
              {grades.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-2">
            <label htmlFor={ids.klass} className="text-sm font-medium">
              Class
            </label>
            <select id={ids.klass} className={nativeSelectClassName} value={classId} onChange={(e) => setClassId(e.target.value)}>
              <option value="">All classes</option>
              {classOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {classLabel(c)}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
    </Sheet>
  );
}
