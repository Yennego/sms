// A printable report card in the layout Liberian schools already use on paper:
// per subject the 1st, 2nd and 3rd period, the semester exam and the semester average for each
// semester, then the yearly average. One card fits one A4 page (portrait).
//
// Shared by the staff report cards page and the student / parent results screens:
//   <ReportCard card={card} school={{ name: tenant.name, logo: tenant.logo }} />
// Print it with <ReportCardPrintRoot> (print-root.tsx), which hides the app around it.
// The school heading prefers `card.school` (name, logo, address, motto, contacts, seal) over the
// `school` prop. Signatures (`card.signatures`, fixed at publication) and the seal are data URLs,
// so they print without another request. When results are published the card carries a
// verification QR (`card.verification`, phase4-design.md section 7) in the bottom corner.
//
// Failing grades (below the pass mark) are red AND carry a "*" marker, never colour alone.
// For staff, columns that aren't published yet show "—" with a small "not published" note
// (students and parents only ever receive published columns, so they never see the note).
import * as React from 'react';

import { cn } from '@/lib/utils';
import {
  formatScore,
  isFailing,
  ordinal,
  type ReportCardData,
  type ReportCardSchool,
  type ReportCardSemester,
  type ReportCardSignature,
  type ReportCardVerification,
  formatVerificationCode,
} from '@/services/api/results-service';

export interface ReportCardProps {
  card: ReportCardData;
  /** Fallback school details (tenant context); `card.school` is preferred when present. */
  school: ReportCardSchool;
  /** Show "—" for columns the server flags as not published (staff). Default true. */
  hideUnpublished?: boolean;
  className?: string;
}

const PERIODS_PER_SEMESTER = 3;
const SEMESTERS = 2;

/** published = flagged published, unpublished = flagged not published, open = no flag (student/parent: shown as given). */
type ColumnState = 'published' | 'unpublished' | 'open';

function columnState(
  semesters: (ReportCardSemester | undefined)[],
  pick: (s: ReportCardSemester) => boolean | undefined
): ColumnState {
  let flagged = false;
  for (const s of semesters) {
    if (!s?.published) continue;
    flagged = true;
    if (pick(s)) return 'published';
  }
  return flagged ? 'unpublished' : 'open';
}

function Score({
  value,
  passMark,
  hidden,
  incomplete,
  failingOverride,
}: {
  value: number | null;
  passMark: number;
  hidden?: boolean;
  incomplete?: boolean;
  /** Use the server's pass / fail decision instead of comparing with the pass mark. */
  failingOverride?: boolean | null;
}) {
  if (hidden || value === null) {
    return (
      <span aria-label={hidden ? 'Not published' : 'No score'} className="text-neutral-500">
        —
      </span>
    );
  }
  const failing = failingOverride ?? isFailing(value, passMark);
  return (
    <span className={cn('tabular-nums', failing && 'font-bold text-red-700')}>
      {formatScore(value)}
      {failing ? (
        <>
          <span aria-hidden="true">*</span>
          <span className="sr-only"> (below the pass mark)</span>
        </>
      ) : null}
      {incomplete ? (
        <>
          <sup aria-hidden="true" className="ml-px text-[0.7em] font-normal text-neutral-600">
            i
          </sup>
          <span className="sr-only"> (incomplete)</span>
        </>
      ) : null}
    </span>
  );
}

function InfoItem({ label, value, className }: { label: string; value: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex min-w-0 items-baseline gap-2', className)}>
      <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-neutral-600">{label}</span>
      <span className="min-w-0 flex-1 truncate border-b border-dotted border-neutral-500 font-semibold">
        {value || ' '}
      </span>
    </div>
  );
}

function RuledLines({ text, lines = 2 }: { text?: string | null; lines?: number }) {
  if (text) {
    return <p className="min-h-[2.5em] border-b border-neutral-500 pb-1 leading-relaxed">{text}</p>;
  }
  return (
    <div aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="h-6 border-b border-neutral-500" />
      ))}
    </div>
  );
}

