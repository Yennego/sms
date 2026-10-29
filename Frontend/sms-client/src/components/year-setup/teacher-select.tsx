'use client';

import * as React from 'react';
import { Loader2 } from 'lucide-react';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { TeacherOption } from '@/services/api/year-setup-service';

const NONE = '__none__';

export function teacherName(t: TeacherOption): string {
  return `${t.first_name ?? ''} ${t.last_name ?? ''}`.trim() || 'Unnamed teacher';
}

export interface TeacherSelectProps {
  teachers: TeacherOption[];
  value: string | null;
  /** Name to show when the current teacher isn't in the list (e.g. inactive). */
  currentName?: string | null;
  onChange: (teacherId: string | null) => void;
  /** Accessible name, e.g. "Sponsor for Grade 1 - A". */
  label: string;
  placeholder?: string;
  saving?: boolean;
  disabled?: boolean;
  className?: string;
}

/** A teacher picker with a "No teacher" option. Saves on change (the caller decides how). */
export function TeacherSelect({
  teachers,
  value,
  currentName,
  onChange,
  label,
  placeholder = 'Choose a teacher',
  saving = false,
  disabled = false,
  className,
}: TeacherSelectProps) {
  const known = value ? teachers.some((t) => t.id === value) : true;
  return (
    <div className={cn('flex min-w-0 items-center gap-2', className)}>
      <Select
        value={value ?? NONE}
        onValueChange={(v) => onChange(v === NONE ? null : v)}
        disabled={disabled || saving}
      >
        <SelectTrigger aria-label={label} className="h-11 min-w-0 md:h-10">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>No teacher</SelectItem>
          {!known && value ? <SelectItem value={value}>{currentName || 'Current teacher'}</SelectItem> : null}
          {teachers.map((t) => (
            <SelectItem key={t.id} value={t.id}>
              {teacherName(t)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {saving ? <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" aria-label="Saving" /> : null}
    </div>
  );
}
