'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, Loader2, Paperclip } from 'lucide-react';

import { useDailyAttendanceService } from '@/services/api/daily-attendance-service';
import { ExcuseStatus, StudentDailyHistory } from '@/types/daily-attendance';
import { errorMessageOf } from '@/utils/error-utils';
import { openExcuseDocument } from '@/utils/excuse-documents';
import { SOURCE_LABELS, STATUS_STYLES } from './daily-status';

const EXCUSE_LABELS: Record<ExcuseStatus, { label: string; style: string }> = {
  pending: { label: 'Excuse pending review', style: 'bg-amber-100 text-amber-700' },
  approved: { label: 'Excuse approved', style: 'bg-sky-100 text-sky-700' },
  rejected: { label: 'Excuse rejected', style: 'bg-rose-100 text-rose-700' },
};

interface DailyAttendanceHistoryProps {
  studentId: string;
  refreshKey?: number; // bump to reload (e.g. after reporting an absence)
}

/** A student's school-day attendance: summary for the period and every recorded day. */
export function DailyAttendanceHistory({ studentId, refreshKey = 0 }: DailyAttendanceHistoryProps) {
  const { getStudentHistory, getExcuseDocument } = useDailyAttendanceService();
  const [history, setHistory] = useState<StudentDailyHistory | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setHistory(await getStudentHistory(studentId));
    } catch (err) {
      setHistory(null);
      setError(errorMessageOf(err, 'Failed to load attendance'));
    } finally {
      setLoading(false);
    }
  }, [studentId, getStudentHistory]);

  useEffect(() => { load(); }, [load, refreshKey]);

  const viewDocument = async (dailyId: string) => {
    try {
      openExcuseDocument(await getExcuseDocument(dailyId));
    } catch (err) {
      toast.error(errorMessageOf(err, 'Failed to open the document'));
    }
  };

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-indigo-600" /></div>;
  }
  if (error || !history) {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
        <AlertTriangle className="h-5 w-5 shrink-0" /> <span>{error}</span>
      </div>
    );
  }

  const { summary, records } = history;
  const tiles = [
    { label: 'Attendance rate', value: summary.attendance_rate === null ? '—' : `${summary.attendance_rate}%`, style: 'text-indigo-700' },
    { label: 'School days', value: summary.school_days, style: 'text-slate-800' },
    { label: 'Present', value: summary.present, style: 'text-emerald-700' },
    { label: 'Late', value: summary.late, style: 'text-orange-600' },
    { label: 'Absent', value: summary.absent, style: 'text-rose-700' },
    { label: 'Excused / sick', value: summary.excused + summary.sick, style: 'text-sky-700' },
  ];

  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-500">
        {new Date(`${history.start_date}T00:00:00`).toLocaleDateString()} – {new Date(`${history.end_date}T00:00:00`).toLocaleDateString()}
      </p>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {tiles.map(t => (
          <div key={t.label} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">{t.label}</div>
            <div className={`text-2xl font-black mt-1 ${t.style}`}>{t.value}</div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {records.length === 0 ? (
          <p className="p-8 text-center text-slate-500">No attendance recorded yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {records.map(r => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <div className="font-semibold text-slate-800">
                    {new Date(`${r.date}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                  </div>
                  <div className="text-xs text-slate-500">
                    {SOURCE_LABELS[r.source]}
                    {r.check_in_at ? ` · in ${new Date(r.check_in_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
                    {r.check_out_at ? ` · out ${new Date(r.check_out_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
                  </div>
                  {r.excuse_reason && <div className="text-xs text-slate-600 mt-1 max-w-xl">{r.excuse_reason}</div>}
                </div>
                <div className="flex items-center gap-2">
                  {r.excuse_status && (
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${EXCUSE_LABELS[r.excuse_status].style}`}>
                      {EXCUSE_LABELS[r.excuse_status].label}
                    </span>
                  )}
                  {r.excuse_document_url && (
                    <button onClick={() => viewDocument(r.id)} title="View document"
                      className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                      <Paperclip className="h-4 w-4" />
                    </button>
                  )}
                  <span className={`px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${STATUS_STYLES[r.status].badge}`}>
                    {STATUS_STYLES[r.status].label}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