/**
 * A signature line. The signature image (a data URL fixed at publication) sits on the line with
 * the person's name and title under it; with no image the line is left blank to sign by hand.
 * The seal, when given, is printed beside the signature, overlapping it like a stamp.
 * `pendingHint` adds a screen-only note for staff previewing unpublished results.
 */
function SignatureLine({
  signature,
  fallbackName,
  fallbackTitle,
  seal,
  pendingHint,
}: {
  signature: ReportCardSignature | null | undefined;
  fallbackName?: string | null;
  fallbackTitle: string;
  seal?: string | null;
  pendingHint?: boolean;
}) {
  const name = signature?.name || fallbackName || null;
  const title = signature?.title || fallbackTitle;
  const image = signature?.image ?? null;
  return (
    <div className="flex flex-col gap-1 break-inside-avoid">
      <div className="relative flex h-14 items-end justify-center">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element -- data URL; must print as is
          <img
            src={image}
            alt={name ? `Signature of ${name}` : `${title}'s signature`}
            className="relative z-10 max-h-14 max-w-[70%] object-contain"
          />
        ) : pendingHint ? (
          <span className="mb-1 text-center text-[9px] italic text-neutral-500 print:hidden">
            Signature appears when results are published
          </span>
        ) : null}
        {seal ? (
          // eslint-disable-next-line @next/next/no-img-element -- data URL; must print as is
          <img
            src={seal}
            alt="School seal"
            className="absolute right-0 bottom-0 z-0 size-[20mm] object-contain opacity-90 mix-blend-multiply"
          />
        ) : null}
      </div>
      <div className="border-b border-neutral-800" />
      <div className="flex justify-between gap-2 text-[10px] text-neutral-700">
        <span className="min-w-0">
          {name ? <span className="font-semibold text-black">{name}</span> : null}
          {name ? <br /> : null}
          {title}
        </span>
        <span className="shrink-0 self-end">Date: ____________</span>
      </div>
    </div>
  );
}

/**
 * The verification QR, small in the bottom corner. The SVG comes from our server and is shown
 * only through a data URL <img> (never inserted as markup), so nothing in it can run.
 */
function VerificationQr({ verification }: { verification: ReportCardVerification }) {
  if (!verification.qr_svg?.startsWith('<svg')) return null;
  const src = `data:image/svg+xml;utf8,${encodeURIComponent(verification.qr_svg)}`;
  const code = formatVerificationCode(verification.code);
  return (
    <footer className="mt-3 flex items-end justify-end gap-2 break-inside-avoid" aria-label="Verification">
      <div className="text-right text-[9px] leading-tight text-neutral-700">
        <p className="font-semibold text-black">Scan to verify</p>
        <p>
          Code <span className="font-mono font-semibold tracking-wider text-black">{code}</span>
        </p>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element -- data URL; must print as is */}
      <img
        src={src}
        alt={`QR code to verify this report card (code ${code})`}
        className="size-[20mm] shrink-0 bg-white [image-rendering:pixelated]"
      />
    </footer>
  );
}

/** The card's own school details win; the tenant context fills what the card leaves empty. */
function mergeSchool(fromCard: ReportCardSchool | null | undefined, fallback: ReportCardSchool): ReportCardSchool {
  if (!fromCard) return fallback;
  return {
    name: fromCard.name || fallback.name,
    logo: fromCard.logo || fallback.logo || null,
    address: fromCard.address || fallback.address || null,
    motto: fromCard.motto || fallback.motto || null,
    phone: fromCard.phone || fallback.phone || null,
    email: fromCard.email || fallback.email || null,
    seal: fromCard.seal || fallback.seal || null,
  };
}

