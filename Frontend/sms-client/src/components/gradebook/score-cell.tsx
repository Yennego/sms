'use client';

// One mark in the desk grid: a text input (numbers only, checked against the maximum) and a
// small menu for Absent / Excused / comment. Keys: Tab or Enter moves down the column
// (Shift goes up), arrows move up and down, Esc puts back the saved value, A = absent,
// E = excused, C = comment. An empty mark is saved as "no mark" (the server deletes the entry).
import * as React from 'react';
import { CheckCircle2, Eraser, Info, MessageSquare, MoreVertical, Undo2, XCircle } from 'lucide-react';

import { cn } from '@/lib/utils';
import { DropdownMenu, type DropdownMenuEntry } from '@/components/ui/dropdown-menu';
import type { DraftEntry } from './gradebook-utils';

export type UpdateCell = (
  assessmentId: string,
  studentId: string,
  update: (current: DraftEntry) => DraftEntry | null
) => void;

export type Move = 'down' | 'up' | 'next' | 'prev';

export const STATUS_TEXT = { scored: '', absent: 'Absent', excused: 'Excused' } as const;

export interface ScoreCellProps {
  assessmentId: string;
  studentId: string;
  row: number;
  col: number;
  value: DraftEntry;
  changed: boolean;
  error: string | null;
  readOnly: boolean;
  label: string;
  onUpdate: UpdateCell;
  onMove: (col: number, row: number, move: Move) => boolean;
  onComment: (assessmentId: string, studentId: string) => void;
  registerInput: (col: number, row: number, el: HTMLInputElement | null) => void;
}

function ScoreCellImpl({
  assessmentId,
  studentId,
  row,
  col,
  value,
  changed,
  error,
  readOnly,
  label,
  onUpdate,
  onMove,
  onComment,
  registerInput,
}: ScoreCellProps) {
  const errorId = `score-error-${col}-${row}`;
  const setStatus = (status: DraftEntry['status']) =>
    onUpdate(assessmentId, studentId, (current) => ({
      ...current,
      status,
      text: status === 'scored' ? current.text : '',
    }));

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    const { key, shiftKey, ctrlKey, metaKey, altKey } = event;
    if (key === 'Enter' || key === 'Tab') {
      const moved = onMove(col, row, shiftKey ? (key === 'Tab' ? 'prev' : 'up') : key === 'Tab' ? 'next' : 'down');
      if (moved || key === 'Enter') event.preventDefault();
      return;
    }
    if (key === 'ArrowDown' || key === 'ArrowUp') {
      event.preventDefault();
      onMove(col, row, key === 'ArrowDown' ? 'down' : 'up');
      return;
    }
    if (key === 'Escape') {
      if (changed) {
        event.preventDefault();
        onUpdate(assessmentId, studentId, () => null);
      }
      return;
    }
    if (readOnly || ctrlKey || metaKey || altKey) return;
    if ((key === 'Backspace' || key === 'Delete') && value.status !== 'scored') {
      // Clears Absent / Excused back to an empty mark.
      event.preventDefault();
      setStatus('scored');
      return;
    }
    const lower = key.toLowerCase();
    if (lower === 'a') {
      event.preventDefault();
      setStatus('absent');
    } else if (lower === 'e') {
      event.preventDefault();
      setStatus('excused');
    } else if (lower === 'c') {
      event.preventDefault();
      onComment(assessmentId, studentId);
    }
  };

  const hasComment = value.comment.trim().length > 0;
  const items: DropdownMenuEntry[] = readOnly
    ? hasComment
      ? [{ label: 'View comment', icon: MessageSquare, onSelect: () => onComment(assessmentId, studentId) }]
      : []
    : [
        ...(value.status !== 'scored'
          ? [{ label: 'Enter a score', icon: CheckCircle2, onSelect: () => setStatus('scored') }]
          : []),
        ...(value.status !== 'absent'
          ? [{ label: 'Mark absent (counts as 0)', icon: XCircle, onSelect: () => setStatus('absent') }]
          : []),
        ...(value.status !== 'excused'
          ? [{ label: 'Mark excused (left out)', icon: Info, onSelect: () => setStatus('excused') }]
          : []),
        ...(value.text.trim() || value.status !== 'scored'
          ? [
              {
                label: 'Clear mark',
                icon: Eraser,
                onSelect: () => onUpdate(assessmentId, studentId, (current) => ({ ...current, text: '', status: 'scored' as const })),
              },
            ]
          : []),
        'separator' as const,
        {
          label: hasComment ? 'Edit comment' : 'Add comment',
          icon: MessageSquare,
          onSelect: () => onComment(assessmentId, studentId),
        },
        ...(changed
          ? [{ label: 'Undo change', icon: Undo2, onSelect: () => onUpdate(assessmentId, studentId, () => null) }]
          : []),
      ];

  return (
    <div
      className={cn(
        'relative flex items-center rounded-md',
        value.status === 'absent' && 'bg-red-50',
        value.status === 'excused' && 'bg-blue-50',
        changed && 'bg-amber-50 ring-2 ring-amber-400',
        error && 'ring-2 ring-destructive'
      )}
    >
      <input
        ref={(el) => registerInput(col, row, el)}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        enterKeyHint="next"
        aria-label={label}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        readOnly={readOnly}
        value={value.status === 'scored' ? value.text : ''}
        placeholder={STATUS_TEXT[value.status]}
        title={error ?? (hasComment ? value.comment : undefined)}
        onFocus={(e) => e.currentTarget.select()}
        onKeyDown={onKeyDown}
        onChange={(e) => {
          const text = e.target.value;
          onUpdate(assessmentId, studentId, (current) => ({ ...current, text, status: 'scored' }));
        }}
        className={cn(
          'h-9 w-full min-w-0 rounded-md border border-transparent bg-transparent pr-8 pl-2 text-right text-sm tabular-nums outline-none',
          'hover:border-input focus:border-ring focus:bg-background focus:ring-[3px] focus:ring-ring/50',
          value.status === 'absent' && 'placeholder:font-medium placeholder:text-red-800',
          value.status === 'excused' && 'placeholder:font-medium placeholder:text-blue-800',
          readOnly && 'cursor-default'
        )}
      />
      {hasComment ? (
        <MessageSquare className="pointer-events-none absolute top-0.5 left-0.5 size-3 text-muted-foreground" aria-hidden="true" />
      ) : null}
      {error ? (
        <span id={errorId} className="sr-only">
          {error}
        </span>
      ) : null}
      {items.length > 0 ? (
        <div className="absolute right-0.5">
          <DropdownMenu
            items={items}
            trigger={
              <button
                type="button"
                tabIndex={-1}
                aria-label={`Options for ${label}`}
                className="inline-flex size-7 items-center justify-center rounded text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[open]:bg-accent"
              >
                <MoreVertical className="size-4" aria-hidden="true" />
              </button>
            }
          />
        </div>
      ) : null}
    </div>
  );
}

export const ScoreCell = React.memo(ScoreCellImpl);
