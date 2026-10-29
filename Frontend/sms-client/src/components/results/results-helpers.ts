// Small helpers shared by the student "My results" and parent "Results" screens.
import {
  isFailing,
  ordinal,
  type ReportCardData,
  type ReportCardSemester,
  type ReportCardSubject,
} from '@/services/api/results-service';

/** Short column names (plain words, phone-sized). */
export function periodLabel(index: number): string {
  return `${ordinal(index + 1)} period`;
}

/** True when the card has at least one published mark (students and parents only get published ones). */
export function hasPublishedResults(card: ReportCardData): boolean {
  if (card.overall.yearly_average !== null) return true;
  if (card.overall.semester_averages.some((v) => v !== null)) return true;
  return card.subjects.some((s) => s.yearly_average !== null || s.semesters.some(semesterHasMarks));
}

export function semesterHasMarks(sem: ReportCardSemester): boolean {
  return sem.exam !== null || sem.average !== null || sem.periods.some((p) => p !== null);
}

export interface LatestScore {
  value: number | null;
  /** What the value is, e.g. "Year average", "Semester 1 average", "Semester 2 · 1st period". */
  label: string;
}

/** The most complete published score of a subject: yearly average, else the last semester average, else the last mark. */
export function latestSubjectScore(subject: ReportCardSubject): LatestScore {
  if (subject.yearly_average !== null) return { value: subject.yearly_average, label: 'Year average' };
  const semesters = [...subject.semesters].sort((a, b) => b.number - a.number);
  for (const sem of semesters) {
    if (sem.average !== null) return { value: sem.average, label: `Semester ${sem.number} average` };
  }
  for (const sem of semesters) {
    if (sem.exam !== null) return { value: sem.exam, label: `Semester ${sem.number} · Exam` };
    for (let i = sem.periods.length - 1; i >= 0; i -= 1) {
      const p = sem.periods[i];
      if (p !== null && p !== undefined) return { value: p, label: `Semester ${sem.number} · ${periodLabel(i)}` };
    }
  }
  return { value: null, label: 'No marks yet' };
}

/** Below the pass mark: the server's decision for the year when it has one, else the latest score. */
export function subjectNeedsAttention(subject: ReportCardSubject, passMark: number): boolean {
  if (subject.yearly_average !== null && subject.passed !== null) return !subject.passed;
  return isFailing(latestSubjectScore(subject).value, passMark);
}

/** The overall average to lead with: the year, else the last published semester. */
export function overallAverage(card: ReportCardData): LatestScore {
  if (card.overall.yearly_average !== null) return { value: card.overall.yearly_average, label: 'Year average' };
  const sems = card.overall.semester_averages;
  for (let i = sems.length - 1; i >= 0; i -= 1) {
    const v = sems[i];
    if (v !== null && v !== undefined) return { value: v, label: `Semester ${i + 1} average` };
  }
  return { value: null, label: 'Average' };
}
