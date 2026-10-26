'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ClipboardList, Loader2, Send } from 'lucide-react';

import { DailyAttendanceHistory } from '@/components/attendance/DailyAttendanceHistory';
import { Textarea } from '@/components/ui/textarea';
import { useDailyAttendanceService } from '@/services/api/daily-attendance-service';
import { ChildSummary } from '@/types/daily-attendance';
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
  const { getMyChildren, getDayInfo, submitParentExcuse } = useDailyAttendanceService();

  const [children, setChildren] = useState<ChildSummary[] | null>(null);
  const [childId, setChildId] = useState('');
  const [today, setToday] = useState(isoDate(new Date()));
  const [refreshKey, setRefreshKey] = useState(0);

  const [date, setDate] = useState('');
  const [reason, setReason] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    getMyChildren()
      .then(list => {
        setChildren(list);
        if (list.length > 0) setChildId(list[0].student_id);
      })
      .catch((err: unknown) => {
        setChildren([]);
        toast.error(errorMessageOf(err, 'Failed to load your children'));
      });
    getDayInfo().then(info => setToday(info.today)).catch(() => { /* keep browser date */ });
  }, [getMyChildren, getDayInfo]);

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
          {children && children.length > 1 && (
            <select
              value={childId}
              onChange={e => setChildId(e.target.value)}
              className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 outline-none focus:border-indigo-500"
            >
              {children.map(c => <option key={c.student_id} value={c.student_id}>{c.name}</option>)}
            </select>
          )}
        </div>

        {children === null ? (
          <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-indigo-600" /></div>
        ) : children.length === 0 ? (
          <p className="text-slate-500">No children are linked to your account. Please contact the school office.</p>
        ) : (
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
                <Textarea id="absence-reason" rows={3} value={reason} maxLength={2000}
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
        )}
      </div>
    </div>
  );
}
