'use client';

// Small controls shared by the class placement screen and the students directory.
import * as React from 'react';
import { Search, X } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import type { RosterSort } from '@/services/api/class-placement-service';

export const PAGE_SIZES = [25, 50, 100] as const;

export const SORT_OPTIONS: { value: RosterSort; label: string }[] = [
  { value: 'name', label: 'Name' },
  { value: 'admission_number', label: 'Admission no.' },
  { value: 'class', label: 'Class' },
];

export function isRosterSort(value: string): value is RosterSort {
  return SORT_OPTIONS.some((o) => o.value === value);
}

export const selectClassName =
  'h-11 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50 sm:w-auto md:h-9';

export function SearchBox({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  className?: string;
}) {
  const id = React.useId();
  return (
    <div className={cn('relative w-full sm:max-w-xs', className)}>
      <label htmlFor={id} className="sr-only">
        {placeholder}
      </label>
      <Search
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      <Input
        id={id}
        type="search"
        value={value}
        maxLength={100}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-11 pr-11 pl-9 md:h-9 [&::-webkit-search-cancel-button]:hidden"
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange('')}
          className="absolute top-1/2 right-0 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 md:size-9"
        >
          <X className="size-4" aria-hidden="true" />
          <span className="sr-only">Clear search</span>
        </button>
      ) : null}
    </div>
  );
}

export function LabeledSelect({
  label,
  value,
  onChange,
  children,
  disabled,
  hideLabel = true,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
  disabled?: boolean;
  hideLabel?: boolean;
}) {
  const id = React.useId();
  return (
    <div className="flex w-full items-center gap-2 sm:w-auto">
      <label htmlFor={id} className={hideLabel ? 'sr-only' : 'shrink-0 text-sm text-muted-foreground'}>
        {label}
      </label>
      <select
        id={id}
        className={selectClassName}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      >
        {children}
      </select>
    </div>
  );
}