export function ReportCard({ card, school: schoolProp, hideUnpublished = true, className }: ReportCardProps) {
  const school = mergeSchool(card.school, schoolProp);
  const passMark = card.pass_mark;
  const semesterNumbers = Array.from(
    {
      length: Math.max(
        SEMESTERS,
        ...card.subjects.map((s) => s.semesters.length),
        card.overall.semester_averages.length
      ),
    },
    (_, i) => i + 1
  );
  const periodsPerSemester = Math.max(
    PERIODS_PER_SEMESTER,
    ...card.subjects.flatMap((s) => s.semesters.map((sem) => sem.periods.length))
  );

  const semesterOf = (subjectSemesters: ReportCardSemester[], n: number) =>
    subjectSemesters.find((s) => s.number === n) ?? subjectSemesters[n - 1];

  // Publication is per class and column, so one state per column for the whole card.
  const columns = semesterNumbers.map((n) => {
    const sems = card.subjects.map((s) => semesterOf(s.semesters, n));
    return {
      number: n,
      periods: Array.from({ length: periodsPerSemester }, (_, p) =>
        hideUnpublished ? columnState(sems, (s) => s.published?.periods[p]) : ('open' as ColumnState)
      ),
      exam: hideUnpublished ? columnState(sems, (s) => s.published?.exam) : ('open' as ColumnState),
    };
  });
  const anyUnpublishedSemester = columns.some((c) => c.exam === 'unpublished');
  const allSemestersUnpublished = columns.every((c) => c.exam === 'unpublished');
  // Staff responses carry `published` flags; a staff preview with unpublished columns gets the
  // screen-only "Signature appears when results are published" note where a signature is missing.
  const staffPreviewUnpublished =
    card.subjects.some((s) => s.semesters.some((sem) => sem.published)) &&
    columns.some((c) => c.exam === 'unpublished' || c.periods.includes('unpublished'));

  const passedCount = card.subjects.filter((s) =>
    s.passed !== null ? s.passed : s.yearly_average !== null && !isFailing(s.yearly_average, passMark)
  ).length;
  const yearlyKnown = card.subjects.filter((s) => s.yearly_average !== null).length;
  const hasIncomplete = card.subjects.some((s) => s.semesters.some((sem) => !sem.complete && sem.average !== null));

  const notPublishedNote = (
    <span className="block text-[8px] font-normal normal-case italic text-neutral-600">not published</span>
  );

  const th = 'border border-neutral-800 px-1 py-1 text-center align-middle font-semibold';
  const td = 'border border-neutral-800 px-1 py-[3px] text-center align-middle';

  return (
    <article
      data-slot="report-card"
      aria-label={`Report card for ${card.student.name}`}
      className={cn(
        'rc-sheet mx-auto w-full max-w-[210mm] bg-white p-[10mm] font-sans text-[11px] leading-snug text-black',
        '[print-color-adjust:exact] [-webkit-print-color-adjust:exact]',
        'print:max-w-none print:p-0 print:break-after-page print:last:break-after-auto',
        className
      )}
    >
      {/* School heading */}
      <header className="flex items-center gap-4 border-b-2 border-double border-neutral-800 pb-3">
        <div className="flex size-16 shrink-0 items-center justify-center">
          {school.logo ? (
            // eslint-disable-next-line @next/next/no-img-element -- school logos come from any host; printed as is
            <img src={school.logo} alt="" className="max-h-16 max-w-16 object-contain" />
          ) : null}
        </div>
        <div className="min-w-0 flex-1 text-center">
          <p className="text-lg font-bold uppercase tracking-wide">{school.name}</p>
          {school.address ? <p className="text-[10px]">{school.address}</p> : null}
          {school.phone || school.email ? (
            <p className="text-[10px]">{[school.phone, school.email].filter(Boolean).join(' · ')}</p>
          ) : null}
          {school.motto ? <p className="text-[10px] italic">&ldquo;{school.motto}&rdquo;</p> : null}
          <p className="mt-1 text-sm font-semibold uppercase tracking-wider">Student report card</p>
          {card.year.name ? <p className="text-[11px]">Academic year {card.year.name}</p> : null}
        </div>
        <div className="size-16 shrink-0" aria-hidden="true" />
      </header>

      {/* Student details */}
      <section className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2" aria-label="Student">
        <InfoItem label="Name" value={card.student.name} className="col-span-2" />
        <InfoItem label="Admission no." value={card.student.admission_number} />
        <InfoItem label="Class" value={card.class.name} />
        <InfoItem label="Class sponsor" value={card.class.sponsor_name} />
        <InfoItem label="Pass mark" value={passMark} />
      </section>

      {/* Grades */}
      <table className="mt-3 w-full border-collapse text-[10.5px]">
        <caption className="sr-only">Grades by subject, period and semester</caption>
        <thead>
          <tr className="bg-neutral-100">
            <th scope="col" rowSpan={2} className={cn(th, 'w-[22%] text-left')}>
              Subject
            </th>
            {columns.map((c) => (
              <th key={c.number} scope="colgroup" colSpan={periodsPerSemester + 2} className={th}>
                {ordinal(c.number)} semester
              </th>
            ))}
            <th scope="col" rowSpan={2} className={cn(th, 'w-[7%]')}>
              Yearly
              <br />
              average
              {anyUnpublishedSemester ? notPublishedNote : null}
            </th>
          </tr>
          <tr className="bg-neutral-100">
            {columns.map((c) => (
              <React.Fragment key={c.number}>
                {c.periods.map((state, p) => (
                  <th key={p} scope="col" className={cn(th, 'font-medium')}>
                    {ordinal((c.number - 1) * periodsPerSemester + p + 1)}
                    <span className="sr-only"> period</span>
                    {state === 'unpublished' ? notPublishedNote : null}
                  </th>
                ))}
                <th scope="col" className={cn(th, 'font-medium')}>
                  Exam
                  {c.exam === 'unpublished' ? notPublishedNote : null}
                </th>
                <th scope="col" className={cn(th, 'bg-neutral-200')}>
                  Sem.
                  <br />
                  average
                  {c.exam === 'unpublished' ? notPublishedNote : null}
                </th>
              </React.Fragment>
            ))}
          </tr>
        </thead>
        <tbody>
          {card.subjects.length === 0 ? (
            <tr>
              <td colSpan={2 + columns.length * (periodsPerSemester + 2)} className={cn(td, 'py-4 italic')}>
                No subjects recorded for this class.
              </td>
            </tr>
          ) : (
            card.subjects.map((subject) => (
              <tr key={subject.subject_id || subject.name} className="break-inside-avoid">
                <th scope="row" className={cn(td, 'text-left font-semibold')}>
                  {subject.name}
                </th>
                {columns.map((c) => {
                  const sem = semesterOf(subject.semesters, c.number);
                  const examHidden = c.exam === 'unpublished';
                  return (
                    <React.Fragment key={c.number}>
                      {c.periods.map((state, p) => (
                        <td key={p} className={td}>
                          <Score
                            value={sem?.periods[p] ?? null}
                            passMark={passMark}
                            hidden={state === 'unpublished'}
                          />
                        </td>
                      ))}
                      <td className={td}>
                        <Score value={sem?.exam ?? null} passMark={passMark} hidden={examHidden} />
                      </td>
                      <td className={cn(td, 'bg-neutral-100 font-semibold')}>
                        <Score
                          value={sem?.average ?? null}
                          passMark={passMark}
                          hidden={examHidden}
                          incomplete={sem ? !sem.complete : false}
                        />
                      </td>
                    </React.Fragment>
                  );
                })}
                <td className={cn(td, 'bg-neutral-100 font-bold')}>
                  <Score
                    value={subject.yearly_average}
                    passMark={passMark}
                    hidden={anyUnpublishedSemester}
                    failingOverride={subject.passed === null ? null : !subject.passed}
                  />
                </td>
              </tr>
            ))
          )}
        </tbody>
        <tfoot>
          <tr className="bg-neutral-100 font-bold">
            <th scope="row" className={cn(td, 'text-left')}>
              Average
            </th>
            {columns.map((c, i) => (
              <React.Fragment key={c.number}>
                <td colSpan={periodsPerSemester + 1} className={td} />
                <td className={td}>
                  <Score
                    value={card.overall.semester_averages[i] ?? null}
                    passMark={passMark}
                    hidden={c.exam === 'unpublished'}
                  />
                </td>
              </React.Fragment>
            ))}
            <td className={td}>
              <Score value={card.overall.yearly_average} passMark={passMark} hidden={anyUnpublishedSemester} />
            </td>
          </tr>
        </tfoot>
      </table>

      <p className="mt-1 text-[9px] text-neutral-700">
        <span className="font-bold text-red-700">*</span> Below the pass mark of {passMark}.
        {hasIncomplete ? ' i = incomplete: the average uses only the columns with a score.' : ''} — = no score
        {hideUnpublished && columns.some((c) => c.exam === 'unpublished' || c.periods.includes('unpublished'))
          ? ' or not published yet'
          : ''}
        .
      </p>

      {/* Summary and attendance */}
      <section className="mt-3 grid grid-cols-2 gap-3" aria-label="Summary">
        <div className="border border-neutral-800 p-2">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide">Summary</p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
            {columns.map((c, i) => (
              <React.Fragment key={c.number}>
                <dt>{ordinal(c.number)} semester average</dt>
                <dd className="font-semibold">
                  <Score
                    value={card.overall.semester_averages[i] ?? null}
                    passMark={passMark}
                    hidden={c.exam === 'unpublished'}
                  />
                </dd>
              </React.Fragment>
            ))}
            <dt>Yearly average</dt>
            <dd className="font-semibold">
              <Score value={card.overall.yearly_average} passMark={passMark} hidden={anyUnpublishedSemester} />
            </dd>
            <dt>Rank</dt>
            <dd className="font-semibold">
              {card.overall.rank !== null && !allSemestersUnpublished
                ? `${ordinal(card.overall.rank)}${card.overall.class_size ? ` of ${card.overall.class_size}` : ''}`
                : '—'}
            </dd>
            {yearlyKnown > 0 && !anyUnpublishedSemester ? (
              <>
                <dt>Subjects passed</dt>
                <dd className="font-semibold">
                  {passedCount} of {card.subjects.length}
                </dd>
              </>
            ) : null}
          </dl>
        </div>
        <div className="border border-neutral-800 p-2">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide">Attendance (days)</p>
          {card.attendance ? (
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
              <dt>Present</dt>
              <dd className="font-semibold tabular-nums">{card.attendance.present}</dd>
              <dt>Absent</dt>
              <dd className="font-semibold tabular-nums">{card.attendance.absent}</dd>
              <dt>Late</dt>
              <dd className="font-semibold tabular-nums">{card.attendance.late}</dd>
              <dt>Excused</dt>
              <dd className="font-semibold tabular-nums">{card.attendance.excused}</dd>
            </dl>
          ) : (
            <p className="text-neutral-600">No attendance recorded.</p>
          )}
        </div>
      </section>

      {/* Remarks */}
      <section className="mt-3 space-y-2" aria-label="Remarks">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide">Class sponsor&rsquo;s remarks</p>
          <RuledLines text={card.remarks?.sponsor} />
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide">Principal&rsquo;s remarks</p>
          <RuledLines text={card.remarks?.principal} />
        </div>
      </section>

      {/* Signatures */}
      <section className="mt-5 grid grid-cols-2 gap-8" aria-label="Signatures">
        <SignatureLine
          signature={card.signatures?.sponsor}
          fallbackName={card.class.sponsor_name}
          fallbackTitle="Class sponsor"
          pendingHint={staffPreviewUnpublished}
        />
        <SignatureLine
          signature={card.signatures?.principal}
          fallbackTitle="Principal"
          seal={school.seal}
          pendingHint={staffPreviewUnpublished}
        />
      </section>

      {card.verification?.qr_svg ? <VerificationQr verification={card.verification} /> : null}
    </article>
  );
}
