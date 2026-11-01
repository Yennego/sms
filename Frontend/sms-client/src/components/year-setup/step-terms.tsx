'use client';

import * as React from 'react';
import Link from 'next/link';
import { CalendarDays, Loader2, Pencil } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Sheet } from '@/components/ui/sheet';
import { notify } from '@/components/ui/toaster';
import type { YearSetup, YearSetupPeriod } from '@/services/api/year-setup-service';
import { errorText, formatDate, type YearSetupMutations } from './use-year-setup';

interface Editing {
  kind: 'semester' | 'period';
  item: YearSetupPeriod;
}

export interface StepTermsProps {
  data: YearSetup;
  mutations: YearSetupMutations;
  school: string;
}

export function StepTerms({ data, mutations, school }: StepTermsProps) {
  const { semesters } = data.steps.terms;
  const [editing, setEditing] = React.useState<Editing | null>(null);
  const { createDefaultTerms } = mutations;

  const addDefault = async () => {
    try {
      await createDefaultTerms.mutateAsync(undefined);
      notify.success('Added 2 semesters with 3 periods each.');
    } catch (err) {
      notify.error(errorText(err, 'The semesters were not added.'));
    }
  };

  if (semesters.length === 0) {
    return (
      <EmptyState
        icon={CalendarDays}
        title="No semesters yet"
        description={`Add 2 semesters with 3 periods each, spread evenly from ${formatDate(data.year.start_date)} to ${formatDate(data.year.end_date)}. You can change the dates afterwards.`}
        action={
          <Button onClick={addDefault} disabled={createDefaultTerms.isPending}>
            {createDefaultTerms.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
            Add 2 semesters × 3 periods
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      {semesters.map((sem) => (
        <section key={sem.id} className="rounded-xl border" aria-labelledby={`sem-${sem.id}`}>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b p-4">
            <div className="min-w-0">
              <h3 id={`sem-${sem.id}`} className="font-semibold">{sem.name}</h3>
              <p className="text-sm text-muted-foreground">
                {formatDate(sem.start_date)} to {formatDate(sem.end_date)}
              </p>
            </div>
            <Button variant="outline" className="min-h-11 md:min-h-9" onClick={() => setEditing({ kind: 'semester', item: sem })}>
              <Pencil aria-hidden="true" />
              Change dates
              <span className="sr-only"> for {sem.name}</span>
            </Button>
          </div>
          {sem.periods.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">
              No periods in this semester.{' '}
              <Link href={`/${school}/academics/semesters`} className="font-medium text-primary underline-offset-4 hover:underline">
                Add periods on the Semesters page
              </Link>
            </p>
          ) : (
            <ul className="divide-y">
              {sem.periods.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{p.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatDate(p.start_date)} to {formatDate(p.end_date)}
                    </p>
                  </div>
                  <Button variant="ghost" className="min-h-11 md:min-h-9" onClick={() => setEditing({ kind: 'period', item: p })}>
                    <Pencil aria-hidden="true" />
                    Change dates
                    <span className="sr-only"> for {p.name}</span>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
      <p className="text-sm text-muted-foreground">
        To add, rename or remove semesters and periods, use the{' '}
        <Link href={`/${school}/academics/semesters`} className="font-medium text-primary underline-offset-4 hover:underline">
          Semesters page
        </Link>
        .
      </p>
      <EditDatesSheet editing={editing} onClose={() => setEditing(null)} mutations={mutations} />
    </div>
  );
}

function EditDatesSheet({
  editing,
  onClose,
  mutations,
}: {
  editing: Editing | null;
  onClose: () => void;
  mutations: YearSetupMutations;
}) {
  const [start, setStart] = React.useState('');
  const [end, setEnd] = React.useState('');
  const [error, setError] = React.useState<string | undefined>();
  const { updateTermDates } = mutations;

  React.useEffect(() => {
    if (editing) {
      setStart(editing.item.start_date ?? '');
      setEnd(editing.item.end_date ?? '');
      setError(undefined);
    }
  }, [editing]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    if (!start || !end) return setError('Enter both dates.');
    if (end <= start) return setError('Enter an end date after the start date.');
    try {
      await updateTermDates.mutateAsync({ kind: editing.kind, id: editing.item.id, start_date: start, end_date: end });
      notify.success(`Dates for ${editing.item.name} saved.`);
      onClose();
    } catch (err) {
      notify.error(errorText(err, 'The dates were not saved.'));
    }
  };

  return (
    <Sheet
      open={Boolean(editing)}
      onOpenChange={(o) => (!o ? onClose() : undefined)}
      title={editing ? `Dates for ${editing.item.name}` : 'Dates'}
      description="Changing these dates doesn't move the other semesters or periods."
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" className="min-h-11" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="term-dates-form" className="min-h-11" disabled={updateTermDates.isPending}>
            {updateTermDates.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
            Save dates
          </Button>
        </div>
      }
    >
      <form id="term-dates-form" onSubmit={save} className="grid gap-4" noValidate>
        <FormField label="Start date" required>
          <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="h-11" />
        </FormField>
        <FormField label="End date" error={error} required>
          <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="h-11" />
        </FormField>
      </form>
    </Sheet>
  );
}
