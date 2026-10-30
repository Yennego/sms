'use client';

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, ClipboardList, Loader2, Send } from 'lucide-react';

import { DailyAttendanceHistory } from '@/components/attendance/DailyAttendanceHistory';
import { ChildSwitcher } from '@/components/parent/child-switcher';
import { Textarea } from '@/components/ui/textarea';
import { useDailyAttendanceService } from '@/services/api/daily-attendance-service';
import { ChildSummary, DailyAttendanceRecord } from '@/types/daily-attendance';
import { errorMessageOf } from '@/utils/error-utils';
import { EXCUSE_DOCUMENT_ACCEPT, fileToExcuseDocument } from '@/utils/excuse-documents';

const isoDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const shift = (iso: string, days: number) => {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return isoDate(d);
};

export default function ParentAttendancePage() {
  const { getMyChildren, getDayInfo, submitParentExcuse, getStudentHistory } = useDailyAttendanceService();

  const [children, setChildren] = useState<ChildSummary[] | null>(null);
  const [childId, setChildId] = useState('');
  const [today, setToday] = useState(isoDate(new Date()));
  const [refreshKey, setRefreshKey] = useState(0);

  const [date, setDate] = useState('');
  const [reason, setReason] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  // Recent absences with no excuse: shown as an alert so parents can explain them
  const [unexcused, setUnexcused] = useState<DailyAttendanceRecord[]>([]);
  const reasonRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    getMyChildren()
      .then(list => {
        setChildren(list);
        // Links from the parent home carry ?child=
        const wanted = new URLSearchParams(window.location.search).get('child');
        if (list.length > 0) setChildId(list.find(c => c.student_id === wanted)?.student_id ?? list[0].student_id);
      })
      .catch((err: unknown) => {
        setChildren([]);
        toast.error(errorMessageOf(err, 'Failed to load your children'));
      });
    getDayInfo().then(info => setToday(info.today)).catch(() => { /* keep browser date */ });
  }, [getMyChildren, getDayInfo]);

  useEffect(() => {
    if (!childId) return;
    let cancelled = false;
    getStudentHistory(childId, shift(today, -14), today)
      .then(h => {
        if (!cancelled) setUnexcused(h.records.filter(r => r.status === 'absent' && !r.excuse_status));
      })
      .catch(() => { if (!cancelled) setUnexcused([]); });
    return () => { cancelled = true; };
  }, [childId, today, refreshKey, getStudentHistory]);

  const explain = (day: string) => {
    setDate(day);
    reasonRef.current?.focus();
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!childId || !date || reason.trim().length < 3) {
      toast.error('Choose a date and describe the reason');
      return;
    }
    setSubmitting(true);
    try {
      const document = file ? await fileToExcuseDocument(file) : undefined;
      await submitParentExcuse({ student_id: childId, date, reason: reason.trim(), document });
      toast.success('Absence reported. The school will review it.');
      setDate('');
      setReason('');
      setFile(null);
      setFileInputKey(k => k + 1);
      setRefreshKey(k => k + 1);
    } catch (err) {
      toast.error(errorMessageOf(err, 'Failed to report the absence'));
    } finally {
      setSubmitting(false);
    }
  };

  const child = children?.find(c => c.student_id === childId);

  return (
    <div className="min-h-screen bg-[#f8fafc] p-6 lg:p-10">
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-3">
              <ClipboardList className="h-8 w-8 text-indigo-600" /> Attendance
            </h1>
            <p className="text-slate-500 mt-1">
              {child ? `${child.name}${child.class_name ? ` · ${child.class_name}` : ''}` : 'Your children’s school-day attendance'}
            </p>
          </div>
          {children && <ChildSwitcher items={children} value={childId} onChange={setChildId} />}
        </div>

        {children === null ? (
          <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-indigo-600" /></div>
        ) : children.length === 0 ? (
          <p className="text-slate-500">No children are linked to your account. Please contact the school office.</p>
        ) : (
          <>
          {unexcused.length > 0 && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900 space-y-2">
              <div className="flex items-center gap-2 font-bold">
                <AlertTriangle className="h-5 w-5" />
                {child?.name ?? 'Your child'} was absent without an excuse on {unexcused.length} day{unexcused.length === 1 ? '' : 's'}
              </div>
              <div className="flex flex-wrap gap-2">
                {unexcused.map(r => (
                  <button key={r.id} onClick={() => explain(r.date)}
                    className="px-3 py-1.5 rounded-lg bg-white border border-rose-200 font-semibold hover:bg-rose-100">
                    {new Date(`${r.date}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} · Report a reason
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-8 items-start">
            {childId && <DailyAttendanceHistory studentId={childId} refreshKey={refreshKey} />}

            <form onSubmit={onSubmit} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
              <div>
                <h2 className="text-lg font-bold text-slate-800">Report an absence</h2>
                <p className="text-xs text-slate-500">For a past day (up to 14 days ago) or a planned absence (up to 30 days ahead).</p>
              </div>
              <div className="space-y-1">
                <label htmlFor="absence-date" className="text-sm font-semibold text-slate-700">Date</label>
                <input
                  id="absence-date"
                  type="date"
                  value={date}
                  min={shift(today, -14)}
                  max={shift(today, 30)}
                  onChange={e => setDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-500"
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="absence-reason" className="text-sm font-semibold text-slate-700">Reason</label>
                <Textarea ref={reasonRef} id="absence-reason" rows={3} value={reason} maxLength={2000}
                  onChange={e => setReason(e.target.value)} placeholder="e.g. Fever, medical appointment, family emergency" />
              </div>
              <div className="space-y-1">
                <label htmlFor="absence-file" className="text-sm font-semibold text-slate-700">Supporting document (optional)</label>
                <input
                  key={fileInputKey}
                  id="absence-file"
                  type="file"
                  accept={EXCUSE_DOCUMENT_ACCEPT}
                  onChange={e => setFile(e.target.files?.[0] ?? null)}
                  className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-semibold"
                />
                <p className="text-xs text-slate-400">Photo or PDF, up to 5 MB.</p>
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white text-sm font-bold rounded-xl"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Submit
              </button>
            </form>
          </div>
          </>
        )}
      </div>
    </div>
  );
}
