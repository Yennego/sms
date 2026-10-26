'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { errorMessageOf } from '@/utils/error-utils';
import {
  AlertTriangle, Check, Clock, History, Info, Loader2, Save, Stethoscope, Users, X, FileCheck2, Paperclip,
} from 'lucide-react';

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useDailyAttendanceService } from '@/services/api/daily-attendance-service';
import {
  AttendanceEvent, DailyRoster, DailyStatus, DailyStatusInput, ExcuseDocument, ManualDailyStatus,
} from '@/types/daily-attendance';
import { EXCUSE_DOCUMENT_ACCEPT, fileToExcuseDocument, openExcuseDocument } from '@/utils/excuse-documents';
import { SOURCE_LABELS, STATUS_STYLES } from './daily-status';

const EVENT_LABELS: Record<AttendanceEvent['event_type'], string> = {
  scan_accepted: 'Scanned in',
  scan_duplicate: 'Scanned again',
  scan_rejected: 'Scan rejected',
  manual_set: 'Marked manually',
  excuse_set: 'Excuse recorded',
  excuse_reviewed: 'Excuse reviewed',
  auto_absent: 'Auto-marked absent',
};

const QUICK_BUTTONS: Array<{ status: ManualDailyStatus; icon: typeof Check; title: string }> = [
  { status: 'present', icon: Check, title: 'Present' },
  { status: 'late', icon: Clock, title: 'Late' },
  { status: 'absent', icon: X, title: 'Absent' },
  { status: 'excused', icon: FileCheck2, title: 'Excused (needs a reason)' },
  { status: 'sick', icon: Stethoscope, title: 'Sick' },
];

interface DailyRosterPanelProps {
  classId: string;
  date: string; // YYYY-MM-DD
  onDateChange: (date: string) => void;
}

interface ReasonPrompt {
  studentId: string;
  studentName: string;
  status: 'excused' | 'sick';
  text: string;
  file: File | null;
}

