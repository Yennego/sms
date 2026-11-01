'use client';

import { Check } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { YearSetup } from '@/services/api/year-setup-service';
import { STEPS, completedCount, type StepKey } from './steps';

export interface StepNavProps {
  data: YearSetup;
  current: StepKey | 'done';
  onSelect: (step: StepKey | 'done') => void;
}

/** Progress indicator: five steps, each one a button. Done steps show a tick and the word "Done". */
export function StepNav({ data, current, onSelect }: StepNavProps) {
  const done = completedCount(data);
  const allDone = done === STEPS.length;
  return (
    <nav aria-label="Setup steps" className="space-y-3">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="font-medium text-foreground">
          {allDone ? 'All 5 steps done' : `${done} of ${STEPS.length} steps done`}
        </span>
        {allDone ? (
          <button
            type="button"
            onClick={() => onSelect('done')}
            className="min-h-11 rounded-md px-2 font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            See summary
          </button>
        ) : null}
      </div>
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={STEPS.length}
        aria-valuenow={done}
        aria-label="Setup progress"
      >
        <div className="h-full bg-primary transition-all" style={{ width: `${(done / STEPS.length) * 100}%` }} />
      </div>
      <ol className="grid grid-cols-5 gap-1 sm:gap-2">
        {STEPS.map((step, i) => {
          const complete = data.steps[step.key].complete;
          const active = current === step.key;
          return (
            <li key={step.key} className="min-w-0">
              <button
                type="button"
                onClick={() => onSelect(step.key)}
                aria-current={active ? 'step' : undefined}
                className={cn(
                  'flex min-h-11 w-full min-w-0 flex-col items-center gap-1 rounded-lg border px-1 py-2 text-center text-xs outline-none transition-colors sm:flex-row sm:gap-2 sm:px-3 sm:text-left sm:text-sm',
                  'focus-visible:ring-[3px] focus-visible:ring-ring/50',
                  active ? 'border-primary bg-primary/5 text-foreground' : 'border-border text-muted-foreground hover:bg-accent',
                )}
              >
                <span
                  className={cn(
                    'flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold',
                    complete ? 'border-green-600 bg-green-600 text-white' : active ? 'border-primary text-primary' : 'border-border',
                  )}
                  aria-hidden="true"
                >
                  {complete ? <Check className="size-4" /> : i + 1}
                </span>
                <span className="min-w-0 truncate">
                  <span className="lg:hidden">{step.short}</span>
                  <span className="hidden lg:inline">{step.title}</span>
                  <span className="sr-only">{complete ? ', done' : ', not done'}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
