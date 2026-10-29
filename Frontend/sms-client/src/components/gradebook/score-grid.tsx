'use client';

// Desk layout: students as rows, assessments as columns, then the period score the server
// computed. The grid scrolls inside its own box with the header and names kept in view.
import * as React from 'react';
import { CalendarDays, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';

import { cn } from '@/lib/utils';
import { DropdownMenu } from '@/components/ui/dropdown-menu';
import { KIND_LABELS, type GradebookSheet, type SheetAssessment } from '@/services/api/gradebook-service';
import { draftError, formatDay, formatNumber, formatResult, type DraftEntry, type Drafts } from './gradebook-utils';
import { ScoreCell, type Move, type UpdateCell } from './score-cell';

export type SavedCells = Map<string, Map<string, DraftEntry>>;

const EMPTY: DraftEntry = { text: '', status: 'scored', comment: '' };

export function ScoreGrid({
  sheet,
  saved,
  drafts,
  readOnly,
  canManageAssessments,
  isExam,
  onUpdate,
  onComment,
  onEditAssessment,
  onDeleteAssessment,
}: {
  sheet: GradebookSheet;
  saved: SavedCells;
  drafts: Drafts;
  readOnly: boolean;
  canManageAssessments: boolean;
  isExam: boolean;
  onUpdate: UpdateCell;
  onComment: (assessmentId: string, studentId: string) => void;
  onEditAssessment: (assessment: SheetAssessment) => void;
  onDeleteAssessment: (assessment: SheetAssessment) => void;
}) {
  const inputs = React.useRef(new Map<string, HTMLInputElement>());
  const size = React.useRef({ rows: 0, cols: 0 });
  size.current = { rows: sheet.students.length, cols: sheet.assessments.length };

  const registerInput = React.useCallback((col: number, row: number, el: HTMLInputElement | null) => {
    const key = `${col}:${row}`;
    if (el) inputs.current.set(key, el);
    else inputs.current.delete(key);
  }, []);

  /** Moves focus; returns false when there is nowhere to go (Tab then leaves the grid). */
  const onMove = React.useCallback((col: number, row: number, move: Move) => {
    const { rows, cols } = size.current;
    let c = col;
    let r = row;
    if (move === 'down' || move === 'next') r += 1;
    else r -= 1;
    if (r >= rows) {
      if (move !== 'next' || c + 1 >= cols) return false;
      c += 1;
      r = 0;
    } else if (r < 0) {
      if (move !== 'prev' || c === 0) return false;
      c -= 1;
      r = rows - 1;
    }
    const el = inputs.current.get(`${c}:${r}`);
    if (!el) return false;
    el.focus();
    return true;
  }, []);

  const categories = React.useMemo(() => new Map(sheet.categories.map((c) => [c.id, c.name])), [sheet.categories]);
  const resultLabel = isExam ? 'Exam result' : 'Period score';

  return (
    <div className="overflow-auto rounded-xl border bg-background max-h-[calc(100vh-15rem)] min-h-64">
      <table className="w-full border-separate border-spacing-0 text-sm">
        <caption className="sr-only">
          Marks for {sheet.subject?.name ?? 'this subject'}. Tab or Enter moves down a column; Esc undoes a change; A marks
          absent, E excused, C adds a comment.
        </caption>
        <thead>
          <tr>
            <th
              scope="col"
              className="sticky top-0 left-0 z-30 min-w-56 border-b border-r bg-muted px-3 py-2 text-left align-bottom font-medium"
            >
              Student
            </th>
            {sheet.assessments.map((a) => {
              const category = a.grading_category_id ? categories.get(a.grading_category_id) : null;
              return (
                <th
                  key={a.id}
                  scope="col"
                  className="sticky top-0 z-20 w-32 min-w-32 border-b bg-muted px-2 py-2 text-left align-bottom font-normal"
                >
                  <div className="flex items-start gap-1">
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium text-foreground" title={a.title}>
                        {a.title}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {KIND_LABELS[a.kind] ?? a.kind}
                        {category ? ` · ${category}` : ''}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        out of {formatNumber(a.max_score)}
                        {a.assessment_date ? (
                          <span className="ml-1 inline-flex items-center gap-0.5">
                            <CalendarDays className="size-3" aria-hidden="true" />
                            {formatDay(a.assessment_date)}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    {canManageAssessments ? (
                      <DropdownMenu
                        label={`Actions for ${a.title}`}
                        items={[
                          { label: 'Edit assessment', icon: Pencil, onSelect: () => onEditAssessment(a) },
                          'separator',
                          {
                            label: 'Delete assessment',
                            icon: Trash2,
                            destructive: true,
                            onSelect: () => onDeleteAssessment(a),
                          },
                        ]}
                        trigger={
                          <button
                            type="button"
                            aria-label={`Actions for ${a.title}`}
                            className="-mr-1 inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[open]:bg-accent"
                          >
                            <MoreHorizontal className="size-4" aria-hidden="true" />
                          </button>
                        }
                      />
                    ) : null}
                  </div>
                </th>
              );
            })}
            <th
              scope="col"
              className="sticky top-0 z-20 min-w-28 border-b border-l bg-muted px-3 py-2 text-right align-bottom font-medium"
            >
              {resultLabel}
              <div className="text-xs font-normal text-muted-foreground">Updates after saving</div>
            </th>
          </tr>
        </thead>
        <tbody>
          {sheet.students.map((student, row) => (
            <tr key={student.student_id} className="group">
              <th
                scope="row"
                className="sticky left-0 z-10 border-b border-r bg-background px-3 py-1.5 text-left font-normal group-hover:bg-muted/50"
              >
                <div className="flex items-baseline gap-2">
                  <span className="w-6 shrink-0 text-right text-xs text-muted-foreground tabular-nums">{row + 1}</span>
                  <div className="min-w-0">
                    <div className="truncate font-medium text-foreground">{student.name}</div>
                    {student.admission_number ? (
                      <div className="truncate text-xs text-muted-foreground">{student.admission_number}</div>
                    ) : null}
                  </div>
                </div>
              </th>
              {sheet.assessments.map((a, col) => {
                const draft = drafts[a.id]?.[student.student_id];
                const value = draft ?? saved.get(a.id)?.get(student.student_id) ?? EMPTY;
                return (
                  <td key={a.id} className="border-b px-1 py-1 group-hover:bg-muted/30">
                    <ScoreCell
                      assessmentId={a.id}
                      studentId={student.student_id}
                      row={row}
                      col={col}
                      value={value}
                      changed={Boolean(draft)}
                      error={draft ? draftError(draft, a.max_score) : null}
                      readOnly={readOnly}
                      label={`${student.name}, ${a.title}, out of ${formatNumber(a.max_score)}`}
                      onUpdate={onUpdate}
                      onMove={onMove}
                      onComment={onComment}
                      registerInput={registerInput}
                    />
                  </td>
                );
              })}
              <td className="border-b border-l px-3 py-1.5 text-right tabular-nums group-hover:bg-muted/30">
                <span className="text-base font-semibold text-foreground">{formatResult(student.period_score)}</span>
                {student.period_score !== null && student.period_score !== undefined && !student.complete ? (
                  <div className="text-xs text-amber-800">Incomplete</div>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th
              scope="row"
              className="sticky bottom-0 left-0 z-20 border-r border-t bg-muted px-3 py-2 text-left font-medium"
            >
              Class average
            </th>
            {sheet.assessments.map((a) => {
              const entered = sheet.students.filter((s) => s.scores?.[a.id]).length;
              return (
                <td key={a.id} className="sticky bottom-0 z-10 border-t bg-muted px-2 py-2 text-xs text-muted-foreground">
                  {entered} of {sheet.students.length} entered
                </td>
              );
            })}
            <td
              className={cn(
                'sticky bottom-0 z-10 border-l border-t bg-muted px-3 py-2 text-right text-base font-semibold tabular-nums'
              )}
            >
              {formatResult(sheet.class_average)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
