'use client';

import * as React from 'react';
import { CheckCircle2, Copy, Loader2, X } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { notify } from '@/components/ui/toaster';
import type { CopyFromOptions, CopyFromResult } from '@/services/api/year-setup-service';
import { errorText, plural, type YearSetupMutations } from './use-year-setup';

const OPTIONS: { key: keyof CopyFromOptions; label: string; hint: string }[] = [
  { key: 'terms', label: 'Semesters and periods', hint: 'Dates move forward by the gap between the two years.' },
  { key: 'classes', label: 'Classes', hint: 'One class for each class last year (same level and section).' },
  { key: 'sponsors', label: 'Class sponsors', hint: 'The same sponsor as last year.' },
  { key: 'subjects', label: 'Subjects and their teachers', hint: 'The same subjects and teachers per class.' },
];

export function summarizeCopy(r: CopyFromResult): string {
  const parts = [
    r.semesters ? plural(r.semesters, 'semester') : null,
    r.periods ? plural(r.periods, 'period') : null,
    r.classes ? plural(r.classes, 'class', 'classes') : null,
    r.sponsors ? plural(r.sponsors, 'sponsor') : null,
    r.class_subjects ? plural(r.class_subjects, 'class subject') : null,
  ].filter(Boolean);
  return parts.length ? parts.join(', ') : 'nothing new (this year already had everything you chose)';
}

export interface CopyFromPanelProps {
  previousYear: { id: string; name: string };
  yearName: string;
  mutations: YearSetupMutations;
}

/** "Copy from <previous year>": copies only what this year doesn't have yet, never overwrites. */
export function CopyFromPanel({ previousYear, yearName, mutations }: CopyFromPanelProps) {
  const [options, setOptions] = React.useState<CopyFromOptions>({ terms: true, classes: true, sponsors: true, subjects: true });
  const [result, setResult] = React.useState<CopyFromResult | null>(null);
  const [open, setOpen] = React.useState(false);
  const { copyFrom } = mutations;
  const nothingChosen = !Object.values(options).some(Boolean);

  const run = async () => {
    try {
      const r = await copyFrom.mutateAsync({ sourceYearId: previousYear.id, options });
      setResult(r);
      setOpen(false);
      notify.success(`Copied from ${previousYear.name}.`);
    } catch (err) {
      notify.error(errorText(err, `Nothing was copied from ${previousYear.name}.`));
    }
  };

  if (result) {
    return (
      <div role="status" className="flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-900">
        <CheckCircle2 className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
        <p className="min-w-0 flex-1">
          Copied from {previousYear.name} into {yearName}: {summarizeCopy(result)}. Check each step below and fill in what is still missing.
        </p>
        <button
          type="button"
          onClick={() => setResult(null)}
          className="-m-2 flex size-11 shrink-0 items-center justify-center rounded-md hover:bg-green-100 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          aria-label="Close summary"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
    );
  }

  return (
    <Card className="gap-4 py-4">
      <CardHeader className="px-4">
        <CardTitle className="flex items-center gap-2 text-base">
          <Copy className="size-4" aria-hidden="true" />
          Start from {previousYear.name}
        </CardTitle>
        <CardDescription>
          Copy last year&apos;s structure into {yearName}. Only what is missing is added; nothing is overwritten.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 px-4">
        {open ? (
          <>
            <fieldset className="grid gap-1 sm:grid-cols-2">
              <legend className="sr-only">What to copy</legend>
              {OPTIONS.map((o) => (
                <label key={o.key} className="flex min-h-11 cursor-pointer items-start gap-3 rounded-md p-2 hover:bg-accent">
                  <input
                    type="checkbox"
                    checked={options[o.key]}
                    onChange={(e) => setOptions((prev) => ({ ...prev, [o.key]: e.target.checked }))}
                    className="mt-0.5 size-5 shrink-0 accent-primary"
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{o.label}</span>
                    <span className="block text-xs text-muted-foreground">{o.hint}</span>
                  </span>
                </label>
              ))}
            </fieldset>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" className="min-h-11" onClick={() => setOpen(false)} disabled={copyFrom.isPending}>
                Cancel
              </Button>
              <Button className="min-h-11" onClick={run} disabled={copyFrom.isPending || nothingChosen}>
                {copyFrom.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
                Copy from {previousYear.name}
              </Button>
            </div>
          </>
        ) : (
          <Button variant="outline" className="min-h-11 w-full sm:w-auto" onClick={() => setOpen(true)}>
            Choose what to copy
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
