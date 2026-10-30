'use client';

// Public report card check (phase4-design.md section 7): the page a printed report card's QR
// opens. No sign-in and outside any school; it shows only what the card's snapshot holds (school,
// student name and admission number, class, year, issue date and averages) with a clear status:
// valid, superseded by a newer card, or not found. Status is always icon + text + colour.
//
// The check goes through the /api/v1 proxy (`verify` is a public area there, sent without the
// visitor's session or school). The backend rate-limits it per visitor: 429 asks to wait a minute.
import * as React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, Loader2, RotateCw, XCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { formatDate } from '@/components/students/format';
import { cn } from '@/lib/utils';
import { formatScore, ordinal } from '@/services/api/results-service';

type VerifyStatus = 'valid' | 'superseded' | 'not_found';

interface VerifiedSubject {
  name: string;
  semester_averages: (number | null)[];
  yearly_average: number | null;
  passed: boolean | null;
}

interface VerifyResult {
  status: VerifyStatus;
  school: { name: string; logo: string | null } | null;
  student: { name: string; admission_number: string | null } | null;
  class_name: string | null;
  year_name: string | null;
  issued_at: string | null;
  superseded_at: string | null;
  subjects: VerifiedSubject[];
  overall: {
    semester_averages: (number | null)[];
    yearly_average: number | null;
    rank: number | null;
    class_size: number | null;
  } | null;
}

class VerifyError extends Error {
  constructor(public status: number) {
    super(`Verification failed (${status})`);
  }
}

// ---------------------------------------------------------------------------------------------
// Reading the response (the backend is built in parallel; accept only what the contract names)
// ---------------------------------------------------------------------------------------------

type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj => Boolean(v) && typeof v === 'object' && !Array.isArray(v);
const text = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v : null);
const num = (v: unknown): number | null => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v);
  return null;
};
const nums = (v: unknown): (number | null)[] => (Array.isArray(v) ? v.map(num) : []);

const NOT_FOUND: VerifyResult = {
  status: 'not_found',
  school: null,
  student: null,
  class_name: null,
  year_name: null,
  issued_at: null,
  superseded_at: null,
  subjects: [],
  overall: null,
};

function readResult(raw: unknown): VerifyResult {
  if (!isObj(raw)) return NOT_FOUND;
  const status: VerifyStatus =
    raw.status === 'valid' || raw.status === 'superseded' ? raw.status : 'not_found';
  if (status === 'not_found') return NOT_FOUND;
  const school = isObj(raw.school) ? raw.school : null;
  const student = isObj(raw.student) ? raw.student : null;
  const overall = isObj(raw.overall) ? raw.overall : null;
  return {
    status,
    school: school ? { name: text(school.name) ?? 'School', logo: text(school.logo) } : null,
    student: student
      ? { name: text(student.name) ?? 'Unnamed student', admission_number: text(student.admission_number) }
      : null,
    class_name: text(raw.class_name),
    year_name: text(raw.year_name),
    issued_at: text(raw.issued_at),
    superseded_at: text(raw.superseded_at),
    subjects: (Array.isArray(raw.subjects) ? raw.subjects : []).filter(isObj).map((s) => ({
      name: text(s.name) ?? 'Subject',
      semester_averages: nums(s.semester_averages),
      yearly_average: num(s.yearly_average),
      passed: typeof s.passed === 'boolean' ? s.passed : null,
    })),
    overall: overall
      ? {
          semester_averages: nums(overall.semester_averages),
          yearly_average: num(overall.yearly_average),
          rank: num(overall.rank),
          class_size: num(overall.class_size),
        }
      : null,
  };
}

/** The code from the address; a malformed escape is passed on as is (the server says "not found"). */
function readCode(value: unknown): string {
  if (typeof value !== 'string') return '';
  try {
    return decodeURIComponent(value).trim();
  } catch {
    return value.trim();
  }
}

async function fetchVerification(code: string): Promise<VerifyResult> {
  const res = await fetch(`/api/v1/verify/report-cards/${encodeURIComponent(code)}`, {
    headers: { accept: 'application/json' },
    cache: 'no-store',
    credentials: 'omit',
  });
  // Unknown and malformed codes are "not found", whether the server says so with 200 or 404
  if (res.status === 404) return NOT_FOUND;
  if (!res.ok) throw new VerifyError(res.status);
  return readResult(await res.json().catch(() => null));
}

