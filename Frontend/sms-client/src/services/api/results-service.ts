// Results, publishing and report cards: /academics/gradebook (phase4-design.md section 4,
// "Review and publish" and "Results and report cards").
//
// The report card types are shared by the staff report cards page and the student / parent
// results screens. Students and parents only ever get published columns (unpublished ones are
// null); staff get everything plus a `published` flag per column.
import { useMemo } from 'react';

import { createWaitForApiClientReady, useApiClientWithLoading } from './api-client';

const BASE = '/academics/gradebook';

// ---------------------------------------------------------------------------
// Report cards
// ---------------------------------------------------------------------------

export interface ReportCardStudent {
  id: string;
  name: string;
  first_name?: string | null;
  last_name?: string | null;
  admission_number?: string | null;
  gender?: string | null;
}

export interface ReportCardClass {
  id: string;
  name: string;
  grade_name?: string | null;
  section_name?: string | null;
  sponsor_name?: string | null;
}

export interface ReportCardYear {
  id: string;
  name: string;
}

/** Staff only: which columns of a semester are published for the class. */
export interface ReportCardSemesterPublished {
  /** One flag per period, in order (three per semester). */
  periods: boolean[];
  /** The semester exam and the semester average. */
  exam: boolean;
}

export interface ReportCardSemester {
  /** 1 or 2. */
  number: number;
  /** Period grades in order, null when there is no score (or it isn't published, for students and parents). */
  periods: (number | null)[];
  exam: number | null;
  average: number | null;
  /** False when the average was worked out without every column. */
  complete: boolean;
  /** Staff only. Absent for students and parents (they only get published columns). */
  published?: ReportCardSemesterPublished;
}

export interface ReportCardSubject {
  subject_id: string;
  name: string;
  semesters: ReportCardSemester[];
  yearly_average: number | null;
  passed: boolean | null;
}

export interface ReportCardOverall {
  /** One per semester; null when not available (or not yet published). */
  semester_averages: (number | null)[];
  yearly_average: number | null;
  rank: number | null;
  class_size: number | null;
}

export interface ReportCardAttendance {
  present: number;
  absent: number;
  late: number;
  excused: number;
}

export interface ReportCardData {
  student: ReportCardStudent;
  class: ReportCardClass;
  year: ReportCardYear;
  pass_mark: number;
  subjects: ReportCardSubject[];
  overall: ReportCardOverall;
  attendance: ReportCardAttendance | null;
  remarks: { sponsor: string | null; principal?: string | null } | null;
  /** The school as the server prints it (school record + school profile). Preferred over the tenant context. */
  school?: ReportCardSchool | null;
  /** Signatures fixed at the latest publication; null each when not published yet or none on file. */
  signatures?: ReportCardSignatures | null;
  /** The card's verification QR (phase4-design.md section 7); only when something is published. */
  verification?: ReportCardVerification | null;
}

/** A printed card's QR: anyone can scan it to check the card at /verify/{code}. */
export interface ReportCardVerification {
  /** 12 characters, Crockford base32, uppercase (e.g. "7K2M9QXR4T8B"). */
  code: string;
  /** {FRONTEND_URL}/verify/{code}, what the QR encodes. */
  url: string | null;
  /** The QR as an SVG document from our server; null when missing or not an SVG. */
  qr_svg: string | null;
}

/** What the report card shows about the school (from the card, else the tenant context). */
export interface ReportCardSchool {
  name: string;
  logo?: string | null;
  address?: string | null;
  motto?: string | null;
  phone?: string | null;
  email?: string | null;
  /** data URL of the school seal, printed next to the principal's signature. */
  seal?: string | null;
}

export interface ReportCardSignature {
  name: string | null;
  /** "Class sponsor", "Principal", "Headmaster", ... */
  title: string | null;
  /** data URL (PNG), or null when the person had no signature on file. */
  image: string | null;
}

export interface ReportCardSignatures {
  sponsor: ReportCardSignature | null;
  principal: ReportCardSignature | null;
}

// ---------------------------------------------------------------------------
// Review and publish
// ---------------------------------------------------------------------------

/** A results column: one period, or one semester (its exam and semester average). */
export type ResultScope = { period_id: string; semester_id?: undefined } | { semester_id: string; period_id?: undefined };

