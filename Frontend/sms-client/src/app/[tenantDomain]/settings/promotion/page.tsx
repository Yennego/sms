'use client';

// Promotion rules: what a student needs to move up, per grade level and school year
// (promotion_criteria, used by Students → Promotion). Without rules of its own a grade level uses the
// school's pass mark (Grading settings): any failed subject means Conditional (remedial work).

import * as React from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ListChecks, Loader2, Lock, Pencil } from 'lucide-react';

import { useGradeLevels, useSchoolYears, useSubjects } from '@/components/classes/queries';
import { useGradingSettings } from '@/components/report-cards/queries';
import { selectClass } from '@/components/students/admission-form';
import { errorMessage } from '@/components/students/format';
import { useSchoolKey } from '@/components/students/queries';
import PermissionGuard from '@/components/auth/permission-guard';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { DataTable } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { PageShell } from '@/components/ui/page-shell';
import { Sheet } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/ui/status-badge';
import { Switch } from '@/components/ui/switch';
import { notify } from '@/components/ui/toaster';
import { usePromotionService, type PromotionCriteria } from '@/services/api/promotion-service';
import type { AcademicGrade } from '@/types/academic-grade';

const inputClass = 'h-11 text-base md:h-9 md:text-sm';

const rulesKey = (school: string | null, yearId: string) => ['promotion-rules', school, yearId] as const;

function usePromotionRules(yearId: string) {
  const { listCriteria } = usePromotionService();
  const school = useSchoolKey();
  return useQuery({
    queryKey: rulesKey(school, yearId),
    queryFn: () => listCriteria(yearId),
    enabled: Boolean(school && yearId),
  });
}

function useSaveRules(yearId: string) {
  const { setCriteria, deleteCriteria } = usePromotionService();
  const school = useSchoolKey();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { rules?: PromotionCriteria; removeId?: string }) => {
      if (vars.removeId) await deleteCriteria(vars.removeId);
      else if (vars.rules) await setCriteria(vars.rules);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: rulesKey(school, yearId) }),
  });
}

/** Attendance's share of the overall score shown in Promotion (decisions use the subjects passed). */
function attendanceShare(rules?: PromotionCriteria | null): number {
  if (!rules || rules.aggregate_method !== 'weighted' || !rules.weighting_schema) return 0;
  const total = Object.values(rules.weighting_schema).reduce((a, b) => a + Number(b), 0);
  return total > 0 ? Math.round((Number(rules.weighting_schema.attendance ?? 0) / total) * 100) : 0;
}

interface Row {
  grade: AcademicGrade;
  rules: PromotionCriteria | null;
}

interface Draft {
  passMark: string;
  minPassed: string;
  requireCore: boolean;
  coreIds: string[];
  attendance: string;
}