// ---------------------------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------------------------

export default function VerifyReportCardPage() {
  const params = useParams<{ code: string }>();
  const code = readCode(params?.code);

  React.useEffect(() => {
    document.title = 'Check a report card';
  }, []);

  const query = useQuery({
    queryKey: ['public-verify-report-card', code],
    queryFn: () => fetchVerification(code),
    enabled: code !== '',
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: Infinity,
  });

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 text-slate-900 sm:py-10">
      <div className="mx-auto w-full max-w-xl space-y-4">
        {code === '' ? (
          <NotFound />
        ) : query.isPending ? (
          <div className="flex items-center justify-center gap-2 py-16 text-base text-slate-600" role="status">
            <Loader2 className="size-5 animate-spin" aria-hidden="true" />
            Checking the report card…
          </div>
        ) : query.isError ? (
          <CheckFailed error={query.error} retrying={query.isFetching} onRetry={() => query.refetch()} />
        ) : (
          <Verified result={query.data} />
        )}
        <p className="pt-2 text-center text-xs text-slate-500">
          This page checks a printed report card against the school&rsquo;s records.
        </p>
      </div>
    </main>
  );
}

function CheckFailed({ error, retrying, onRetry }: { error: Error; retrying: boolean; onRetry: () => void }) {
  const tooMany = error instanceof VerifyError && error.status === 429;
  return (
    <div role="alert" className="rounded-xl border border-slate-300 bg-white p-5 text-center">
      <AlertTriangle className="mx-auto size-8 text-amber-600" aria-hidden="true" />
      <p className="mt-3 text-lg font-semibold">
        {tooMany ? 'Too many checks. Try again in a minute.' : 'We couldn’t check this report card right now.'}
      </p>
      {!tooMany ? (
        <p className="mt-1 text-sm text-slate-600">Check your internet connection, then try again.</p>
      ) : null}
      <Button className="mt-4 min-h-11" variant="outline" onClick={onRetry} disabled={retrying}>
        <RotateCw className={cn('size-4', retrying && 'animate-spin')} aria-hidden="true" />
        Try again
      </Button>
    </div>
  );
}

const STATUS_STYLE: Record<VerifyStatus, { box: string; icon: React.ReactNode }> = {
  valid: {
    box: 'border-green-600 bg-green-50 text-green-900',
    icon: <CheckCircle2 className="size-9 shrink-0 text-green-700" aria-hidden="true" />,
  },
  superseded: {
    box: 'border-amber-500 bg-amber-50 text-amber-950',
    icon: <AlertTriangle className="size-9 shrink-0 text-amber-600" aria-hidden="true" />,
  },
  not_found: {
    box: 'border-red-600 bg-red-50 text-red-900',
    icon: <XCircle className="size-9 shrink-0 text-red-700" aria-hidden="true" />,
  },
};

function StatusBanner({ status, supersededAt }: { status: VerifyStatus; supersededAt?: string | null }) {
  const style = STATUS_STYLE[status];
  let title: string;
  let detail: string | null = null;
  if (status === 'valid') {
    title = 'Valid report card';
    detail = 'This report card was issued by the school and has not been replaced.';
  } else if (status === 'superseded') {
    const date = formatDate(supersededAt);
    title = date
      ? `Superseded: a newer report card was issued on ${date}`
      : 'Superseded: a newer report card was issued';
    detail = 'The marks below are from the older card. Ask the school or the student for the newer one.';
  } else {
    title = 'We couldn’t find this report card';
    detail = 'The code may be wrong, or the paper copy is not genuine. Check the code, or contact the school.';
  }
  return (
    <section role="status" className={cn('flex items-start gap-3 rounded-xl border-2 p-4', style.box)}>
      {style.icon}
      <div className="min-w-0">
        <h1 className="text-xl font-bold leading-snug">{title}</h1>
        {detail ? <p className="mt-1 text-sm">{detail}</p> : null}
      </div>
    </section>
  );
}

function NotFound() {
  return (
    <>
      <StatusBanner status="not_found" />
      <Link
        href="/verify"
        className="flex min-h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-base font-medium text-slate-900 underline-offset-2 hover:underline"
      >
        Check another code
      </Link>
    </>
  );
}