export interface SubjectProgress {
  class_subject_id: string | null;
  subject_id: string | null;
  subject_name: string;
  teacher_name: string | null;
  /** Number of assessments in this period (or 1 for the semester exam when it exists). */
  assessments: number;
  /** Students with a period score (or an exam score). */
  scored: number;
  /** Class size. */
  students: number;
  class_average: number | null;
  published: boolean;
}

export interface ClassProgress {
  class_id: string;
  published: boolean;
  students: number;
  subjects: SubjectProgress[];
}

export interface ResultPublication {
  id: string;
  class_id: string;
  period_id: string | null;
  semester_id: string | null;
  published_at: string | null;
  published_by: string | null;
  published_by_name?: string | null;
}

export interface GradingSettings {
  pass_mark: number;
  updated_at?: string | null;
}

// ---------------------------------------------------------------------------
// Normalising (the backend is built in parallel; accept the obvious variants of each field)
// ---------------------------------------------------------------------------

type Obj = Record<string, unknown>;

function isObj(v: unknown): v is Obj {
  return Boolean(v) && typeof v === 'object' && !Array.isArray(v);
}

function str(v: unknown): string | null {
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return String(v);
  return null;
}

function num(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v);
  return null;
}

function first(o: Obj, ...keys: string[]): unknown {
  for (const key of keys) {
    const parts = key.split('.');
    let cur: unknown = o;
    for (const p of parts) cur = isObj(cur) ? cur[p] : undefined;
    if (cur !== undefined && cur !== null) return cur;
  }
  return undefined;
}

function listOf(resp: unknown, ...keys: string[]): unknown[] {
  if (Array.isArray(resp)) return resp;
  if (isObj(resp)) {
    for (const key of ['items', ...keys]) {
      const v = resp[key];
      if (Array.isArray(v)) return v;
    }
  }
  return [];
}

function personName(o: unknown): string | null {
  if (typeof o === 'string') return o;
  if (!isObj(o)) return null;
  const name = str(o.name) ?? str(o.full_name);
  if (name) return name;
  const joined = [str(o.first_name), str(o.last_name)].filter(Boolean).join(' ').trim();
  return joined || null;
}

function normaliseSubjectProgress(raw: unknown): SubjectProgress {
  const o = isObj(raw) ? raw : {};
  return {
    class_subject_id: str(first(o, 'class_subject_id', 'id')),
    subject_id: str(first(o, 'subject_id', 'subject.id')),
    subject_name: str(first(o, 'subject_name', 'name', 'subject.name')) ?? 'Subject',
    teacher_name: personName(first(o, 'teacher_name', 'teacher')),
    assessments: num(first(o, 'assessments', 'assessments_count', 'assessment_count')) ?? 0,
    scored: num(first(o, 'scored', 'students_scored', 'with_score', 'entered', 'students_with_score')) ?? 0,
    students: num(first(o, 'students', 'class_size', 'students_total')) ?? 0,
    class_average: num(first(o, 'class_average', 'average')),
    published: Boolean(first(o, 'published', 'is_published')),
  };
}

function normaliseProgress(classId: string, resp: unknown): ClassProgress {
  const o = isObj(resp) ? resp : {};
  const subjects = listOf(resp, 'subjects').map(normaliseSubjectProgress);
  const students =
    num(first(o, 'class_size', 'students')) ?? subjects.reduce((max, s) => Math.max(max, s.students), 0);
  const published =
    typeof o.published === 'boolean' ? o.published : subjects.length > 0 && subjects.every((s) => s.published);
  return { class_id: str(o.class_id) ?? classId, published, students, subjects };
}

function normalisePublication(raw: unknown): ResultPublication | null {
  if (!isObj(raw)) return null;
  const classId = str(first(raw, 'class_id', 'class.id'));
  if (!classId) return null;
  return {
    id: str(raw.id) ?? `${classId}:${str(raw.period_id) ?? str(raw.semester_id)}`,
    class_id: classId,
    period_id: str(first(raw, 'period_id', 'period.id')),
    semester_id: str(first(raw, 'semester_id', 'semester.id')),
    published_at: str(raw.published_at),
    published_by: str(raw.published_by),
    published_by_name: personName(first(raw, 'published_by_name', 'publisher')),
  };
}

