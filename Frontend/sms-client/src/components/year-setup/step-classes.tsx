'use client';

import * as React from 'react';
import Link from 'next/link';
import { Loader2, School, UserPlus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { StatusBadge } from '@/components/ui/status-badge';
import { notify } from '@/components/ui/toaster';
import type { YearSetup } from '@/services/api/year-setup-service';
import { errorText, plural, useTeacherOptions, type YearSetupMutations } from './use-year-setup';
import { TeacherSelect } from './teacher-select';

export interface StepClassesProps {
  data: YearSetup;
  mutations: YearSetupMutations;
  school: string;
  onGoToLevels: () => void;
}

export function StepClasses({ data, mutations, school, onGoToLevels }: StepClassesProps) {
  const { classes, missing } = data.steps.classes;
  const teachersQuery = useTeacherOptions();
  const teachers = teachersQuery.data ?? [];
  const [savingId, setSavingId] = React.useState<string | null>(null);
  const { generateClasses, setSponsor } = mutations;
  const hasSections = data.steps.levels.levels.some((l) => l.sections.length > 0);
  const withoutSponsor = classes.filter((c) => !c.sponsor_id).length;
  const [seats, setSeats] = React.useState('30');
  const [seatsError, setSeatsError] = React.useState<string>();

  const generate = async () => {
    const capacity = Number(seats);
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > 500) {
      setSeatsError('Enter the number of seats, from 1 to 500.');
      return;
    }
    setSeatsError(undefined);
    try {
      await generateClasses.mutateAsync(capacity);
      notify.success(`Created ${plural(missing.length, 'class', 'classes')}.`);
    } catch (err) {
      notify.error(errorText(err, 'The classes were not created.'));
    }
  };

  const saveSponsor = async (classId: string, className: string, teacherId: string | null) => {
    setSavingId(classId);
    try {
      await setSponsor.mutateAsync({ classId, teacherId });
      notify.success(teacherId ? `Sponsor saved for ${className}.` : `${className} has no sponsor now.`);
    } catch (err) {
      notify.error(errorText(err, `The sponsor for ${className} was not saved.`));
    } finally {
      setSavingId(null);
    }
  };

  if (!hasSections && classes.length === 0) {
    return (
      <EmptyState
        icon={School}
        title="No sections yet"
        description="Classes are made from grade levels and their sections. Add sections first."
        action={<Button onClick={onGoToLevels}>Add levels and sections</Button>}
      />
    );
  }

  return (
    <div className="space-y-4">
      {missing.length > 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-medium text-amber-900">
            {plural(missing.length, 'class', 'classes')} missing for this year
          </p>
          <p className="mt-1 text-sm text-amber-900">
            {missing.slice(0, 8).map((m) => `${m.grade_name} - ${m.section_name}`).join(', ')}
            {missing.length > 8 ? ` and ${missing.length - 8} more` : ''}
          </p>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
            <FormField label="Seats in each class" error={seatsError} required>
              <Input
                type="number"
                inputMode="numeric"
                min={1}
                max={500}
                value={seats}
                onChange={(e) => setSeats(e.target.value)}
                className="h-11 bg-background sm:w-32"
              />
            </FormField>
            <Button className="min-h-11 w-full sm:w-auto" onClick={generate} disabled={generateClasses.isPending}>
              {generateClasses.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
              Create {plural(missing.length, 'class', 'classes')}
            </Button>
          </div>
          <p className="mt-2 text-sm text-amber-900">You can change the seats of any class later under Classes → Classes.</p>
        </div>
      ) : null}

      {classes.length > 0 ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              {withoutSponsor === 0
                ? 'Every class has a sponsor.'
                : `${plural(withoutSponsor, 'class', 'classes')} still need a sponsor.`}
            </p>
            <Link
              href={`/${school}/teachers/new`}
              className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              <UserPlus className="size-4" aria-hidden="true" />
              Add a teacher
            </Link>
          </div>
          {teachersQuery.isError ? (
            <p role="alert" className="text-sm text-destructive">
              {errorText(teachersQuery.error, 'The teacher list did not load.')}{' '}
              <button type="button" className="min-h-11 font-medium underline" onClick={() => teachersQuery.refetch()}>
                Try again
              </button>
            </p>
          ) : null}
          <ul className="divide-y rounded-xl border">
            {classes.map((c) => (
              <li key={c.id} className="grid gap-2 p-4 sm:grid-cols-[1fr_minmax(0,18rem)] sm:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{c.name}</span>
                    {c.sponsor_id ? null : <StatusBadge status="pending" label="No sponsor" />}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {c.enrolled} of {c.capacity} seats filled
                  </p>
                </div>
                <TeacherSelect
                  teachers={teachers}
                  value={c.sponsor_id}
                  currentName={c.sponsor_name}
                  label={`Sponsor for ${c.name}`}
                  placeholder={teachersQuery.isLoading ? 'Loading teachers…' : 'Choose a sponsor'}
                  disabled={teachersQuery.isLoading}
                  saving={savingId === c.id}
                  onChange={(id) => saveSponsor(c.id, c.name, id)}
                />
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}
