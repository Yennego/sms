'use client';

// The school's pass mark (GET / PUT /academics/gradebook/settings). A subject is passed when its
// yearly average is at least the pass mark; report cards mark grades below it.
import * as React from 'react';
import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { notify } from '@/components/ui/toaster';
import { errorMessage } from '@/components/students/format';
import { useGradingSettings, useSaveGradingSettings } from './queries';

export function PassMarkCard() {
  const settings = useGradingSettings();
  const save = useSaveGradingSettings();
  const [draft, setDraft] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | undefined>();

  const saved = settings.data?.pass_mark;
  const value = draft ?? (saved !== undefined ? String(saved) : '');

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = Number(value);
    if (value.trim() === '' || !Number.isInteger(n) || n < 0 || n > 100) {
      setError('Enter a whole number from 0 to 100.');
      return;
    }
    setError(undefined);
    try {
      await save.mutateAsync(n);
      setDraft(null);
      notify.success(`Pass mark saved: ${n}.`);
    } catch (err) {
      const status = (err as { statusCode?: number } | null)?.statusCode;
      notify.error(
        status === 403
          ? "You don't have permission to change the pass mark. Ask an administrator."
          : errorMessage(err, "The pass mark wasn't saved. Try again.")
      );
    }
  };

  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle className="text-lg">Pass mark</CardTitle>
        <CardDescription>
          A subject is passed when its yearly average is at least this mark. Report cards mark grades below it,
          and promotion uses it. A grade level&rsquo;s promotion rules can set a different mark.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {settings.isLoading ? (
          <Skeleton className="h-20 w-full max-w-sm" />
        ) : settings.error ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <p className="text-sm text-destructive">
              {errorMessage(settings.error, "The pass mark couldn't be loaded.")}
            </p>
            <Button variant="outline" onClick={() => void settings.refetch()}>
              Try again
            </Button>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-start" noValidate>
            <FormField
              label="Pass mark (0 to 100)"
              error={error}
              required
              className="sm:w-48"
            >
              <Input
                type="number"
                inputMode="numeric"
                min={0}
                max={100}
                step={1}
                value={value}
                onChange={(e) => {
                  setDraft(e.target.value);
                  setError(undefined);
                }}
                className="h-11 md:h-9"
              />
            </FormField>
            <Button
              type="submit"
              className="min-h-11 sm:mt-[1.375rem] md:min-h-9"
              disabled={save.isPending || draft === null || draft === String(saved)}
            >
              {save.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
              Save pass mark
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