function normaliseCard(raw: unknown): ReportCardData {
  const o = isObj(raw) ? raw : {};
  const student = isObj(o.student) ? o.student : {};
  const cls = isObj(o.class) ? o.class : {};
  const year = isObj(o.year) ? o.year : {};
  const overall = isObj(o.overall) ? o.overall : {};
  const attendance = isObj(o.attendance) ? o.attendance : null;
  const remarks = isObj(o.remarks) ? o.remarks : null;

  return {
    student: {
      id: str(first(student, 'id', 'student_id')) ?? '',
      name: personName(student) ?? 'Unnamed student',
      first_name: str(student.first_name),
      last_name: str(student.last_name),
      admission_number: str(student.admission_number),
      gender: str(student.gender),
    },
    class: {
      id: str(first(cls, 'id', 'class_id')) ?? '',
      name:
        str(cls.name) ??
        ([str(cls.grade_name), str(cls.section_name)].filter(Boolean).join(' - ') || 'Class'),
      grade_name: str(cls.grade_name),
      section_name: str(cls.section_name),
      sponsor_name: personName(first(cls, 'sponsor_name', 'sponsor')),
    },
    year: { id: str(year.id) ?? '', name: str(year.name) ?? '' },
    pass_mark: num(o.pass_mark) ?? 70,
    subjects: listOf(o.subjects).map((s) => {
      const so = isObj(s) ? s : {};
      return {
        subject_id: str(first(so, 'subject_id', 'id')) ?? '',
        name: str(first(so, 'name', 'subject_name')) ?? 'Subject',
        semesters: listOf(so.semesters).map((sem, i) => {
          const m = isObj(sem) ? sem : {};
          const pub = isObj(m.published) ? m.published : null;
          return {
            number: num(m.number) ?? i + 1,
            periods: listOf(m.periods).map(num),
            exam: num(m.exam),
            average: num(m.average),
            complete: m.complete !== false,
            published: pub
              ? { periods: listOf(pub.periods).map(Boolean), exam: Boolean(pub.exam) }
              : undefined,
          };
        }),
        yearly_average: num(so.yearly_average),
        passed: typeof so.passed === 'boolean' ? so.passed : null,
      };
    }),
    overall: {
      semester_averages: listOf(overall.semester_averages).map(num),
      yearly_average: num(overall.yearly_average),
      rank: num(overall.rank),
      class_size: num(overall.class_size),
    },
    attendance: attendance
      ? {
          present: num(attendance.present) ?? 0,
          absent: num(attendance.absent) ?? 0,
          late: num(attendance.late) ?? 0,
          excused: num(attendance.excused) ?? 0,
        }
      : null,
    remarks: remarks ? { sponsor: str(remarks.sponsor), principal: str(remarks.principal) } : null,
    school: normaliseSchool(o.school),
    signatures: isObj(o.signatures)
      ? { sponsor: normaliseSignature(o.signatures.sponsor), principal: normaliseSignature(o.signatures.principal) }
      : null,
    verification: normaliseVerification(o.verification),
  };
}

function normaliseVerification(raw: unknown): ReportCardVerification | null {
  if (!isObj(raw)) return null;
  const code = str(raw.code)?.trim();
  if (!code) return null;
  // A leading XML declaration is dropped; anything else must start with <svg
  const svg = str(first(raw, 'qr_svg', 'svg'))?.trim().replace(/^<\?xml[^>]*\?>\s*/, '') ?? null;
  return {
    code,
    url: str(raw.url),
    // Only an SVG document is accepted (it is shown through a data URL <img>, never as markup)
    qr_svg: svg && svg.startsWith('<svg') ? svg : null,
  };
}

function normaliseSchool(raw: unknown): ReportCardSchool | null {
  if (!isObj(raw)) return null;
  const text = (v: unknown) => {
    const s = str(v);
    return s && s.trim() !== '' ? s : null;
  };
  return {
    name: text(raw.name) ?? '',
    logo: text(first(raw, 'logo', 'logo_url')),
    address: text(raw.address),
    motto: text(raw.motto),
    phone: text(raw.phone),
    email: text(raw.email),
    seal: text(first(raw, 'seal', 'seal_image')),
  };
}

function normaliseSignature(raw: unknown): ReportCardSignature | null {
  if (!isObj(raw)) return null;
  const image = str(raw.image);
  return {
    name: personName(first(raw, 'name', 'user')),
    title: str(raw.title),
    image: image && image.trim() !== '' ? image : null,
  };
}