function RulesSheet({
  row,
  yearId,
  schoolPassMark,
  onClose,
}: {
  row: Row | null;
  yearId: string;
  schoolPassMark: number;
  onClose: () => void;
}) {
  const subjects = useSubjects();
  const save = useSaveRules(yearId);
  const [draft, setDraft] = React.useState<Draft | null>(null);
  const [errors, setErrors] = React.useState<Partial<Record<keyof Draft, string>>>({});

  React.useEffect(() => {
    if (!row) return;
    setErrors({});
    setDraft({
      passMark: String(row.rules?.passing_mark ?? schoolPassMark),
      minPassed: row.rules?.min_passed_subjects != null ? String(row.rules.min_passed_subjects) : '',
      requireCore: row.rules?.require_core_pass ?? true,
      coreIds: (row.rules?.core_subject_ids ?? []).map(String),
      attendance: String(attendanceShare(row.rules)),
    });
  }, [row, schoolPassMark]);

  const onSave = async () => {
    if (!row || !draft) return;
    const next: typeof errors = {};
    const pass = Number(draft.passMark);
    if (!Number.isInteger(pass) || pass < 0 || pass > 100) next.passMark = 'Enter a whole number from 0 to 100.';
    const min = draft.minPassed.trim() === '' ? null : Number(draft.minPassed);
    if (min !== null && (!Number.isInteger(min) || min < 0)) next.minPassed = 'Enter a whole number, or leave it empty.';
    const att = Number(draft.attendance || 0);
    if (!Number.isInteger(att) || att < 0 || att > 100) next.attendance = 'Enter a whole number from 0 to 100.';
    setErrors(next);
    if (Object.keys(next).length) return;
    try {
      await save.mutateAsync({
        rules: {
          academic_year_id: yearId,
          grade_id: row.grade.id,
          passing_mark: pass,
          min_passed_subjects: min as number,
          require_core_pass: draft.requireCore,
          core_subject_ids: draft.coreIds,
          aggregate_method: att > 0 ? 'weighted' : 'average',
          weighting_schema: att > 0 ? { subjects: 100 - att, attendance: att } : undefined,
        },
      });
      notify.success(`Promotion rules saved for ${row.grade.name}.`);
      onClose();
    } catch (err) {
      notify.error(errorMessage(err, "The rules weren't saved. Try again."));
    }
  };

  const list = (subjects.data ?? []).filter((s) => s.is_active !== false);
  return (
    <Sheet
      open={Boolean(row)}
      onOpenChange={(open) => !open && onClose()}
      title={`Promotion rules: ${row?.grade.name ?? ''}`}
      description="A subject is passed when its yearly average reaches the pass mark. Any failed subject means remedial work (Conditional); the rules below decide when a student repeats instead."
      className="sm:max-w-lg"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" className="min-h-11 md:min-h-9" onClick={onClose} disabled={save.isPending}>
            Cancel
          </Button>
          <Button className="min-h-11 md:min-h-9" onClick={onSave} disabled={save.isPending || !draft}>
            {save.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
            Save rules
          </Button>
        </div>
      }
    >
        {draft ? (
          <div className="grid gap-4">
            <FormField label="Pass mark" required error={errors.passMark} description={`The school's pass mark is ${schoolPassMark}.`}>
              <Input
                type="number"
                inputMode="numeric"
                className={inputClass}
                value={draft.passMark}
                onChange={(e) => setDraft({ ...draft, passMark: e.target.value })}
              />
            </FormField>
            <FormField
              label="Repeat if fewer subjects passed than"
              error={errors.minPassed}
              description="Leave empty for no minimum."
            >
              <Input
                type="number"
                inputMode="numeric"
                className={inputClass}
                value={draft.minPassed}
                onChange={(e) => setDraft({ ...draft, minPassed: e.target.value })}
              />
            </FormField>
            <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
              <label htmlFor="require-core" className="text-sm font-medium">
                Repeat if a core subject is failed
              </label>
              <Switch
                id="require-core"
                checked={draft.requireCore}
                onCheckedChange={(on) => setDraft({ ...draft, requireCore: on })}
              />
            </div>
            <fieldset className="space-y-2" disabled={!draft.requireCore}>
              <legend className="text-sm font-medium">Core subjects</legend>
              {subjects.isLoading ? (
                <Skeleton className="h-24 w-full" />
              ) : list.length === 0 ? (
                <p className="text-sm text-muted-foreground">No subjects yet. Add them under Classes → Subjects.</p>
              ) : (
                <ul className="grid gap-1 sm:grid-cols-2">
                  {list.map((s) => {
                    const id = String(s.id);
                    const on = draft.coreIds.includes(id);
                    return (
                      <li key={id}>
                        <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md px-2 hover:bg-muted md:min-h-9">
                          <input
                            type="checkbox"
                            className="size-4"
                            checked={on}
                            onChange={() =>
                              setDraft({
                                ...draft,
                                coreIds: on ? draft.coreIds.filter((x) => x !== id) : [...draft.coreIds, id],
                              })
                            }
                          />
                          <span className="text-sm">{s.name}</span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
            </fieldset>
            <FormField
              label="Attendance in the overall score (%)"
              error={errors.attendance}
              description="Only changes the score shown in Promotion; decisions use the subjects passed. 0 leaves attendance out."
            >
              <Input
                type="number"
                inputMode="numeric"
                className={inputClass}
                value={draft.attendance}
                onChange={(e) => setDraft({ ...draft, attendance: e.target.value })}
              />
            </FormField>
          </div>
        ) : null}
    </Sheet>
  );
}

function PromotionRules() {
  const { years, current, isLoading: yearsLoading } = useSchoolYears();
  const [pickedYear, setPickedYear] = React.useState('');
  const yearId = pickedYear || current?.id || '';
  const grades = useGradeLevels();
  const rules = usePromotionRules(yearId);
  const subjects = useSubjects();
  const grading = useGradingSettings();
  const save = useSaveRules(yearId);
  const schoolPassMark = grading.data?.pass_mark ?? 70;
  const [editing, setEditing] = React.useState<Row | null>(null);
  const [resetting, setResetting] = React.useState<Row | null>(null);

  const subjectName = React.useMemo(
    () => new Map((subjects.data ?? []).map((s) => [String(s.id), s.name])),
    [subjects.data]
  );
  const rows = React.useMemo<Row[]>(
    () =>
      (grades.data ?? []).map((grade) => ({
        grade,
        rules: (rules.data ?? []).find((r) => String(r.grade_id) === String(grade.id)) ?? null,
      })),
    [grades.data, rules.data]
  );

  const columns = React.useMemo<ColumnDef<Row>[]>(
    () => [
      {
        id: 'grade',
        accessorFn: (r) => r.grade.sequence,
        header: 'Grade level',
        cell: ({ row }) => (
          <div className="flex flex-col gap-1">
            <span className="font-medium">{row.original.grade.name}</span>
            {row.original.rules ? null : <StatusBadge status="neutral" label="School defaults" />}
          </div>
        ),
      },
      {
        id: 'pass',
        header: 'Pass mark',
        enableSorting: false,
        cell: ({ row }) => row.original.rules?.passing_mark ?? schoolPassMark,
      },
      {
        id: 'min',
        header: 'Repeat if fewer passed than',
        enableSorting: false,
        cell: ({ row }) => row.original.rules?.min_passed_subjects ?? '–',
      },
      {
        id: 'core',
        header: 'Core subjects',
        enableSorting: false,
        cell: ({ row }) => {
          const r = row.original.rules;
          const ids = (r?.core_subject_ids ?? []).map(String);
          if (!r?.require_core_pass || ids.length === 0) return '–';
          return ids.map((id) => subjectName.get(id) ?? 'Removed subject').join(', ');
        },
      },
      {
        id: 'attendance',
        header: 'Attendance in score',
        enableSorting: false,
        meta: { hideOnMobile: true },
        cell: ({ row }) => `${attendanceShare(row.original.rules)}%`,
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        meta: { label: 'Actions', className: 'text-right' },
        cell: ({ row }) => (
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" size="sm" className="min-h-11 md:min-h-9" onClick={() => setEditing(row.original)}>
              <Pencil aria-hidden="true" />
              Edit rules
            </Button>
            {row.original.rules?.id ? (
              <Button variant="ghost" size="sm" className="min-h-11 md:min-h-9" onClick={() => setResetting(row.original)}>
                Use school defaults
              </Button>
            ) : null}
          </div>
        ),
      },
    ],
    [schoolPassMark, subjectName]
  );

  const yearName = years.find((y) => y.id === yearId)?.name;
  return (
    <PageShell
      title="Promotion rules"
      description="What a student needs to move up to the next grade level. Any failed subject means remedial work; these rules decide when a student repeats."
    >
      <div className="grid gap-2 sm:max-w-xs">
        <label htmlFor="rules-year" className="text-sm font-medium">
          School year
        </label>
        <select
          id="rules-year"
          className={selectClass}
          value={yearId}
          onChange={(e) => setPickedYear(e.target.value)}
          disabled={yearsLoading}
        >
          {years.map((y) => (
            <option key={y.id} value={y.id}>
              {y.name}
              {y.is_current ? ' (current)' : ''}
            </option>
          ))}
        </select>
      </div>

      {!yearsLoading && years.length === 0 ? (
        <EmptyState icon={ListChecks} description="There is no school year yet. Create one under Classes → Years and terms." />
      ) : rules.isError || grades.isError ? (
        <EmptyState
          icon={ListChecks}
          title="The rules didn't load"
          description={`${errorMessage(rules.error ?? grades.error, 'The server didn’t answer.')} Check your connection and try again.`}
          action={
            <Button
              onClick={() => {
                rules.refetch();
                grades.refetch();
              }}
            >
              Try again
            </Button>
          }
        />
      ) : (
        <DataTable
          label={`Promotion rules${yearName ? ` for ${yearName}` : ''}`}
          columns={columns}
          data={rows}
          loading={grades.isLoading || rules.isLoading}
          pageSize={0}
          getRowId={(r) => r.grade.id}
          initialSorting={[{ id: 'grade', desc: false }]}
          emptyState={<EmptyState icon={ListChecks} description="No grade levels yet. Add them under Classes → Grade levels." />}
        />
      )}

      <RulesSheet row={editing} yearId={yearId} schoolPassMark={schoolPassMark} onClose={() => setEditing(null)} />
      <ConfirmDialog
        open={Boolean(resetting)}
        onOpenChange={(open) => !open && setResetting(null)}
        title={`Use the school defaults for ${resetting?.grade.name ?? 'this grade level'}?`}
        description={`Its own rules are removed: the school's pass mark (${schoolPassMark}) applies, with no minimum and no core subjects.`}
        confirmLabel="Use school defaults"
        loading={save.isPending}
        onConfirm={async () => {
          if (!resetting?.rules?.id) return;
          try {
            await save.mutateAsync({ removeId: resetting.rules.id });
            notify.success(`${resetting.grade.name} uses the school defaults.`);
          } catch (err) {
            notify.error(errorMessage(err, "The rules weren't removed. Try again."));
            throw err;
          }
        }}
      />
    </PageShell>
  );
}

export default function PromotionRulesPage() {
  return (
    // The admin and the principal (manage_academic_year, like the server's criteria changes)
    <PermissionGuard
      requiredPermissions={['manage_academic_year']}
      fallback={
        <PageShell title="Promotion rules">
          <EmptyState icon={Lock} description="Only staff who run promotion can change these rules." />
        </PageShell>
      }
    >
      <PromotionRules />
    </PermissionGuard>
  );
}
