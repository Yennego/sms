'use client';

// Phone layout: one assessment at a time, a list of students with large number inputs and
// Absent / Excused toggles. "Next" on the keyboard moves to the next student.
import * as React from 'react';
import { MessageSquare } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { GradebookSheet, SheetAssessment } from '@/services/api/gradebook-service';
import { draftError, formatNumber, formatResult, type DraftEntry, type Drafts } from './gradebook-utils';
import type { UpdateCell } from './score-cell';
import type { SavedCells } from './score-grid';

const EMPTY: DraftEntry = { text: '', status: 'scored', comment: '' };

function Toggle({
  pressed,
  onClick,
  disabled,
  tone,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  disabled?: boolean;
  tone: 'red' | 'blue';
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'inline-flex min-h-11 min-w-11 items-center justify-center rounded-md border px-3 text-sm font-medium outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-60',
        pressed
          ? tone === 'red'
            ? 'border-red-300 bg-red-100 text-red-900'
            : 'border-blue-300 bg-blue-100 text-blue-900'
          : 'bg-background text-muted-foreground'
      )}
    >
      {children}
    </button>
  );
}

export function ScoreList({
  sheet,
  saved,
  drafts,
  assessment,
  readOnly,
  onUpdate,
  onComment,
}: {
  sheet: GradebookSheet;
  saved: SavedCells;
  drafts: Drafts;
  assessment: SheetAssessment;
  readOnly: boolean;
  onUpdate: UpdateCell;
  onComment: (assessmentId: string, studentId: string) => void;
}) {
  const inputs = React.useRef<(HTMLInputElement | null)[]>([]);
  const max = assessment.max_score;

  return (
    <ul className="divide-y rounded-xl border bg-background" aria-label={`Marks for ${assessment.title}`}>
      {sheet.students.map((student, index) => {
        const draft = drafts[assessment.id]?.[student.student_id];
        const value = draft ?? saved.get(assessment.id)?.get(student.student_id) ?? EMPTY;
        const error = draft ? draftError(draft, max) : null;
        const inputId = `phone-score-${student.student_id}`;
        const errorId = `${inputId}-error`;
        const hasComment = value.comment.trim().length > 0;
        const setStatus = (status: DraftEntry['status']) =>
          onUpdate(assessment.id, student.student_id, (current) => ({
            ...current,
            status: current.status === status ? 'scored' : status,
            text: '',
          }));

        return (
          <li
            key={student.student_id}
            className={cn('flex flex-col gap-2 px-3 py-3', draft && 'bg-amber-50', error && 'bg-red-50')}
          >
            <div className="flex items-baseline justify-between gap-2">
              <label htmlFor={inputId} className="min-w-0">
                <span className="block truncate text-base font-medium text-foreground">{student.name}</span>
                {student.admission_number ? (
                  <span className="block truncate text-sm text-muted-foreground">{student.admission_number}</span>
                ) : null}
              </label>
              <span className="shrink-0 text-sm text-muted-foreground">
                {draft ? <span className="font-medium text-amber-900">Not saved</span> : null}
                {!draft && student.period_score !== null && student.period_score !== undefined
                  ? `Period ${formatResult(student.period_score)}`
                  : null}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5">
                <input
                  ref={(el) => {
                    inputs.current[index] = el;
                  }}
                  id={inputId}
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  enterKeyHint={index === sheet.students.length - 1 ? 'done' : 'next'}
                  readOnly={readOnly}
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? errorId : undefined}
                  value={value.status === 'scored' ? value.text : ''}
                  placeholder={value.status === 'absent' ? 'Absent' : value.status === 'excused' ? 'Excused' : '–'}
                  onChange={(e) => {
                    const text = e.target.value;
                    onUpdate(assessment.id, student.student_id, (current) => ({ ...current, text, status: 'scored' }));
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const next = inputs.current[index + 1];
                      if (next) next.focus();
                      else e.currentTarget.blur();
                    }
                  }}
                  onFocus={(e) => e.currentTarget.select()}
                  className={cn(
                    'h-14 w-24 rounded-lg border border-input bg-background px-3 text-right text-2xl tabular-nums outline-none',
                    'focus:border-ring focus:ring-[3px] focus:ring-ring/50 placeholder:text-base',
                    value.status === 'absent' && 'placeholder:text-red-800',
                    value.status === 'excused' && 'placeholder:text-blue-800',
                    error && 'border-destructive',
                    readOnly && 'bg-muted'
                  )}
                />
                <span className="text-base text-muted-foreground">/ {formatNumber(max)}</span>
              </div>
              <div className="ml-auto flex items-center gap-1.5">
                <Toggle tone="red" pressed={value.status === 'absent'} onClick={() => setStatus('absent')} disabled={readOnly}>
                  Absent
                </Toggle>
                <Toggle
                  tone="blue"
                  pressed={value.status === 'excused'}
                  onClick={() => setStatus('excused')}
                  disabled={readOnly}
                >
                  Excused
                </Toggle>
                {!readOnly || hasComment ? (
                  <button
                    type="button"
                    onClick={() => onComment(assessment.id, student.student_id)}
                    className={cn(
                      'inline-flex size-11 items-center justify-center rounded-md border outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
                      hasComment ? 'bg-accent text-foreground' : 'text-muted-foreground'
                    )}
                  >
                    <MessageSquare className="size-5" aria-hidden="true" />
                    <span className="sr-only">
                      {hasComment ? 'Comment' : 'Add comment'} for {student.name}
                    </span>
                  </button>
                ) : null}
              </div>
            </div>
            {error ? (
              <p id={errorId} role="alert" className="text-sm font-medium text-destructive">
                {error}
              </p>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