export function DailyRosterPanel({ classId, date, onDateChange }: DailyRosterPanelProps) {
  const { getRoster, saveRoster, getEvents, setExcuse, getExcuseDocument } = useDailyAttendanceService();

  const [roster, setRoster] = useState<DailyRoster | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, DailyStatusInput>>({});
  // Documents attached to unsaved excuses, uploaded once the roster is saved
  const [documents, setDocuments] = useState<Record<string, ExcuseDocument>>({});
  const [reasonPrompt, setReasonPrompt] = useState<ReasonPrompt | null>(null);
  const [historyFor, setHistoryFor] = useState<{ name: string; events: AttendanceEvent[] | null } | null>(null);

  const load = useCallback(async () => {
    if (!classId) return;
    setLoading(true);
    setLoadError(null);
    try {
      setRoster(await getRoster(classId, date));
      setEdits({});
      setDocuments({});
    } catch (err) {
      setRoster(null);
      setLoadError(errorMessageOf(err, 'Failed to load the class roster'));
    } finally {
      setLoading(false);
    }
  }, [classId, date, getRoster]);

  useEffect(() => { load(); }, [load]);

  const editable = !!roster?.day.is_school_day;
  const dirtyCount = Object.keys(edits).length;

  const statusOf = useCallback(
    (studentId: string): DailyStatus | null =>
      edits[studentId]?.status ?? roster?.entries.find(e => e.student_id === studentId)?.record?.status ?? null,
    [edits, roster]
  );

  const counts = useMemo(() => {
    const result: Record<string, number> = { unmarked: 0 };
    roster?.entries.forEach(e => {
      const status = statusOf(e.student_id);
      const key = status ?? 'unmarked';
      result[key] = (result[key] || 0) + 1;
    });
    return result;
  }, [roster, statusOf]);

  const setStatus = (studentId: string, studentName: string, status: ManualDailyStatus) => {
    if (status === 'excused' || status === 'sick') {
      const record = roster?.entries.find(e => e.student_id === studentId)?.record;
      setReasonPrompt({
        studentId, studentName, status,
        text: edits[studentId]?.excuse_reason ?? record?.excuse_reason ?? '',
        file: null,
      });
      return;
    }
    setEdits(prev => ({ ...prev, [studentId]: { status } }));
  };

  const confirmReason = async () => {
    if (!reasonPrompt) return;
    const text = reasonPrompt.text.trim();
    if (reasonPrompt.status === 'excused' && !text) {
      toast.error('An excuse reason is required');
      return;
    }
    if (reasonPrompt.status === 'excused' && reasonPrompt.file) {
      try {
        const doc = await fileToExcuseDocument(reasonPrompt.file);
        setDocuments(prev => ({ ...prev, [reasonPrompt.studentId]: doc }));
      } catch (err) {
        toast.error(errorMessageOf(err, 'The file could not be attached'));
        return;
      }
    } else {
      setDocuments(prev => {
        const next = { ...prev };
        delete next[reasonPrompt.studentId];
        return next;
      });
    }
    setEdits(prev => ({
      ...prev,
      [reasonPrompt.studentId]: reasonPrompt.status === 'excused'
        ? { status: 'excused', excuse_reason: text }
        : { status: 'sick', notes: text || undefined },
    }));
    setReasonPrompt(null);
  };

  const markUnmarkedPresent = () => {
    const next = { ...edits };
    roster?.entries.forEach(e => {
      if (!statusOf(e.student_id)) next[e.student_id] = { status: 'present' };
    });
    setEdits(next);
  };

  const onSave = async () => {
    if (!roster || dirtyCount === 0) return;
    setSaving(true);
    try {
      const saved = await saveRoster({
        class_id: classId,
        date,
        entries: Object.entries(edits).map(([student_id, input]) => ({ student_id, ...input })),
      });
      toast.success(`Saved attendance for ${dirtyCount} student${dirtyCount === 1 ? '' : 's'}`);

      // Attach documents to the excuses just saved
      const failed: string[] = [];
      for (const [studentId, doc] of Object.entries(documents)) {
        const record = saved.find(r => r.student_id === studentId);
        const reason = edits[studentId]?.excuse_reason;
        if (!record || !reason) continue;
        try {
          await setExcuse(record.id, reason, doc);
        } catch {
          failed.push(roster.entries.find(e => e.student_id === studentId)?.student_name ?? studentId);
        }
      }
      if (failed.length) toast.error(`Attendance saved, but documents failed to upload for: ${failed.join(', ')}`);
      await load();
    } catch (err) {
      toast.error(errorMessageOf(err, 'Failed to save attendance'));
    } finally {
      setSaving(false);
    }
  };

  const viewDocument = async (dailyId: string) => {
    try {
      openExcuseDocument(await getExcuseDocument(dailyId));
    } catch (err) {
      toast.error(errorMessageOf(err, 'Failed to open the document'));
    }
  };

  const openHistory = async (dailyId: string, name: string) => {
    setHistoryFor({ name, events: null });
    try {
      const events = await getEvents(dailyId);
      setHistoryFor({ name, events });
    } catch (err) {
      setHistoryFor(null);
      toast.error(errorMessageOf(err, 'Failed to load history'));
    }
  };

  return (
    <div className="space-y-6">
      {/* Date + actions */}
      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <label className="font-semibold text-slate-700 text-sm" htmlFor="attendance-date">Date</label>
          <input
            id="attendance-date"
            type="date"
            value={date}
            max={roster?.day.today}
            onChange={e => e.target.value && onDateChange(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
          />
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={markUnmarkedPresent}
            disabled={!editable || !counts.unmarked}
            className="px-3 py-2 text-xs font-bold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 disabled:opacity-50 rounded-lg border border-emerald-100"
          >
            Mark unmarked present
          </button>
          <button
            onClick={onSave}
            disabled={!editable || saving || dirtyCount === 0}
            className="inline-flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white text-sm font-bold rounded-xl shadow-lg shadow-indigo-200"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? 'Saving...' : dirtyCount ? `Save ${dirtyCount} change${dirtyCount === 1 ? '' : 's'}` : 'Saved'}
          </button>
        </div>
      </div>

      {/* Day banner */}
      {roster && !roster.day.is_school_day && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <span><b>Not a school day</b>{roster.day.reason ? `: ${roster.day.reason}` : ''}. Attendance can&apos;t be marked.</span>
        </div>
      )}
      {roster?.day.auto_absent_applied && (
        <div className="flex items-start gap-3 rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-800">
          <Info className="h-5 w-5 shrink-0" />
          <span>The day&apos;s cut-off has passed: students who weren&apos;t marked or scanned are recorded <b>absent (Auto)</b>. You can still correct any student.</span>
        </div>
      )}
      {loadError && (
        <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <span>{loadError}</span>
        </div>
      )}

      {/* Counts */}
      {roster && (
        <div className="flex flex-wrap gap-4 text-sm font-bold text-slate-600">
          {(['present', 'late', 'absent', 'excused', 'sick'] as DailyStatus[]).map(s => (
            <span key={s} className={`px-3 py-1 rounded-full ${STATUS_STYLES[s].badge}`}>
              {STATUS_STYLES[s].label}: {counts[s] || 0}
            </span>
          ))}
          <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-600">Not marked: {counts.unmarked || 0}</span>
        </div>
      )}

      {/* Roster */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-x-auto">
        <table className="w-full border-collapse min-w-[720px]">
          <thead>
            <tr className="bg-slate-50/50">
              <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Student</th>
              <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Admission No.</th>
              <th className="px-6 py-4 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Mark</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={4} className="px-6 py-20 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="h-8 w-8 text-indigo-600 animate-spin" />
                    <span className="text-slate-500">Loading students...</span>
                  </div>
                </td>
              </tr>
            ) : !roster || roster.entries.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-20 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <Users className="h-12 w-12 text-slate-300" />
                    <span className="text-slate-500 font-medium">
                      {roster ? 'No students are enrolled in this class' : 'Select a class to view students'}
                    </span>
                  </div>
                </td>
              </tr>
            ) : (
              roster.entries.map(entry => {
                const status = statusOf(entry.student_id);
                const edit = edits[entry.student_id];
                const record = entry.record;
                const detail = edit
                  ? edit.excuse_reason || edit.notes
                  : record?.excuse_reason || record?.notes;
                return (
                  <tr key={entry.student_id} className={`transition-colors ${edit ? 'bg-indigo-50/40' : 'hover:bg-slate-50/50'}`}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-xs">
                          {entry.student_name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                        </div>
                        <div>
                          <div className="font-bold text-slate-800 text-sm">{entry.student_name}</div>
                          {detail && <div className="text-xs text-slate-500 max-w-[260px] truncate" title={detail}>{detail}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500 font-medium">{entry.admission_number || '-'}</td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col items-center gap-1">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${status ? STATUS_STYLES[status].badge : 'bg-slate-100 text-slate-500'}`}>
                          {status ? STATUS_STYLES[status].label : 'Not marked'}
                        </span>
                        {!edit && record?.excuse_status === 'pending' && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700">Excuse pending review</span>
                        )}
                        <span className="text-[10px] text-slate-400">
                          {edit ? (documents[entry.student_id] ? 'Unsaved · document attached' : 'Unsaved') : record ? `${SOURCE_LABELS[record.source]}${record.check_in_at ? ` · ${new Date(record.check_in_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}` : ''}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-1.5">
                        {QUICK_BUTTONS.map(({ status: s, icon: Icon, title }) => (
                          <button
                            key={s}
                            onClick={() => setStatus(entry.student_id, entry.student_name, s)}
                            disabled={!editable}
                            title={title}
                            className={`p-2 rounded-lg transition-all disabled:opacity-40 ${status === s ? `${STATUS_STYLES[s].button} shadow-lg` : 'bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-700'}`}
                          >
                            <Icon className="h-4 w-4" />
                          </button>
                        ))}
                        {record?.excuse_document_url && (
                          <button
                            onClick={() => viewDocument(record.id)}
                            title="View excuse document"
                            className="p-2 rounded-lg bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                          >
                            <Paperclip className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          onClick={() => record && openHistory(record.id, entry.student_name)}
                          disabled={!record}
                          title="Change history"
                          className="p-2 rounded-lg bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30"
                        >
                          <History className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Excuse / sick reason */}
      <Dialog open={!!reasonPrompt} onOpenChange={open => !open && setReasonPrompt(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{reasonPrompt?.status === 'excused' ? 'Excused absence' : 'Sick'}: {reasonPrompt?.studentName}</DialogTitle>
            <DialogDescription>
              {reasonPrompt?.status === 'excused'
                ? 'Enter the reason for the excuse. Excuses entered by staff are approved immediately.'
                : 'Optional note (e.g. symptoms, who reported it).'}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={reasonPrompt?.text ?? ''}
            onChange={e => setReasonPrompt(p => (p ? { ...p, text: e.target.value } : p))}
            placeholder={reasonPrompt?.status === 'excused' ? 'e.g. Medical appointment, letter from parent' : 'Optional'}
            rows={3}
          />
          {reasonPrompt?.status === 'excused' && (
            <div className="space-y-1">
              <label className="text-sm font-semibold text-slate-700" htmlFor="excuse-file">Supporting document (optional)</label>
              <input
                id="excuse-file"
                type="file"
                accept={EXCUSE_DOCUMENT_ACCEPT}
                onChange={e => {
                  const file = e.target.files?.[0] ?? null;
                  setReasonPrompt(p => (p ? { ...p, file } : p));
                }}
                className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-semibold"
              />
              <p className="text-xs text-slate-400">Photo or PDF of a doctor&apos;s note or parent letter, up to 5 MB.</p>
            </div>
          )}
          <DialogFooter>
            <button onClick={() => setReasonPrompt(null)} className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
            <button onClick={confirmReason} className="px-4 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg">Apply</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change history */}
      <Dialog open={!!historyFor} onOpenChange={open => !open && setHistoryFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change history: {historyFor?.name}</DialogTitle>
            <DialogDescription>Every scan, mark and excuse for this day, oldest first.</DialogDescription>
          </DialogHeader>
          {!historyFor?.events ? (
            <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin text-indigo-600" /></div>
          ) : (
            <ol className="space-y-3 max-h-80 overflow-y-auto">
              {historyFor.events.map(ev => (
                <li key={ev.id} className="rounded-lg border border-slate-100 p-3 text-sm">
                  <div className="flex justify-between gap-3">
                    <span className="font-semibold text-slate-800">{EVENT_LABELS[ev.event_type] ?? ev.event_type}</span>
                    <span className="text-xs text-slate-400">{new Date(ev.occurred_at).toLocaleString()}</span>
                  </div>
                  <div className="text-slate-600">
                    {ev.old_status ? `${ev.old_status} → ` : ''}{ev.new_status ?? ''}
                    {ev.actor_name ? ` · by ${ev.actor_name}` : ev.event_type === 'auto_absent' ? ' · system' : ''}
                    {ev.device_label ? ` · ${ev.device_label}` : ''}
                  </div>
                  {ev.reason && <div className="text-xs text-slate-500 mt-1">{ev.reason}</div>}
                </li>
              ))}
            </ol>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
