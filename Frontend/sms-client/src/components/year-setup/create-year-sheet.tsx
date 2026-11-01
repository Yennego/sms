'use client';

import * as React from 'react';
import { Loader2 } from 'lucide-react';

import { Sheet } from '@/components/ui/sheet';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { notify } from '@/components/ui/toaster';
import { useCreateAcademicYear } from '@/hooks/queries/academic-years';
import type { AcademicYear } from '@/types/enrollment';
import { errorText } from './use-year-setup';

export interface CreateYearSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with the new year so the wizard can switch to it. */
  onCreated: (year: AcademicYear) => void;
  /** Suggest dates after the latest existing year. */
  latestEndDate?: string;
  /** First year for this school: make it current by default. */
  isFirst?: boolean;
}

function suggestDates(latestEndDate?: string) {
  const today = new Date();
  let startYear = today.getMonth() >= 6 ? today.getFullYear() : today.getFullYear() - 1;
  if (latestEndDate) {
    const end = new Date(latestEndDate);
    if (!Number.isNaN(end.getTime())) startYear = Math.max(startYear, end.getFullYear());
  }
  return {
    name: `${startYear}/${startYear + 1}`,
    start: `${startYear}-09-01`,
    end: `${startYear + 1}-07-15`,
  };
}

export function CreateYearSheet({ open, onOpenChange, onCreated, latestEndDate, isFirst = false }: CreateYearSheetProps) {
  const create = useCreateAcademicYear();
  const [name, setName] = React.useState('');
  const [start, setStart] = React.useState('');
  const [end, setEnd] = React.useState('');
  const [makeCurrent, setMakeCurrent] = React.useState(isFirst);
  const [errors, setErrors] = React.useState<{ name?: string; end?: string; start?: string }>({});

  React.useEffect(() => {
    if (!open) return;
    const s = suggestDates(latestEndDate);
    setName(s.name);
    setStart(s.start);
    setEnd(s.end);
    setMakeCurrent(isFirst);
    setErrors({});
  }, [open, latestEndDate, isFirst]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    if (!name.trim()) next.name = 'Enter a name, for example 2026/2027.';
    if (!start) next.start = 'Enter the first day of the school year.';
    if (!end) next.end = 'Enter the last day of the school year.';
    else if (start && end <= start) next.end = 'Enter an end date after the start date.';
    setErrors(next);
    if (Object.keys(next).length) return;
    try {
      const year = await create.mutateAsync({ name: name.trim(), start_date: start, end_date: end, is_current: makeCurrent });
      notify.success(`School year ${year.name} created.`);
      onCreated(year);
      onOpenChange(false);
    } catch (err) {
      notify.error(errorText(err, 'The school year was not created.'));
    }
  };

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Create a school year"
      description="Name it and set its first and last day. You can add terms, classes and subjects next."
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" className="min-h-11" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="create-year-form" className="min-h-11" disabled={create.isPending}>
            {create.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
            Create school year
          </Button>
        </div>
      }
    >
      <form id="create-year-form" onSubmit={submit} className="grid gap-4" noValidate>
        <FormField label="Name" error={errors.name} required>
          <Input value={name} onChange={(e) => setName(e.target.value)} className="h-11" placeholder="2026/2027" />
        </FormField>
        <FormField label="First day" error={errors.start} required>
          <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="h-11" />
        </FormField>
        <FormField label="Last day" error={errors.end} required>
          <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="h-11" />
        </FormField>
        <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={makeCurrent}
            onChange={(e) => setMakeCurrent(e.target.checked)}
            className="size-5 accent-primary"
          />
          Make this the current school year
        </label>
      </form>
    </Sheet>
  );
}
