'use client';

// Inbox (/{school}/inbox, phase6-design.md section 6): the signed-in user's alerts and
// announcements, newest first, a page at a time. Opening an item marks it read and goes to its
// link; an announcement has no link, so it opens in place with its full message. The filter and
// page live in the URL. Render inside <Suspense> (useSearchParams).
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { BellOff, CheckCheck, ChevronRight, Loader2 } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { PageShell } from '@/components/ui/page-shell';
import { Pagination } from '@/components/ui/pagination';
import { Skeleton } from '@/components/ui/skeleton';
import { notify } from '@/components/ui/toaster';
import { positiveInt, useUrlState } from '@/components/class-placement/use-url-state';
import { LoadError, SegmentTabs } from '@/components/fees/shared';
import { errorMessage } from '@/components/students/format';
import type { InboxItem } from '@/services/api/communication-service';

import { eventLabel, formatDateTime, formatWhen } from './format';
import { useInbox, useMarkAllRead, useMarkRead } from './queries';

const PAGE_SIZE = 20;
const URL_DEFAULTS = { show: 'all', page: '1' };

/** Only paths inside the app are followed (the server sends `/{school}/...`). */
function appPath(link: string | null): string | null {
  return link && link.startsWith('/') && !link.startsWith('//') ? link : null;
}

function InboxRow({
  item,
  expanded,
  opening,
  onOpen,
}: {
  item: InboxItem;
  expanded: boolean;
  opening: boolean;
  onOpen: (item: InboxItem) => void;
}) {
  const unread = !item.read_at;
  const href = appPath(item.link);
  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(item)}
        aria-expanded={href ? undefined : expanded}
        className={cn(
          'flex w-full min-h-11 items-start gap-3 p-4 text-left outline-none transition-colors hover:bg-accent/50',
          'focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-ring/50',
          unread && 'bg-blue-50/60'
        )}
      >
        <span
          className={cn('mt-2 size-2.5 shrink-0 rounded-full', unread ? 'bg-blue-600' : 'bg-transparent')}
          aria-hidden="true"
        />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
            <span className={cn('text-base text-foreground', unread ? 'font-semibold' : 'font-medium')}>
              {unread ? <span className="sr-only">Unread: </span> : null}
              {item.title}
            </span>
            <time dateTime={item.created_at} title={formatDateTime(item.created_at)} className="shrink-0 text-sm text-muted-foreground">
              {formatWhen(item.created_at)}
            </time>
          </span>
          <span
            className={cn(
              'mt-1 block text-sm break-words whitespace-pre-line text-muted-foreground',
              !expanded && 'line-clamp-2'
            )}
          >
            {item.body}
          </span>
          <span className="mt-1 block text-xs text-muted-foreground">{eventLabel(item.event)}</span>
        </span>
        {opening ? (
          <Loader2 className="mt-1 size-5 shrink-0 animate-spin text-muted-foreground" aria-hidden="true" />
        ) : href ? (
          <ChevronRight className="mt-1 size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
        ) : null}
      </button>
    </li>
  );
}

export function InboxScreen() {
  const router = useRouter();
  const [url, setUrl] = useUrlState(URL_DEFAULTS);
  const unreadOnly = url.show === 'unread';
  const page = positiveInt(url.page, 1);
  const params = React.useMemo(() => ({ unreadOnly, page, pageSize: PAGE_SIZE }), [unreadOnly, page]);

  const q = useInbox(params);
  const markRead = useMarkRead();
  const markAll = useMarkAllRead();
  const [expanded, setExpanded] = React.useState<string | null>(null);
  const [opening, setOpening] = React.useState<string | null>(null);

  const data = q.data;
  const items = data?.items ?? [];
  const unread = data?.unread ?? 0;

  const open = async (item: InboxItem) => {
    const href = appPath(item.link);
    if (!href) setExpanded((current) => (current === item.id ? null : item.id));
    if (!item.read_at) {
      if (href) setOpening(item.id);
      try {
        await markRead.mutateAsync(item.id);
      } catch {
        // Not being marked read never stops the user from opening it
      } finally {
        setOpening(null);
      }
    }
    if (href) router.push(href);
  };

  const onMarkAll = async () => {
    try {
      await markAll.mutateAsync();
      notify.success('All marked as read');
    } catch (error) {
      notify.error(errorMessage(error, "Couldn't mark them as read. Check your connection and try again."));
    }
  };

  let content: React.ReactNode;
  if (q.isLoading) {
    content = (
      <div className="flex flex-col gap-2" aria-busy="true" aria-label="Loading the inbox">
        <Skeleton className="h-20 rounded-xl" />
        <Skeleton className="h-20 rounded-xl" />
        <Skeleton className="h-20 rounded-xl" />
      </div>
    );
  } else if (q.isError) {
    content = <LoadError error={q.error} what="your inbox" onRetry={() => void q.refetch()} />;
  } else if (items.length === 0) {
    content = unreadOnly ? (
      <EmptyState
        icon={CheckCheck}
        title="All read"
        description="You have no unread messages."
        action={
          <Button variant="outline" onClick={() => setUrl({ show: null, page: null })}>
            Show all
          </Button>
        }
      />
    ) : (
      <EmptyState
        icon={BellOff}
        title="Nothing here yet"
        description="Alerts and announcements from the school appear here."
      />
    );
  } else {
    content = (
      <div className={cn('flex flex-col gap-4 transition-opacity', q.isPlaceholderData && 'opacity-60')} aria-busy={q.isFetching || undefined}>
        <ul className="flex flex-col divide-y overflow-hidden rounded-xl border bg-card">
          {items.map((item) => (
            <InboxRow
              key={item.id}
              item={item}
              expanded={expanded === item.id}
              opening={opening === item.id}
              onOpen={(i) => void open(i)}
            />
          ))}
        </ul>
        <Pagination
          label="Inbox pages"
          itemLabel="messages"
          page={page}
          pageSize={PAGE_SIZE}
          total={data?.total ?? 0}
          onPageChange={(p) => setUrl({ page: p })}
          disabled={q.isFetching}
        />
      </div>
    );
  }

  return (
    <PageShell
      title="Inbox"
      description="Alerts and announcements from the school, newest first."
      primaryAction={
        unread > 0 ? (
          <Button variant="outline" onClick={() => void onMarkAll()} disabled={markAll.isPending}>
            {markAll.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <CheckCheck aria-hidden="true" />}
            Mark all as read
          </Button>
        ) : undefined
      }
    >
      <SegmentTabs
        label="Show"
        value={unreadOnly ? 'unread' : 'all'}
        onChange={(v) => setUrl({ show: v, page: null })}
        tabs={[
          { value: 'all', label: 'All' },
          { value: 'unread', label: 'Unread', count: data ? unread : null },
        ]}
      />
      {content}
    </PageShell>
  );
}

export function InboxSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-4 py-6" aria-busy="true" aria-label="Loading the inbox">
      <Skeleton className="h-9 w-40" />
      <Skeleton className="h-20 rounded-xl" />
      <Skeleton className="h-20 rounded-xl" />
    </div>
  );
}
