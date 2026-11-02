'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  AlertTriangle, BarChart3, ClipboardList, FileText, IdCard, Info, Loader2, RefreshCcw, ScanLine, Settings,
} from 'lucide-react';

import { useAuth } from '@/hooks/use-auth';
import { useTenant } from '@/hooks/use-tenant';
import { useDailyAttendanceService } from '@/services/api/daily-attendance-service';
import { AttendanceCounts, DailyOverview } from '@/types/daily-attendance';
import { errorMessageOf } from '@/utils/error-utils';

// Where non-admins go: their own attendance screen
const ROLE_HOME: Record<string, string> = {
  teacher: '/teacher/attendance',
  student: '/student/attendance',
  parent: '/parent/attendance',
  'attendance-scanner': '/attendance/scan',
};

const rate = (value: number | null) => (value === null ? '—' : `${value}%`);

function Tiles({ totals }: { totals: AttendanceCounts }) {
  const tiles = [
    { label: 'Enrolled', value: totals.enrolled, style: 'text-slate-800' },
    { label: 'Present', value: totals.present, style: 'text-emerald-700' },
    { label: 'Late', value: totals.late, style: 'text-orange-600' },
    { label: 'Absent', value: totals.absent, style: 'text-rose-700' },
    { label: 'Excused / sick', value: totals.excused + totals.sick, style: 'text-sky-700' },
    { label: 'Not marked yet', value: totals.unmarked, style: 'text-slate-500' },
    { label: 'Scanned in by card', value: totals.scanned, style: 'text-indigo-700' },
    { label: 'Attendance rate', value: rate(totals.attendance_rate), style: 'text-indigo-700' },
  ];
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {tiles.map(t => (
        <div key={t.label} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">{t.label}</div>
          <div className={`text-3xl font-black mt-1 ${t.style}`}>{t.value}</div>
        </div>
      ))}
    </div>
  );
}

