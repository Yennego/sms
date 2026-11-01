'use client';

// Announcements (/{school}/communication/announcements, phase6-design.md section 6). The list is
// what the server lets the caller see: every announcement for send_announcements, otherwise the
// ones they wrote or received. GET /announcements/audiences decides whether "New announcement"
// shows (empty = can't send: parents, students and most staff only read). Withdrawn announcements
// stay on the list, marked as such; "Withdraw" shows where the server says can_withdraw.
import * as React from 'react';
import { Ban, Megaphone, Plus, Users } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { PageShell } from '@/components/ui/page-shell';
import { Pagination } from '@/components/ui/pagination';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/ui/status-badge';
import { notify } from '@/components/ui/toaster';
import { positiveInt, useUrlState } from '@/components/class-placement/use-url-state';
import { LoadError } from '@/components/fees/shared';
import { errorMessage } from '@/components/students/format';
import type { Announcement, Audiences } from '@/services/api/communication-service';

import { formatDateTime, peopleCount } from './format';
import { NewAnnouncementSheet } from './new-announcement-sheet';
import { useAnnouncements, useAudiences, useWithdrawAnnouncement } from './queries';

const PAGE_SIZE = 20;
const URL_DEFAULTS = { page: '1' };

function canSend(a: Audiences | undefined): boolean {
  return Boolean(a && (a.roles.length > 0 || a.classes.length > 0 || a.family));
}

function AnnouncementCard({
  item,
  showAudience,
  onWithdraw,
}: {
  item: Announcement;
  /** Senders see who it went to and how many; receivers just read it */
  showAudience: boolean;
  onWithdraw: (item: Announcement) => void;
}) {
  const [expanded, setExpanded] = React.useState(false);
  const withdrawn = Boolean(item.withdrawn_at);
  const long = item.body.length > 240 || item.body.split('\n').length > 3;

  return (
    <li className="flex min-w-0 flex-col gap-2 p-4">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1">
          <h2 className={cn('text-base font-semibold break-words text-foreground', withdrawn && 'text-muted-foreground line-through')}>
            {item.title}
          </h2>
          <p className="text-sm text-muted-foreground">
            {formatDateTime(item.sent_at)}
            {item.author_name ? ` · ${item.author_name}` : ''}
            {withdrawn ? ` · withdrawn ${formatDateTime(item.withdrawn_at)}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {withdrawn ? (
            <StatusBadge status="neutral" icon={Ban} label="Withdrawn" />
          ) : null}
          {item.can_withdraw ? (
            <Button variant="outline" className="min-h-11 md:min-h-9" onClick={() => onWithdraw(item)}>
              <Ban aria-hidden="true" />
              Withdraw
            </Button>
          ) : null}
        </div>
      </div>

      {showAudience ? (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-foreground">
          <Users className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="font-medium">{item.audience_label}</span>
          <span className="text-muted-foreground">· sent to {peopleCount(item.recipient_count)}</span>
        </p>
      ) : null}

      <p className={cn('text-sm break-words whitespace-pre-line text-foreground', !expanded && long && 'line-clamp-3', withdrawn && 'text-muted-foreground')}>
        {item.body}
      </p>
      {long ? (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          aria-expanded={expanded}
          className="min-h-11 self-start text-sm font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50 md:min-h-0"
        >
          {expanded ? 'Show less' : 'Read more'}
        </button>
      ) : null}
    </li>
  );
}

export function AnnouncementsScreen() {
  const [url, setUrl] = useUrlState(URL_DEFAULTS);
  const page = positiveInt(url.page, 1);
  const audiences = useAudiences();
  const q = useAnnouncements(page);
  const withdraw = useWithdrawAnnouncement();

  const [composing, setComposing] = React.useState(false);
  const [withdrawing, setWithdrawing] = React.useState<Announcement | null>(null);

  const sender = canSend(audiences.data);
  // Only send_announcements gets the family audience: that's who sees every announcement
  const seesAll = Boolean(audiences.data?.family);
  const items = q.data?.items ?? [];

  const onWithdraw = async () => {
    if (!withdrawing) return;
    try {
      await withdraw.mutateAsync(withdrawing.id);
      notify.success('Announcement withdrawn. It no longer shows in anyone’s inbox.');
    } catch (error) {
      notify.error(errorMessage(error, "The announcement wasn't withdrawn. Check your connection and try again."));
      throw error;
    }
  };

  let content: React.ReactNode;
  if (q.isLoading) {
    content = (
      <div className="flex flex-col gap-2" aria-busy="true" aria-label="Loading announcements">
        <Skeleton className="h-28 rounded-xl" />
        <Skeleton className="h-28 rounded-xl" />
      </div>
    );
  } else if (q.isError) {
    content = <LoadError error={q.error} what="announcements" onRetry={() => void q.refetch()} />;
  } else if (items.length === 0) {
    content = (
      <EmptyState
        icon={Megaphone}
        title="No announcements yet"
        description={
          sender ? 'Announcements you send appear here.' : 'Announcements from the school appear here and in your inbox.'
        }
        action={
          sender ? (
            <Button onClick={() => setComposing(true)}>
              <Plus aria-hidden="true" />
              New announcement
            </Button>
          ) : undefined
        }
      />
    );
  } else {
    content = (
      <div className={cn('flex flex-col gap-4 transition-opacity', q.isPlaceholderData && 'opacity-60')} aria-busy={q.isFetching || undefined}>
        <ul className="flex flex-col divide-y overflow-hidden rounded-xl border bg-card">
          {items.map((item) => (
            <AnnouncementCard key={item.id} item={item} showAudience={sender} onWithdraw={setWithdrawing} />
          ))}
        </ul>
        <Pagination
          label="Announcement pages"
          itemLabel="announcements"
          page={page}
          pageSize={PAGE_SIZE}
          total={q.data?.total ?? 0}
          onPageChange={(p) => setUrl({ page: p })}
          disabled={q.isFetching}
        />
      </div>
    );
  }

  return (
    <PageShell
      title="Announcements"
      description={
        seesAll
          ? 'Every announcement sent in the school, newest first.'
          : sender
            ? 'Announcements you sent or received, newest first.'
            : 'Announcements the school sent you, newest first.'
      }
      primaryAction={
        sender ? (
          <Button onClick={() => setComposing(true)}>
            <Plus aria-hidden="true" />
            New announcement
          </Button>
        ) : undefined
      }
    >
      {content}

      {audiences.data && sender ? (
        <NewAnnouncementSheet open={composing} onOpenChange={setComposing} audiences={audiences.data} />
      ) : null}

      <ConfirmDialog
        open={Boolean(withdrawing)}
        onOpenChange={(open) => {
          if (!open) setWithdrawing(null);
        }}
        title="Withdraw this announcement?"
        description="It disappears from everyone’s inbox. Emails already sent can’t be recalled."
        confirmLabel="Withdraw announcement"
        destructive
        loading={withdraw.isPending}
        onConfirm={onWithdraw}
      >
        {withdrawing ? <p className="text-sm font-medium break-words text-foreground">{withdrawing.title}</p> : null}
      </ConfirmDialog>
    </PageShell>
  );
}

export function AnnouncementsSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-4 py-6" aria-busy="true" aria-label="Loading announcements">
      <Skeleton className="h-9 w-48" />
      <Skeleton className="h-28 rounded-xl" />
      <Skeleton className="h-28 rounded-xl" />
    </div>
  );
}