function Verified({ result }: { result: VerifyResult }) {
  if (result.status === 'not_found') return <NotFound />;

  const semesterCount = Math.max(
    result.overall?.semester_averages.length ?? 0,
    ...result.subjects.map((s) => s.semester_averages.length),
    0
  );
  const semesters = Array.from({ length: semesterCount }, (_, i) => i + 1);
  const th = 'px-2 py-2 text-right font-semibold';
  const td = 'px-2 py-2 text-right tabular-nums';

  return (
    <>
      {result.school ? (
        <header className="flex items-center gap-3">
          {result.school.logo ? (
            // eslint-disable-next-line @next/next/no-img-element -- school logos come from any host
            <img src={result.school.logo} alt="" className="size-14 shrink-0 object-contain" />
          ) : null}
          <p className="min-w-0 text-lg font-bold leading-tight">{result.school.name}</p>
        </header>
      ) : null}

      <StatusBanner status={result.status} supersededAt={result.superseded_at} />

      <section aria-label="Student" className="rounded-xl border border-slate-200 bg-white p-4">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-base">
          <dt className="text-slate-600">Student</dt>
          <dd className="font-semibold">{result.student?.name ?? '—'}</dd>
          <dt className="text-slate-600">Admission no.</dt>
          <dd className="font-semibold">{result.student?.admission_number ?? '—'}</dd>
          <dt className="text-slate-600">Class</dt>
          <dd className="font-semibold">{result.class_name ?? '—'}</dd>
          <dt className="text-slate-600">School year</dt>
          <dd className="font-semibold">{result.year_name ?? '—'}</dd>
          <dt className="text-slate-600">Issued</dt>
          <dd className="font-semibold">{formatDate(result.issued_at) || '—'}</dd>
        </dl>
      </section>

      <section aria-label="Marks" className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">Averages by subject</caption>
            <thead className="bg-slate-100 text-slate-700">
              <tr>
                <th scope="col" className="px-2 py-2 text-left font-semibold">
                  Subject
                </th>
                {semesters.map((n) => (
                  <th key={n} scope="col" className={th}>
                    {ordinal(n)} sem.
                  </th>
                ))}
                <th scope="col" className={th}>
                  Year
                </th>
                <th scope="col" className="px-2 py-2 text-left font-semibold">
                  Result
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {result.subjects.length === 0 ? (
                <tr>
                  <td colSpan={semesterCount + 3} className="px-2 py-4 text-center text-slate-600">
                    No subjects on this report card.
                  </td>
                </tr>
              ) : (
                result.subjects.map((s, i) => (
                  <tr key={`${s.name}-${i}`}>
                    <th scope="row" className="px-2 py-2 text-left font-medium">
                      {s.name}
                    </th>
                    {semesters.map((n) => (
                      <td key={n} className={td}>
                        {formatScore(s.semester_averages[n - 1] ?? null)}
                      </td>
                    ))}
                    <td className={cn(td, 'font-semibold')}>{formatScore(s.yearly_average)}</td>
                    <td className="px-2 py-2">
                      <PassResult passed={s.passed} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {result.overall ? (
              <tfoot className="border-t-2 border-slate-200 bg-slate-50 font-semibold">
                <tr>
                  <th scope="row" className="px-2 py-2 text-left">
                    Average
                  </th>
                  {semesters.map((n) => (
                    <td key={n} className={td}>
                      {formatScore(result.overall?.semester_averages[n - 1] ?? null)}
                    </td>
                  ))}
                  <td className={td}>{formatScore(result.overall.yearly_average)}</td>
                  <td className="px-2 py-2 text-left text-xs font-normal text-slate-600">
                    {result.overall.rank !== null
                      ? `Rank ${ordinal(result.overall.rank)}${
                          result.overall.class_size ? ` of ${result.overall.class_size}` : ''
                        }`
                      : null}
                  </td>
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
      </section>

      <p className="rounded-xl border border-slate-200 bg-white p-4 text-base font-medium">
        Compare these marks with the paper copy. If they differ, the paper copy was changed.
      </p>
    </>
  );
}

function PassResult({ passed }: { passed: boolean | null }) {
  if (passed === null) return <span className="text-slate-500">—</span>;
  return passed ? (
    <span className="inline-flex items-center gap-1 whitespace-nowrap text-green-800">
      <CheckCircle2 className="size-4" aria-hidden="true" />
      Passed
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 whitespace-nowrap font-semibold text-red-700">
      <XCircle className="size-4" aria-hidden="true" />
      Below pass mark
    </span>
  );
}