export default function AttendanceOverviewPage() {
  const router = useRouter();
  const { tenant } = useTenant();
  const { user, isLoading: authLoading } = useAuth();
  const { getOverview } = useDailyAttendanceService();

  const [date, setDate] = useState('');
  const [overview, setOverview] = useState<DailyOverview | null>(null);
  const [loading, setLoading] = useState(false);

  const roleNames: string[] = Array.isArray(user?.roles)
    ? user.roles.map((r: unknown) => (typeof r === 'string' ? r : (r as { name?: string })?.name ?? ''))
    : user?.role ? [user.role] : [];
  const isAdmin = roleNames.some(r => ['admin', 'superadmin', 'super-admin'].includes(r));
  // The principal and registrar read the whole school's attendance; only admins run it
  const canView = isAdmin || (user?.permissions ?? []).includes('view_school_attendance');
  const base = `/${tenant?.domain ?? ''}`;

  useEffect(() => {
    if (authLoading || !user || canView) return;
    const home = ROLE_HOME[user.role ?? ''] ?? '/dashboard';
    router.replace(`${base}${home}`);
  }, [authLoading, user, canView, router, base]);

  const load = useCallback(async (day?: string) => {
    setLoading(true);
    try {
      const data = await getOverview(day || undefined);
      setOverview(data);
      setDate(data.day.date);
    } catch (err) {
      toast.error(errorMessageOf(err, 'Failed to load the attendance overview'));
    } finally {
      setLoading(false);
    }
  }, [getOverview]);

  useEffect(() => {
    if (canView) load();
  }, [canView, load]);

  if (authLoading || !user || !canView) {
    return <div className="flex justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-indigo-600" /></div>;
  }

  const links = isAdmin ? [
    { href: '/attendance/daily', label: 'Mark attendance', icon: ClipboardList },
    { href: '/attendance/scan', label: 'Scan ID cards', icon: ScanLine },
    { href: '/attendance/id-cards', label: 'Print ID cards', icon: IdCard },
    { href: '/attendance/reports', label: 'Class reports', icon: BarChart3 },
    { href: '/settings/attendance', label: 'Settings & holidays', icon: Settings },
  ] : [
    { href: '/attendance/reports', label: 'Class reports', icon: BarChart3 },
  ];

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Attendance</h1>
          <p className="text-gray-600 mt-1">
            {tenant?.name}{date ? ` · ${new Date(`${date}T00:00:00`).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={date}
            max={overview?.day.today}
            onChange={e => e.target.value && load(e.target.value)}
            className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-500"
          />
          <button onClick={() => load(date)} disabled={loading} title="Refresh"
            className="p-2 rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-slate-800 disabled:opacity-50">
            <RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {links.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={`${base}${href}`}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            <Icon className="h-4 w-4 text-indigo-600" /> {label}
          </Link>
        ))}
      </div>

      {!overview ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-indigo-600" /></div>
      ) : (
        <>
          {!overview.day.is_school_day && (
            <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <span><b>Not a school day</b>{overview.day.reason ? `: ${overview.day.reason}` : ''}.</span>
            </div>
          )}
          {overview.day.auto_absent_applied && (
            <div className="flex items-start gap-3 rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-800">
              <Info className="h-5 w-5 shrink-0" />
              <span>The cut-off has passed: students who weren&apos;t scanned or marked are recorded absent.</span>
            </div>
          )}
          {isAdmin && overview.pending_excuses > 0 && (
            <Link href={`${base}/attendance/excuses`}
              className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 hover:bg-amber-100">
              <span className="flex items-center gap-3"><FileText className="h-5 w-5" />
                <b>{overview.pending_excuses}</b> absence excuse{overview.pending_excuses === 1 ? '' : 's'} waiting for review
              </span>
              <span className="font-semibold">Review →</span>
            </Link>
          )}

          <Tiles totals={overview.totals} />

          <div className="bg-white rounded-2xl border shadow-sm overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase tracking-wider text-gray-500">
                <tr>
                  <th className="px-5 py-3">Class</th>
                  <th className="px-5 py-3">Sponsor</th>
                  <th className="px-3 py-3 text-right">Enrolled</th>
                  <th className="px-3 py-3 text-right">Present</th>
                  <th className="px-3 py-3 text-right">Late</th>
                  <th className="px-3 py-3 text-right">Absent</th>
                  <th className="px-3 py-3 text-right">Excused / sick</th>
                  <th className="px-3 py-3 text-right">Not marked</th>
                  <th className="px-3 py-3 text-right">By card</th>
                  <th className="px-5 py-3 text-right">Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {overview.classes.length === 0 ? (
                  <tr><td colSpan={10} className="px-5 py-10 text-center text-gray-500">No active classes in this academic year.</td></tr>
                ) : overview.classes.map(c => (
                  <tr key={c.class_id}
                    onClick={isAdmin ? () => router.push(`${base}/attendance/daily?classId=${c.class_id}&date=${overview.day.date}`) : undefined}
                    className={isAdmin ? 'cursor-pointer hover:bg-indigo-50/40' : undefined}>
                    <td className="px-5 py-3 font-semibold text-gray-800">{c.class_name}</td>
                    <td className="px-5 py-3 text-gray-600">{c.sponsor_name ?? <span className="text-amber-600">No sponsor</span>}</td>
                    <td className="px-3 py-3 text-right">{c.enrolled}</td>
                    <td className="px-3 py-3 text-right text-emerald-700 font-semibold">{c.present}</td>
                    <td className="px-3 py-3 text-right text-orange-600">{c.late}</td>
                    <td className="px-3 py-3 text-right text-rose-700">{c.absent}</td>
                    <td className="px-3 py-3 text-right text-sky-700">{c.excused + c.sick}</td>
                    <td className={`px-3 py-3 text-right ${c.unmarked ? 'text-amber-600 font-semibold' : 'text-gray-400'}`}>{c.unmarked}</td>
                    <td className="px-3 py-3 text-right text-indigo-700">{c.scanned}</td>
                    <td className="px-5 py-3 text-right font-semibold">{rate(c.attendance_rate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
