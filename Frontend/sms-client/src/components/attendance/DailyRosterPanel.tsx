'use client';

// A class's roster for one school day (Mark, and the sponsor's My class). Phone first (design brief
// section 3: a teacher marks standing in a classroom, one-handed): one card per student with five
// large, labelled status buttons, and a save bar that stays at the bottom while changes are unsaved.
// Excused needs a reason (and may carry a document); every change is in the day's history.

import * as React from 'react';
import {
  Check,
  Clock,
  FileCheck2,
  History,
  Loader2,
  Paperclip,
  Save,
  Stethoscope,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';

import { DailyStatusBadge, DayNotices, dailyStatusLabel } from '@/components/attendance/attendance-ui';
import { SOURCE_LABELS } from '@/components/attendance/daily-status';
import { useAttendanceEvents, useClassRoster, useSaveRoster } from '@/components/attendance/queries';
import { errorMessage, formatTime } from '@/components/students/format';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/ui/status-badge';
import { Textarea } from '@/components/ui/textarea';
import { notify } from '@/components/ui/toaster';
import { cn } from '@/lib/utils';
import { useDailyAttendanceService } from '@/services/api/daily-attendance-service';
import type {
  AttendanceEvent,
  DailyStatus,
  DailyStatusInput,
  ExcuseDocument,
  ManualDailyStatus,
} from '@/types/daily-attendance';
import { EXCUSE_DOCUMENT_ACCEPT, fileToExcuseDocument, openExcuseDocument } from '@/utils/excuse-documents';

const EVENT_LABELS: Record<AttendanceEvent['event_type'], string> = {
  scan_accepted: 'Scanned in',
  scan_duplicate: 'Scanned again',
  scan_rejected: 'Scan refused',
  manual_set: 'Marked by hand',
  excuse_set: 'Excuse recorded',
  excuse_reviewed: 'Excuse reviewed',
  auto_absent: 'Marked absent after the cut-off',
};

// Selected buttons take the fixed status colours (design brief 4.1); the label is always shown
const BUTTONS: Array<{ status: ManualDailyStatus; label: string; icon: LucideIcon; on: string }> = [
  { status: 'present', label: 'Present', icon: Check, on: 'border-green-700 bg-green-700 text-white' },
  { status: 'late', label: 'Late', icon: Clock, on: 'border-orange-600 bg-orange-600 text-white' },
  { status: 'absent', label: 'Absent', icon: X, on: 'border-red-700 bg-red-700 text-white' },
  { status: 'excused', label: 'Excused', icon: FileCheck2, on: 'border-blue-700 bg-blue-700 text-white' },
  { status: 'sick', label: 'Sick', icon: Stethoscope, on: 'border-blue-700 bg-blue-700 text-white' },
];

interface DailyRosterPanelProps {
  classId: string;
  date: string; // YYYY-MM-DD, "" for the school's today
}

interface ReasonPrompt {
  studentId: string;
  studentName: string;
  status: 'excused' | 'sick';
  text: string;
  file: File | null;
  error?: string;
}

const initials = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

export function DailyRosterPanel({ classId, date }: DailyRosterPanelProps) {
  const roster = useClassRoster(classId, date);
  const save = useSaveRoster();
  const { getExcuseDocument } = useDailyAttendanceService();

  const [edits, setEdits] = React.useState<Record<string, DailyStatusInput>>({});
  // Documents for unsaved excuses, uploaded once the marks are saved
  const [documents, setDocuments] = React.useState<Record<string, ExcuseDocument>>({});
  const [reasonPrompt, setReasonPrompt] = React.useState<ReasonPrompt | null>(null);
  const [historyFor, setHistoryFor] = React.useState<{ dailyId: string; name: string } | null>(null);
  const events = useAttendanceEvents(historyFor?.dailyId ?? null);

  // A different class or day starts clean
  React.useEffect(() => {
    setEdits({});
    setDocuments({});
  }, [classId, date]);

  const data = roster.data;
  const editable = Boolean(data?.day.is_school_day);
  const dirtyCount = Object.keys(edits).length;

  const statusOf = React.useCallback(
    (studentId: string): DailyStatus | null =>
      edits[studentId]?.status ?? data?.entries.find((e) => e.student_id === studentId)?.record?.status ?? null,
    [edits, data]
  );

  const counts = React.useMemo(() => {
    const result: Record<string, number> = { unmarked: 0 };
    data?.entries.forEach((e) => {
      const key = statusOf(e.student_id) ?? 'unmarked';
      result[key === 'tardy' ? 'late' : key] = (result[key === 'tardy' ? 'late' : key] || 0) + 1;
    });
    return result;
  }, [data, statusOf]);

  const choose = (studentId: string, studentName: string, status: ManualDailyStatus) => {
    if (status === 'excused' || status === 'sick') {
      const record = data?.entries.find((e) => e.student_id === studentId)?.record;
      setReasonPrompt({
        studentId,
        studentName,
        status,
        text: edits[studentId]?.excuse_reason ?? edits[studentId]?.notes ?? record?.excuse_reason ?? record?.notes ?? '',
        file: null,
      });
      return;
    }
    setEdits((prev) => ({ ...prev, [studentId]: { status } }));
  };

  const applyReason = async () => {
    if (!reasonPrompt) return;
    const text = reasonPrompt.text.trim();
    if (reasonPrompt.status === 'excused' && !text) {
      setReasonPrompt({ ...reasonPrompt, error: 'Write the reason, for example "Medical appointment".' });
      return;
    }
    const { studentId } = reasonPrompt;
    if (reasonPrompt.status === 'excused' && reasonPrompt.file) {
      try {
        const doc = await fileToExcuseDocument(reasonPrompt.file);
        setDocuments((prev) => ({ ...prev, [studentId]: doc }));
      } catch (err) {
        setReasonPrompt({ ...reasonPrompt, error: errorMessage(err, "The file couldn't be attached. Try a smaller photo or PDF.") });
        return;
      }
    } else {
      setDocuments((prev) => {
        const next = { ...prev };
        delete next[studentId];
        return next;
      });
    }
    setEdits((prev) => ({
      ...prev,
      [studentId]:
        reasonPrompt.status === 'excused'
          ? { status: 'excused', excuse_reason: text }
          : { status: 'sick', notes: text || undefined },
    }));
    setReasonPrompt(null);
  };

  const markRestPresent = () => {
    const next = { ...edits };
    data?.entries.forEach((e) => {
      if (!statusOf(e.student_id)) next[e.student_id] = { status: 'present' };
    });
    setEdits(next);
  };

  const onSave = async () => {
    if (!data || dirtyCount === 0) return;
    try {
      const { failedDocuments } = await save.mutateAsync({
        input: {
          class_id: classId,
          date: data.day.date,
          entries: Object.entries(edits).map(([student_id, input]) => ({ student_id, ...input })),
        },
        documents,
      });
      notify.success(`Attendance saved for ${dirtyCount} ${dirtyCount === 1 ? 'student' : 'students'}.`);
      if (failedDocuments.length) {
        const names = failedDocuments.map((id) => data.entries.find((e) => e.student_id === id)?.student_name ?? id);
        notify.error(`The marks are saved, but these documents didn't upload: ${names.join(', ')}. Open Excused again to attach them.`);
      }
      setEdits({});
      setDocuments({});
    } catch (err) {
      notify.error(`${errorMessage(err, "The marks weren't saved.")} Nothing was lost on this screen; try Save again.`);
    }
  };

  const viewDocument = async (dailyId: string) => {
    try {
      openExcuseDocument(await getExcuseDocument(dailyId));
    } catch (err) {
      notify.error(errorMessage(err, "The document couldn't be opened."));
    }
  };

  if (roster.isLoading) {
    return (
      <div className="space-y-3" aria-busy="true" aria-label="Loading the class">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full rounded-xl" />
        ))}
      </div>
    );
  }
  if (roster.isError || !data) {
    return (
      <EmptyState
        icon={Users}
        title="The class didn't load"
        description={`${errorMessage(roster.error, 'The server didn’t answer.')} Check your connection and try again.`}
        action={<Button onClick={() => roster.refetch()}>Try again</Button>}
      />
    );
  }

  return (
    <div className="space-y-4 pb-24">
      <DayNotices day={data.day} marking />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <ul className="flex flex-wrap gap-2" aria-label="Counts">
          {(['present', 'late', 'absent', 'excused', 'sick'] as const).map((s) => (
            <li key={s}>
              <StatusBadge status={s} label={`${dailyStatusLabel(s)}: ${counts[s] || 0}`} size="md" />
            </li>
          ))}
          <li>
            <StatusBadge status="neutral" label={`Not marked: ${counts.unmarked || 0}`} size="md" />
          </li>
        </ul>
        <Button
          variant="outline"
          className="min-h-11 md:min-h-9"
          onClick={markRestPresent}
          disabled={!editable || !counts.unmarked}
        >
          <Check aria-hidden="true" />
          Mark the rest present
        </Button>
      </div>

      {data.entries.length === 0 ? (
        <EmptyState
          icon={Users}
          description="No students are enrolled in this class yet. Admit or import them under Students."
        />
      ) : (
        <ul className="space-y-3" aria-label={`Students in ${data.class_name ?? 'this class'}`}>
          {data.entries.map((entry) => {
            const status = statusOf(entry.student_id);
            const edit = edits[entry.student_id];
            const record = entry.record;
            const detail = edit ? edit.excuse_reason || edit.notes : record?.excuse_reason || record?.notes;
            const source = record
              ? [SOURCE_LABELS[record.source], record.check_in_at ? `in ${formatTime(record.check_in_at)}` : '']
                  .filter(Boolean)
                  .join(' · ')
              : '';
            return (
              <li
                key={entry.student_id}
                className={cn('rounded-xl border bg-card p-3 sm:p-4', edit && 'border-primary/40 bg-primary/5')}
              >
                <div className="flex items-start gap-3">
                  <span
                    className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold"
                    aria-hidden="true"
                  >
                    {initials(entry.student_name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{entry.student_name}</p>
                    <p className="text-sm text-muted-foreground">
                      {[entry.admission_number, edit ? (documents[entry.student_id] ? 'Not saved yet · document attached' : 'Not saved yet') : source]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                    {detail ? <p className="mt-1 text-sm text-muted-foreground">{detail}</p> : null}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <DailyStatusBadge status={status} />
                    {!edit && record?.excuse_status === 'pending' ? (
                      <StatusBadge status="pending" label="Excuse waiting for review" />
                    ) : null}
                  </div>
                </div>

                <div
                  role="group"
                  aria-label={`Status for ${entry.student_name}`}
                  className="mt-3 grid grid-cols-5 gap-1.5 sm:flex sm:flex-wrap sm:gap-2"
                >
                  {BUTTONS.map(({ status: s, label, icon: Icon, on }) => {
                    const selected = status === s || (s === 'late' && status === 'tardy');
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => choose(entry.student_id, entry.student_name, s)}
                        disabled={!editable}
                        aria-pressed={selected}
                        className={cn(
                          'flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-lg border px-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-10 sm:flex-row sm:gap-1.5 sm:px-3 sm:text-sm',
                          selected ? on : 'bg-background hover:bg-muted'
                        )}
                      >
                        <Icon className="size-4" aria-hidden="true" />
                        {label}
                      </button>
                    );
                  })}
                  <div className="col-span-5 flex gap-2 sm:col-span-1 sm:ml-auto">
                    {record?.excuse_document_url ? (
                      <Button variant="ghost" size="sm" className="min-h-11 md:min-h-9" onClick={() => viewDocument(record.id)}>
                        <Paperclip aria-hidden="true" />
                        Document
                      </Button>
                    ) : null}
                    {record ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="min-h-11 md:min-h-9"
                        onClick={() => setHistoryFor({ dailyId: record.id, name: entry.student_name })}
                      >
                        <History aria-hidden="true" />
                        History
                      </Button>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Save bar: stays on screen while there are unsaved marks */}
      {dirtyCount > 0 ? (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 p-3 shadow-lg backdrop-blur md:left-auto md:right-6 md:bottom-6 md:rounded-xl md:border">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
            <p className="text-sm font-medium" aria-live="polite">
              {dirtyCount} {dirtyCount === 1 ? 'change' : 'changes'} not saved
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="min-h-11 md:min-h-9"
                onClick={() => {
                  setEdits({});
                  setDocuments({});
                }}
                disabled={save.isPending}
              >
                Undo
              </Button>
              <Button className="min-h-11 md:min-h-9" onClick={onSave} disabled={save.isPending}>
                {save.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Save aria-hidden="true" />}
                Save attendance
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Excused (reason, optional document) or sick (optional note) */}
      <Dialog open={Boolean(reasonPrompt)} onOpenChange={(open) => !open && setReasonPrompt(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {reasonPrompt?.status === 'excused' ? 'Excused' : 'Sick'}: {reasonPrompt?.studentName}
            </DialogTitle>
            <DialogDescription>
              {reasonPrompt?.status === 'excused'
                ? 'Write the reason. Excuses entered by staff are approved straight away.'
                : 'Add a note if you like, for example who reported it.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <label htmlFor="reason-text" className="text-sm font-medium">
              {reasonPrompt?.status === 'excused' ? 'Reason' : 'Note (optional)'}
            </label>
            <Textarea
              id="reason-text"
              value={reasonPrompt?.text ?? ''}
              onChange={(e) => setReasonPrompt((p) => (p ? { ...p, text: e.target.value, error: undefined } : p))}
              placeholder={reasonPrompt?.status === 'excused' ? 'For example: Medical appointment, letter from parent' : ''}
              rows={3}
              aria-invalid={Boolean(reasonPrompt?.error) || undefined}
              aria-describedby={reasonPrompt?.error ? 'reason-error' : undefined}
            />
            {reasonPrompt?.error ? (
              <p id="reason-error" role="alert" className="text-sm text-destructive">
                {reasonPrompt.error}
              </p>
            ) : null}
          </div>
          {reasonPrompt?.status === 'excused' ? (
            <div className="grid gap-2">
              <label htmlFor="excuse-file" className="text-sm font-medium">
                Supporting document (optional)
              </label>
              <input
                id="excuse-file"
                type="file"
                accept={EXCUSE_DOCUMENT_ACCEPT}
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  setReasonPrompt((p) => (p ? { ...p, file, error: undefined } : p));
                }}
                className="block w-full text-sm file:mr-3 file:min-h-11 file:rounded-md file:border-0 file:bg-muted file:px-3 file:text-sm file:font-medium md:file:min-h-9"
              />
              <p className="text-sm text-muted-foreground">A photo or PDF of a doctor&apos;s note or a parent&apos;s letter, up to 5 MB.</p>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" className="min-h-11 md:min-h-9" onClick={() => setReasonPrompt(null)}>
              Cancel
            </Button>
            <Button className="min-h-11 md:min-h-9" onClick={applyReason}>
              Mark {reasonPrompt?.status === 'excused' ? 'excused' : 'sick'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* The day's history for one student */}
      <Dialog open={Boolean(historyFor)} onOpenChange={(open) => !open && setHistoryFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>History: {historyFor?.name}</DialogTitle>
            <DialogDescription>Every scan, mark and excuse for this day, oldest first.</DialogDescription>
          </DialogHeader>
          {events.isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : events.isError ? (
            <p role="alert" className="text-sm text-destructive">
              {errorMessage(events.error, "The history didn't load.")}
            </p>
          ) : (
            <ol className="max-h-80 space-y-2 overflow-y-auto">
              {(events.data ?? []).map((ev) => (
                <li key={ev.id} className="rounded-lg border p-3 text-sm">
                  <div className="flex justify-between gap-3">
                    <span className="font-medium">{EVENT_LABELS[ev.event_type] ?? ev.event_type}</span>
                    <span className="text-muted-foreground">{formatTime(ev.occurred_at)}</span>
                  </div>
                  <p className="text-muted-foreground">
                    {ev.old_status ? `${dailyStatusLabel(ev.old_status as DailyStatus)} → ` : ''}
                    {ev.new_status ? dailyStatusLabel(ev.new_status as DailyStatus) : ''}
                    {ev.actor_name ? ` · by ${ev.actor_name}` : ev.event_type === 'auto_absent' ? ' · automatic' : ''}
                    {ev.device_label ? ` · ${ev.device_label}` : ''}
                  </p>
                  {ev.reason ? <p className="mt-1 text-muted-foreground">{ev.reason}</p> : null}
                </li>
              ))}
            </ol>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
