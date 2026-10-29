'use client';

// Class → subject → period (or semester exam) pickers. Native selects: large on phones,
// keyboard friendly on desk, no extra JavaScript.
import * as React from 'react';

import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import type { GradebookClassSubject } from '@/services/api/gradebook-service';
import type { TermOption } from './gradebook-utils';
import { subjectLabel } from './queries';

export const selectClass =
  'h-12 w-full min-w-0 rounded-md border border-input bg-background px-3 text-base text-foreground shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50 md:h-10 md:text-sm';

export interface ClassOption {
  id: string;
  label: string;
}

export function termKey(term: Pick<TermOption, 'type' | 'id'>): string {
  return `${term.type}:${term.id}`;
}

function Picker({
  label,
  value,
  onChange,
  disabled,
  placeholder,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder: string;
  children: React.ReactNode;
}) {
  const id = React.useId();
  return (
    <div className="grid min-w-0 gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <select id={id} className={selectClass} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
        {!value ? <option value="">{placeholder}</option> : null}
        {children}
      </select>
    </div>
  );
}

export function GradebookPickers({
  classes,
  classId,
  onClassChange,
  subjects,
  classSubjectId,
  onSubjectChange,
  terms,
  term,
  onTermChange,
  loadingClasses,
  loadingSubjects,
  showTeacher,
  className,
}: {
  classes: ClassOption[];
  classId: string;
  onClassChange: (id: string) => void;
  subjects: GradebookClassSubject[];
  classSubjectId: string;
  onSubjectChange: (id: string) => void;
  terms: TermOption[];
  term: TermOption | undefined;
  onTermChange: (term: TermOption) => void;
  loadingClasses?: boolean;
  loadingSubjects?: boolean;
  /** Show the teacher's name next to each subject (when the list has other teachers' subjects). */
  showTeacher?: boolean;
  className?: string;
}) {
  const semesters = React.useMemo(() => {
    const groups = new Map<number, TermOption[]>();
    for (const t of terms) groups.set(t.semesterNumber, [...(groups.get(t.semesterNumber) ?? []), t]);
    return [...groups.entries()];
  }, [terms]);

  return (
    <div className={cn('grid gap-3 sm:grid-cols-3', className)}>
      <Picker
        label="Class"
        value={classId}
        onChange={onClassChange}
        disabled={loadingClasses || classes.length === 0}
        placeholder={loadingClasses ? 'Loading classes…' : classes.length ? 'Choose a class' : 'No classes'}
      >
        {classes.map((c) => (
          <option key={c.id} value={c.id}>
            {c.label}
          </option>
        ))}
      </Picker>
      <Picker
        label="Subject"
        value={classSubjectId}
        onChange={onSubjectChange}
        disabled={!classId || loadingSubjects || subjects.length === 0}
        placeholder={
          !classId ? 'Choose a class first' : loadingSubjects ? 'Loading subjects…' : subjects.length ? 'Choose a subject' : 'No subjects'
        }
      >
        {subjects.map((s) => (
          <option key={s.class_subject_id} value={s.class_subject_id}>
            {subjectLabel(s)}
            {showTeacher ? ` · ${s.teacher_name || 'No teacher'}` : ''}
            {s.can_edit ? '' : ' (view only)'}
          </option>
        ))}
      </Picker>
      <Picker
        label="Period"
        value={term ? termKey(term) : ''}
        onChange={(key) => {
          const next = terms.find((t) => termKey(t) === key);
          if (next) onTermChange(next);
        }}
        disabled={terms.length === 0}
        placeholder={terms.length ? 'Choose a period' : 'No periods'}
      >
        {semesters.map(([number, options]) => (
          <optgroup key={number} label={`Semester ${number}`}>
            {options.map((t) => (
              <option key={termKey(t)} value={termKey(t)}>
                {t.label}
              </option>
            ))}
          </optgroup>
        ))}
      </Picker>
    </div>
  );
}
