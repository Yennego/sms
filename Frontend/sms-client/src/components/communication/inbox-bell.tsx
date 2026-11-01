'use client';

// The bell in the app shell's top bar: a link to the inbox with the unread count
// (phase6-design.md section 6). The count polls every 60 s and pauses while the tab is hidden.
import Link from 'next/link';
import { Bell } from 'lucide-react';

import { cn } from '@/lib/utils';

import { useUnreadCount } from './queries';

export function InboxBell({ href, active }: { href: string; active?: boolean }) {
  const { data } = useUnreadCount();
  const unread = data?.unread ?? 0;
  const shown = unread > 99 ? '99+' : String(unread);
  const label = unread > 0 ? `Inbox, ${unread} unread` : 'Inbox';

  return (
    <Link
      href={href}
      aria-label={label}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'relative inline-flex size-11 shrink-0 items-center justify-center rounded-full text-slate-600 outline-none transition-colors hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-[var(--school-primary)]',
        active && 'bg-slate-100 text-slate-900'
      )}
    >
      <Bell className="size-5" aria-hidden="true" />
      {unread > 0 ? (
        <span
          aria-hidden="true"
          className="absolute top-1 right-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[11px] leading-none font-semibold text-white ring-2 ring-white"
        >
          {shown}
        </span>
      ) : null}
    </Link>
  );
}
