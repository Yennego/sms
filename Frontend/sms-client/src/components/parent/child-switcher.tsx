'use client';

// Child switcher for the parent screens: one big pill per linked child, the choice kept in
// ?child= so a reload or a shared link shows the same child. Hidden when there is only one child.
// Pages using useSelectedChild must render inside <Suspense> (useSearchParams).
import * as React from 'react';
import { UserRound } from 'lucide-react';

import { useUrlParam } from '@/components/results/use-url-param';
import { cn } from '@/lib/utils';
import type { ChildSummary } from '@/types/daily-attendance';

import { useMyChildren } from './queries';

export interface ChildSwitcherProps {
  items: ChildSummary[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
}

export function ChildSwitcher({ items, value, onChange, className }: ChildSwitcherProps) {
  if (items.length <= 1) return null;
  return (
    <div role="group" aria-label="Choose a child" className={cn('flex flex-wrap gap-2', className)}>
      {items.map((c) => {
        const selected = c.student_id === value;
        return (
          <button
            key={c.student_id}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(c.student_id)}
            className={cn(
              'inline-flex min-h-11 max-w-full items-center gap-2 rounded-full border px-4 text-base font-medium outline-none transition-colors',
              'focus-visible:ring-[3px] focus-visible:ring-ring/50',
              selected
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-input bg-background text-foreground hover:bg-accent'
            )}
          >
            <UserRound className="size-4 shrink-0" aria-hidden="true" />
            <span className="truncate">{c.name}</span>
          </button>
        );
      })}
    </div>
  );
}

/** The parent's children and the selected one (?child=, else the first child). */
export function useSelectedChild() {
  const query = useMyChildren();
  const kids = React.useMemo(() => query.data ?? [], [query.data]);
  const [childParam, setChildParam] = useUrlParam('child');
  const childId = kids.some((c) => c.student_id === childParam) ? childParam : (kids[0]?.student_id ?? '');
  const child = kids.find((c) => c.student_id === childId);
  const setChildId = React.useCallback((id: string) => setChildParam(id), [setChildParam]);
  return { query, kids, childId, child, setChildId };
}

/** "Ama Kollie · Grade 3 A" */
export function childLine(child: ChildSummary | undefined): string | undefined {
  if (!child) return undefined;
  return `${child.name}${child.class_name ? ` · ${child.class_name}` : ''}`;
}
