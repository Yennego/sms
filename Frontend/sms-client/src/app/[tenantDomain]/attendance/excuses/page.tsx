'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Check, FileText, Loader2, Paperclip, X } from 'lucide-react';

import PermissionGuard from '@/components/auth/permission-guard';
import { STATUS_STYLES } from '@/components/attendance/daily-status';
import { useDailyAttendanceService } from '@/services/api/daily-attendance-service';
import { ExcuseListItem, ExcuseStatus } from '@/types/daily-attendance';
import { errorMessageOf } from '@/utils/error-utils';
import { openExcuseDocument } from '@/utils/excuse-documents';

const TABS: Array<{ status: ExcuseStatus; label: string }> = [
  { status: 'pending', label: 'Pending' },
  { status: 'approved', label: 'Approved' },
  { status: 'rejected', label: 'Rejected' },
];

export default function ExcuseReviewPage() {
  const { listExcuses, reviewExcuse, getExcuseDocument } = useDailyAttendanceService();
  const [tab, setTab] = useState<ExcuseStatus>('pending');
  const [items, setItems] = useState<ExcuseListItem[] | null>(null);
  const [working, setWorking] = useState<string | null>(null);

  const load = useCallback(async () => {
    setItems(null);
    try {
      setItems(await listExcuses(tab));
    } catch (err) {
      setItems([]);
      toast.error(errorMessageOf(err, 'Failed to load excuses'));
    }
  }, [tab, listExcuses]);

  useEffect(() => { load(); }, [load]);

  const review = async (item: ExcuseListItem, approve: boolean) => {
    let notes: string | undefined;
    if (!approve) {
      const answer = window.prompt(`Reason for rejecting ${item.student_name}'s excuse (shared with staff):`);
      if (answer === null) return;
      notes = answer.trim() || undefined;
    }
    setWorking(item.daily_id);
    try {
      await reviewExcuse(item.daily_id, approve, notes);
      setItems(prev => prev?.filter(i => i.daily_id !== item.daily_id) ?? prev);
      toast.success(approve ? 'Excuse approved' : 'Excuse rejected');
    } catch (err) {
      toast.error(errorMessageOf(err, 'Failed to review the excuse'));
    } finally {
      setWorking(null);
    }
  };

  const viewDocument = async (dailyId: string) => {
    try {
      openExcuseDocument(await getExcuseDocument(dailyId));
    } catch (err) {
      toast.error(errorMessageOf(err, 'Failed to open the document'));
    }
  };

  return (
    <PermissionGuard requiredRole="admin" fallback={<div>You do not have permission to access this page.</div>}>
      <div className="container mx-auto p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3"><FileText className="h-8 w-8" /> Absence Excuses</h1>
          <p className="text-gray-600 mt-1">Excuses reported by parents wait here for approval. Excuses entered by class sponsors are approved automatically.</p>
        </div>

        <div className="flex gap-2">
          {TABS.map(t => (
            <button key={t.status} onClick={() => setTab(t.status)}
              className={`px-4 py-2 rounded-lg text-sm font-bold ${tab === t.status ? 'bg-indigo-600 text-white' : 'bg-white border text-gray-600 hover:bg-gray-50'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {items === null ? (
          <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-indigo-600" /></div>
        ) : items.length === 0 ? (
          <p className="text-gray-500">No {tab} excuses.</p>
        ) : (
          <div className="bg-white rounded-2xl border shadow-sm overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase tracking-wider text-gray-500">
                <tr>
                  <th className="px-5 py-3">Student</th>
                  <th className="px-5 py-3">Date</th>
                  <th className="px-5 py-3">Reason</th>
                  <th className="px-5 py-3">Submitted</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {items.map(item => (
                  <tr key={item.daily_id}>
                    <td className="px-5 py-3">
                      <div className="font-semibold text-gray-800">{item.student_name}</div>
                      <div className="text-xs text-gray-500">{item.class_name}</div>
                    </td>
                    <td className="px-5 py-3">
                      <div>{new Date(`${item.date}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</div>
                      <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${STATUS_STYLES[item.status].badge}`}>
                        {STATUS_STYLES[item.status].label}
                      </span>
                    </td>
                    <td className="px-5 py-3 max-w-sm text-gray-700">{item.excuse_reason}</td>
                    <td className="px-5 py-3 text-xs text-gray-500">
                      {item.submitted_by_name ?? '—'}
                      <div>{new Date(item.submitted_at).toLocaleString()}</div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-2">
                        {item.has_document && (
                          <button onClick={() => viewDocument(item.daily_id)} title="View document"
                            className="p-2 rounded-lg bg-gray-50 text-gray-500 hover:bg-gray-100"><Paperclip className="h-4 w-4" /></button>
                        )}
                        {tab === 'pending' && (
                          <>
                            <button onClick={() => review(item, true)} disabled={working === item.daily_id}
                              className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-emerald-600 text-white font-semibold disabled:opacity-50">
                              <Check className="h-4 w-4" /> Approve
                            </button>
                            <button onClick={() => review(item, false)} disabled={working === item.daily_id}
                              className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-rose-50 text-rose-700 font-semibold disabled:opacity-50">
                              <X className="h-4 w-4" /> Reject
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </PermissionGuard>
  );
}
