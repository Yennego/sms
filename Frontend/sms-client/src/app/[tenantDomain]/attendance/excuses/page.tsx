'use client';

// Absence excuses: parents' excuses wait here for approval (excuses entered by staff are approved
// straight away). Admins, or anyone who runs the school's attendance.

import * as React from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Check, FileText, Lock, Paperclip, X } from 'lucide-react';

import { DailyStatusBadge, useAttendanceAccess } from '@/components/attendance/attendance-ui';
import { useExcuses, useReviewExcuse } from '@/components/attendance/queries';
import { errorMessage, formatDate, formatTime } from '@/components/students/format';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { PageShell } from '@/components/ui/page-shell';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { notify } from '@/components/ui/toaster';
import { cn } from '@/lib/utils';
import { useDailyAttendanceService } from '@/services/api/daily-attendance-service';
import type { ExcuseListItem, ExcuseStatus } from '@/types/daily-attendance';
import { openExcuseDocument } from '@/utils/excuse-documents';

const VIEWS: Array<{ status: ExcuseStatus; label: string }> = [
  { status: 'pending', label: 'Waiting for review' },
  { status: 'approved', label: 'Approved' },
  { status: 'rejected', label: 'Rejected' },
];

export default function ExcusesPage() {
  const { isLoading, runsSchool } = useAttendanceAccess();
  const [view, setView] = React.useState<ExcuseStatus>('pending');
  const excuses = useExcuses(view);
  const review = useReviewExcuse();
  const { getExcuseDocument } = useDailyAttendanceService();
  const [rejecting, setRejecting] = React.useState<ExcuseListItem | null>(null);
  const [rejectNote, setRejectNote] = React.useState('');

  const approve = async (item: ExcuseListItem) => {
    try {
      await review.mutateAsync({ dailyId: item.daily_id, approve: true });
      notify.success(`${item.student_name}'s excuse is approved.`);
    } catch (err) {
      notify.error(errorMessage(err, "The excuse wasn't approved. Try again."));
    }
  };

  const reject = async () => {
    if (!rejecting) return;
    try {
      await review.mutateAsync({ dailyId: rejecting.daily_id, approve: false, notes: rejectNote.trim() || undefined });
      notify.success(`${rejecting.student_name}'s excuse is rejected. The absence stays unexcused.`);
      setRejecting(null);
      setRejectNote('');
    } catch (err) {
      notify.error(errorMessage(err, "The excuse wasn't rejected. Try again."));
    }
  };

  const viewDocument = async (dailyId: string) => {
    try {
      openExcuseDocument(await getExcuseDocument(dailyId));
    } catch (err) {
      notify.error(errorMessage(err, "The document couldn't be opened."));
    }
  };

  const columns = React.useMemo<ColumnDef<ExcuseListItem>[]>(
    () => [
      {
        accessorKey: 'student_name',
        header: 'Student',
        cell: ({ row }) => (
          <div>
            <p className="font-medium">{row.original.student_name}</p>
            <p className="text-sm text-muted-foreground">{row.original.class_name}</p>
          </div>
        ),
      },
      {
        accessorKey: 'date',
        header: 'Day',
        cell: ({ row }) => (
          <div className="flex flex-col gap-1">
            <span>{formatDate(row.original.date)}</span>
            <DailyStatusBadge status={row.original.status} />
          </div>
        ),
      },
      { accessorKey: 'excuse_reason', header: 'Reason', cell: ({ row }) => row.original.excuse_reason || '–' },
      {
        accessorKey: 'submitted_at',
        header: 'Sent by',
        meta: { hideOnMobile: true },
        cell: ({ row }) => (
          <div className="text-sm">
            <p>{row.original.submitted_by_name ?? '–'}</p>
            <p className="text-muted-foreground">
              {formatDate(row.original.submitted_at)} {formatTime(row.original.submitted_at)}
            </p>
          </div>
        ),
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        meta: { label: 'Actions', className: 'text-right' },
        cell: ({ row }) => {
          const item = row.original;
          return (
            <div className="flex flex-wrap justify-end gap-2">
              {item.has_document ? (
                <Button variant="ghost" size="sm" className="min-h-11 md:min-h-9" onClick={() => viewDocument(item.daily_id)}>
                  <Paperclip aria-hidden="true" />
                  Document
                </Button>
              ) : null}
              {view === 'pending' ? (
                <>
                  <Button
                    size="sm"
                    className="min-h-11 md:min-h-9"
                    onClick={() => approve(item)}
                    disabled={review.isPending}
                  >
                    <Check aria-hidden="true" />
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="min-h-11 md:min-h-9"
                    onClick={() => setRejecting(item)}
                    disabled={review.isPending}
                  >
                    <X aria-hidden="true" />
                    Reject
                  </Button>
                </>
              ) : null}
            </div>
          );
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [view, review.isPending]
  );

  if (isLoading) {
    return (
      <PageShell title="Absence excuses">
        <Skeleton className="h-48 w-full rounded-xl" />
      </PageShell>
    );
  }
  if (!runsSchool) {
    return (
      <PageShell title="Absence excuses">
        <EmptyState icon={Lock} description="Only the school's admins review excuses." />
      </PageShell>
    );
  }

  return (
    <PageShell
      title="Absence excuses"
      description="Excuses sent by parents wait here for review. Excuses entered by staff are approved straight away."
    >
      <div role="tablist" aria-label="Excuses" className="flex flex-wrap gap-2">
        {VIEWS.map((v) => (
          <button
            key={v.status}
            type="button"
            role="tab"
            aria-selected={view === v.status}
            onClick={() => setView(v.status)}
            className={cn(
              'min-h-11 rounded-md border px-4 text-sm font-medium md:min-h-9',
              view === v.status ? 'border-primary bg-primary text-primary-foreground' : 'bg-background hover:bg-muted'
            )}
          >
            {v.label}
          </button>
        ))}
      </div>

      {excuses.isError ? (
        <EmptyState
          icon={FileText}
          title="The excuses didn't load"
          description={`${errorMessage(excuses.error, 'The server didn’t answer.')} Check your connection and try again.`}
          action={<Button onClick={() => excuses.refetch()}>Try again</Button>}
        />
      ) : (
        <DataTable
          label="Excuses"
          columns={columns}
          data={excuses.data ?? []}
          loading={excuses.isLoading}
          getRowId={(e) => e.daily_id}
          initialSorting={[{ id: 'date', desc: true }]}
          emptyState={
            <EmptyState
              icon={FileText}
              description={
                view === 'pending'
                  ? 'Nothing is waiting. Excuses that parents send appear here.'
                  : `No ${view} excuses.`
              }
            />
          }
        />
      )}

      <Dialog open={Boolean(rejecting)} onOpenChange={(open) => !open && setRejecting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject {rejecting?.student_name}&apos;s excuse?</DialogTitle>
            <DialogDescription>
              The absence on {rejecting ? formatDate(rejecting.date) : ''} stays unexcused. Staff see your note.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <label htmlFor="reject-note" className="text-sm font-medium">
              Why (optional)
            </label>
            <Textarea id="reject-note" rows={3} value={rejectNote} onChange={(e) => setRejectNote(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" className="min-h-11 md:min-h-9" onClick={() => setRejecting(null)}>
              Cancel
            </Button>
            <Button variant="destructive" className="min-h-11 md:min-h-9" onClick={reject} disabled={review.isPending}>
              Reject excuse
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