function scopeQuery(scope: ResultScope): string {
  return scope.period_id
    ? `period_id=${encodeURIComponent(scope.period_id)}`
    : `semester_id=${encodeURIComponent(scope.semester_id as string)}`;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export function useResultsService() {
  const { apiClient } = useApiClientWithLoading();
  const waitForApiClientReady = useMemo(() => createWaitForApiClientReady(apiClient), [apiClient]);

  return useMemo(
    () => ({
      /** One student's report card for a year. Students and parents get published columns only. */
      getStudentReportCard: async (studentId: string, yearId: string): Promise<ReportCardData> => {
        const client = await waitForApiClientReady();
        const resp = await client.get<unknown>(
          `${BASE}/report-cards/students/${encodeURIComponent(studentId)}?academic_year_id=${encodeURIComponent(yearId)}`
        );
        return normaliseCard(resp);
      },

      /** Report cards of every student enrolled in a class (for printing the class). */
      getClassReportCards: async (classId: string, yearId: string): Promise<ReportCardData[]> => {
        const client = await waitForApiClientReady();
        const resp = await client.get<unknown>(
          `${BASE}/report-cards/classes/${encodeURIComponent(classId)}?academic_year_id=${encodeURIComponent(yearId)}`
        );
        return listOf(resp, 'report_cards', 'cards', 'students').map(normaliseCard);
      },

      /** Per subject: teacher, completion, class average and published flag for one column. */
      getClassProgress: async (classId: string, scope: ResultScope): Promise<ClassProgress> => {
        const client = await waitForApiClientReady();
        const resp = await client.get<unknown>(
          `${BASE}/classes/${encodeURIComponent(classId)}/progress?${scopeQuery(scope)}`
        );
        return normaliseProgress(classId, resp);
      },

      /** What's published per class for a year. */
      getPublications: async (yearId: string): Promise<ResultPublication[]> => {
        const client = await waitForApiClientReady();
        const resp = await client.get<unknown>(
          `${BASE}/publications?academic_year_id=${encodeURIComponent(yearId)}`
        );
        return listOf(resp, 'publications')
          .map(normalisePublication)
          .filter((p): p is ResultPublication => p !== null);
      },

      /** Publish a class's results for a period or a semester. 409 when a semester's periods aren't all published. */
      publish: async (classId: string, scope: ResultScope): Promise<unknown> => {
        const client = await waitForApiClientReady();
        return client.post<unknown>(`${BASE}/publications`, { class_id: classId, ...scope });
      },

      unpublish: async (classId: string, scope: ResultScope): Promise<unknown> => {
        const client = await waitForApiClientReady();
        return client.delete<unknown>(
          `${BASE}/publications?class_id=${encodeURIComponent(classId)}&${scopeQuery(scope)}`
        );
      },

      getSettings: async (): Promise<GradingSettings> => {
        const client = await waitForApiClientReady();
        const resp = await client.get<unknown>(`${BASE}/settings`);
        const o = isObj(resp) ? resp : {};
        return { pass_mark: num(o.pass_mark) ?? 70, updated_at: str(o.updated_at) };
      },

      updateSettings: async (settings: { pass_mark: number }): Promise<GradingSettings> => {
        const client = await waitForApiClientReady();
        const resp = await client.put<unknown>(`${BASE}/settings`, settings);
        const o = isObj(resp) ? resp : {};
        return { pass_mark: num(o.pass_mark) ?? settings.pass_mark, updated_at: str(o.updated_at) };
      },
    }),
    [waitForApiClientReady]
  );
}

// ---------------------------------------------------------------------------
// Display helpers shared by the report card and the results screens
// ---------------------------------------------------------------------------

/**
 * The whole verification code for print and typing, in groups of four: "7K2M9QXR4T8B" →
 * "7K2M-9QXR-4T8B". Codes are Crockford base32 (uppercase); the check accepts any case,
 * dashes and spaces.
 */
export function formatVerificationCode(code: string): string {
  const plain = code.replace(/[^0-9A-Za-z]/g, '').toUpperCase();
  return plain.match(/.{1,4}/g)?.join('-') ?? '';
}

/** Results are shown rounded to whole numbers. */
export function formatScore(value: number | null | undefined): string {
  return value === null || value === undefined ? '—' : String(Math.round(value));
}

/** 1 → "1st", 2 → "2nd", 11 → "11th", 22 → "22nd". */
export function ordinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

/** A grade fails when it is below the pass mark (compared at full precision, like the server). */
export function isFailing(value: number | null | undefined, passMark: number): boolean {
  return value !== null && value !== undefined && value < passMark;
}
