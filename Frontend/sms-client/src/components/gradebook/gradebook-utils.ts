// Draft marks, validation and term (period / exam) options for the gradebook.
// No grade maths here: period scores and the class average come from the server.
import type {
  GradebookSheet,
  GradebookTerms,
  ScoreEntry,
  ScoreEntryInput,
  ScoreStatus,
  SheetAssessment,
} from '@/services/api/gradebook-service';

// ---------------------------------------------------------------------------------------------
// Drafts
// ---------------------------------------------------------------------------------------------

/** What a cell shows while editing: the typed text, a status and a comment. */
export interface DraftEntry {
  text: string;
  status: ScoreStatus;
  comment: string;
}

/** Unsaved cells: assessment id → student id → draft. */
export type Drafts = Record<string, Record<string, DraftEntry>>;

export function entryToDraft(entry: ScoreEntry | undefined): DraftEntry {
  if (!entry) return { text: '', status: 'scored', comment: '' };
  return {
    text: entry.status === 'scored' && entry.score !== null && entry.score !== undefined ? String(entry.score) : '',
    status: entry.status ?? 'scored',
    comment: entry.comment ?? '',
  };
}

export function sameDraft(a: DraftEntry, b: DraftEntry): boolean {
  return a.text.trim() === b.text.trim() && a.status === b.status && a.comment.trim() === b.comment.trim();
}

/** The saved value of a cell as a draft. */
export function savedDraft(sheet: GradebookSheet, assessmentId: string, studentId: string): DraftEntry {
  const student = sheet.students.find((s) => s.student_id === studentId);
  return entryToDraft(student?.scores?.[assessmentId]);
}

/** Cell value to show: the unsaved draft, or the saved value. */
export function cellValue(
  sheet: GradebookSheet,
  drafts: Drafts,
  assessmentId: string,
  studentId: string
): DraftEntry {
  return drafts[assessmentId]?.[studentId] ?? savedDraft(sheet, assessmentId, studentId);
}

/** Returns new drafts with one cell set; a cell equal to its saved value is dropped. */
export function withDraft(
  sheet: GradebookSheet,
  drafts: Drafts,
  assessmentId: string,
  studentId: string,
  next: DraftEntry | null
): Drafts {
  const column = { ...(drafts[assessmentId] ?? {}) };
  if (next === null || sameDraft(next, savedDraft(sheet, assessmentId, studentId))) {
    delete column[studentId];
  } else {
    column[studentId] = next;
  }
  const out = { ...drafts };
  if (Object.keys(column).length === 0) delete out[assessmentId];
  else out[assessmentId] = column;
  return out;
}

/** Changed cells that still differ from the saved sheet (a refetch may have caught up). */
export function changedCells(sheet: GradebookSheet | undefined, drafts: Drafts) {
  const out: { assessment: SheetAssessment; studentId: string; draft: DraftEntry }[] = [];
  if (!sheet) return out;
  for (const assessment of sheet.assessments) {
    const column = drafts[assessment.id];
    if (!column) continue;
    for (const student of sheet.students) {
      const draft = column[student.student_id];
      if (draft && !sameDraft(draft, savedDraft(sheet, assessment.id, student.student_id))) {
        out.push({ assessment, studentId: student.student_id, draft });
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------------------------

const NUMBER = /^\d+([.,]\d+)?$/;

export function parseScore(text: string): number | null {
  const t = text.trim();
  if (!t || !NUMBER.test(t)) return null;
  return Number(t.replace(',', '.'));
}

/** A plain error for a cell, or null when it can be saved. */
export function draftError(draft: DraftEntry, maxScore: number): string | null {
  if (draft.status !== 'scored') return null;
  const t = draft.text.trim();
  if (!t) return null;
  if (!NUMBER.test(t)) return `Enter a number from 0 to ${formatNumber(maxScore)}`;
  const value = parseScore(t) as number;
  if (value > maxScore) return `Use 0 to ${formatNumber(maxScore)}. This is out of ${formatNumber(maxScore)}.`;
  return null;
}

export function draftToEntry(studentId: string, draft: DraftEntry): ScoreEntryInput {
  const comment = draft.comment.trim();
  return {
    student_id: studentId,
    score: draft.status === 'scored' ? parseScore(draft.text) : null,
    status: draft.status,
    comment: comment || null,
  };
}

// ---------------------------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------------------------

const numberFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });

export function formatNumber(n: number): string {
  return numberFormat.format(n);
}

/** Results are shown rounded to whole numbers (phase4-design.md section 1). */
export function formatResult(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return String(Math.round(n));
}

export function formatDay(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

export function todayIso(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

// ---------------------------------------------------------------------------------------------
// Terms: Period 1-3 of semester 1, Period 4-6 of semester 2, and each semester's exam
// ---------------------------------------------------------------------------------------------

export interface TermOption {
  /** 'period' columns use period_id; the 'exam' column uses semester_id. */
  type: 'period' | 'exam';
  id: string;
  semesterId: string;
  semesterNumber: number;
  label: string;
  start: string;
  end: string;
}

export function termOptions(terms: GradebookTerms | undefined): TermOption[] {
  if (!terms) return [];
  const out: TermOption[] = [];
  let counter = 0;
  for (const semester of terms.semesters) {
    semester.periods.forEach((period) => {
      counter += 1;
      out.push({
        type: 'period',
        id: period.id,
        semesterId: semester.id,
        semesterNumber: semester.semester_number,
        label: `Period ${counter}`,
        start: period.start_date,
        end: period.end_date,
      });
    });
    out.push({
      type: 'exam',
      id: semester.id,
      semesterId: semester.id,
      semesterNumber: semester.semester_number,
      label: `Semester ${semester.semester_number} exam`,
      start: semester.periods.at(-1)?.end_date ?? semester.end_date,
      end: semester.end_date,
    });
  }
  return out;
}

/** The period that contains today; else the last one that has started; else the first. */
export function currentTerm(options: TermOption[], today = todayIso()): TermOption | undefined {
  const periods = options.filter((o) => o.type === 'period');
  const inside = periods.find((p) => p.start.slice(0, 10) <= today && today <= p.end.slice(0, 10));
  if (inside) return inside;
  const started = periods.filter((p) => p.start.slice(0, 10) <= today);
  return started.at(-1) ?? periods[0] ?? options[0];
}
