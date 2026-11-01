'use client';

// The gate scanner's offline queue (phase6-design.md section 1): when the device is offline, or a
// send fails on the network, the scan is kept on the device (services/storage/scan-queue.ts) with
// its own id and the time the card was read. The queue is sent one scan at a time, in order, when
// the connection comes back, when the page loads and on "Send now"; a scan leaves the queue only
// after the server answered 200 for it. Sending a scan twice is harmless: the server answers
// "duplicate" for an id it has already seen.
import * as React from 'react';
import { CheckCircle2, CloudOff, Loader2, RefreshCw, Trash2, UploadCloud } from 'lucide-react';

import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  enqueueScan,
  listScans,
  markScanError,
  removeScan,
  type QueuedScan,
} from '@/services/storage/scan-queue';
import type { ScanResult } from '@/types/daily-attendance';
import { errorMessageOf } from '@/utils/error-utils';

/** How often a waiting queue is tried again while the page is open. */
const RETRY_MS = 30 * 1000;

/** No answer, or the server (or the proxy in front of it) failed: keep the scan and try later. */
export function isNetworkFailure(error: unknown): boolean {
  const status = (error as { statusCode?: unknown } | null)?.statusCode;
  if (typeof status !== 'number') return true;
  return status >= 500 || status === 408 || status === 429;
}

function localDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * A scan from an earlier day can't be counted any more: the server would use its own time and
 * record it for today (phase6-design.md section 5). Such scans are kept back and can be removed.
 */
export function isFromEarlierDay(scan: QueuedScan, now = new Date()): boolean {
  // scanned_at is written in the device's local time, so its date part is the local day
  return scan.scanned_at.slice(0, 10) < localDay(now);
}

function readOnline(): boolean {
  return typeof navigator === 'undefined' ? true : navigator.onLine !== false;
}

export interface ScanQueue {
  /** Scans waiting to be sent, oldest first (today's only). */
  waiting: QueuedScan[];
  /** Scans from an earlier day, kept back. */
  stale: QueuedScan[];
  online: boolean;
  sending: boolean;
  /** Why the last send stopped: 'network' or the server's refusal of the first waiting scan. */
  problem: 'network' | string | null;
  /** Scans sent in the last run (for "12 saved scans sent"). */
  lastSent: number;
  /** True once a scan could only be kept in memory (storage blocked): don't close the page. */
  memoryOnly: boolean;
  add: (scan: QueuedScan) => Promise<void>;
  send: () => Promise<void>;
  removeStale: () => Promise<void>;
  removeFirst: () => Promise<void>;
}

export function useScanQueue({
  school,
  sendScan,
  onResult,
}: {
  school: string;
  /** Sends one scan with its queue fields. */
  sendScan: (scan: QueuedScan) => Promise<ScanResult>;
  /** Called for each scan the server answered (accepted, duplicate or rejected). */
  onResult: (scan: QueuedScan, result: ScanResult) => void;
}): ScanQueue {
  const [items, setItems] = React.useState<QueuedScan[]>([]);
  const [online, setOnline] = React.useState(true);
  const [sending, setSending] = React.useState(false);
  const [problem, setProblem] = React.useState<'network' | string | null>(null);
  const [lastSent, setLastSent] = React.useState(0);
  const [memoryOnly, setMemoryOnly] = React.useState(false);

  const sendingRef = React.useRef(false);
  const sendScanRef = React.useRef(sendScan);
  const onResultRef = React.useRef(onResult);
  React.useEffect(() => {
    sendScanRef.current = sendScan;
    onResultRef.current = onResult;
  }, [sendScan, onResult]);

  const refresh = React.useCallback(async () => {
    if (!school) return;
    try {
      setItems(await listScans(school));
    } catch {
      // listScans already falls back; nothing more to do
    }
  }, [school]);

  const send = React.useCallback(async () => {
    if (!school || sendingRef.current) return;
    sendingRef.current = true;
    setSending(true);
    setProblem(null);
    let sent = 0;
    // Guards against sending one scan twice in a run when it couldn't be removed from storage
    const done = new Set<string>();
    try {
      for (;;) {
        const next = (await listScans(school)).find((s) => !isFromEarlierDay(s));
        if (!next || done.has(next.client_scan_id)) break;
        try {
          const result = await sendScanRef.current(next);
          done.add(next.client_scan_id);
          await removeScan(next);
          sent += 1;
          onResultRef.current(next, result);
        } catch (error) {
          if (isNetworkFailure(error)) {
            setProblem('network');
          } else {
            const message = errorMessageOf(error, 'The server refused this scan.');
            await markScanError(next, message);
            setProblem(message);
          }
          break;
        }
      }
    } finally {
      sendingRef.current = false;
      setSending(false);
      setLastSent(sent);
      await refresh();
    }
  }, [school, refresh]);

  const add = React.useCallback(
    async (scan: QueuedScan) => {
      const stored = await enqueueScan(scan);
      if (!stored) setMemoryOnly(true);
      await refresh();
    },
    [refresh]
  );

  const removeStale = React.useCallback(async () => {
    for (const s of await listScans(school)) {
      if (isFromEarlierDay(s)) await removeScan(s);
    }
    await refresh();
  }, [school, refresh]);

  const removeFirst = React.useCallback(async () => {
    const first = (await listScans(school)).find((s) => !isFromEarlierDay(s));
    if (first) await removeScan(first);
    setProblem(null);
    await refresh();
  }, [school, refresh]);

  // On load: show what is waiting and send it
  React.useEffect(() => {
    setOnline(readOnline());
    void refresh().then(() => {
      if (readOnline()) void send();
    });
  }, [refresh, send]);

  // Back online: send; offline: say so
  React.useEffect(() => {
    const up = () => {
      setOnline(true);
      void send();
    };
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, [send]);

  // "12 saved scans sent" shows for a little while
  React.useEffect(() => {
    if (!lastSent) return;
    const id = setTimeout(() => setLastSent(0), 10 * 1000);
    return () => clearTimeout(id);
  }, [lastSent]);

  const waiting = React.useMemo(() => items.filter((s) => !isFromEarlierDay(s)), [items]);
  const stale = React.useMemo(() => items.filter((s) => isFromEarlierDay(s)), [items]);

  // The browser's online flag isn't always right: while scans wait, try again now and then.
  // A refusal waits for "Send now" or "Remove it" instead.
  const hasWaiting = waiting.length > 0;
  const refused = problem !== null && problem !== 'network';
  React.useEffect(() => {
    if (!hasWaiting || refused) return;
    const id = setInterval(() => {
      if (readOnline()) void send();
    }, RETRY_MS);
    return () => clearInterval(id);
  }, [hasWaiting, refused, send]);

  return { waiting, stale, online, sending, problem, lastSent, memoryOnly, add, send, removeStale, removeFirst };
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** "3 scans waiting to send" with "Send now", and what is holding them back. */
export function ScanQueueBanner({ queue }: { queue: ScanQueue }) {
  const [confirmStale, setConfirmStale] = React.useState(false);
  const [confirmFirst, setConfirmFirst] = React.useState(false);
  const { waiting, stale, online, sending, problem, lastSent, memoryOnly } = queue;

  if (waiting.length === 0 && stale.length === 0) {
    if (lastSent > 0) {
      return (
        <div role="status" className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
          <CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden="true" />
          <p className="font-semibold">{plural(lastSent, 'saved scan', 'saved scans')} sent. See the results under Recent scans.</p>
        </div>
      );
    }
    if (!online) {
      return (
        <div role="status" className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
          <CloudOff className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <p className="font-semibold">No connection. Keep scanning: scans are saved on this device and sent when the connection is back.</p>
        </div>
      );
    }
    return null;
  }

  const refused = problem !== null && problem !== 'network';
  let detail: string;
  if (sending) detail = 'Sending…';
  else if (refused) detail = `The next scan couldn't be sent: ${problem}`;
  else if (!online) detail = 'No connection. Keep scanning: they are sent when the connection is back.';
  else if (problem === 'network') detail = 'The server could not be reached. Trying again shortly.';
  else detail = 'They are sent automatically.';

  return (
    <div role="status" className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
      {waiting.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            {sending ? (
              <Loader2 className="mt-0.5 h-5 w-5 shrink-0 animate-spin" aria-hidden="true" />
            ) : online ? (
              <UploadCloud className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            ) : (
              <CloudOff className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            )}
            <div className="min-w-0">
              <p className="font-bold">{plural(waiting.length, 'scan', 'scans')} waiting to send</p>
              <p className="text-sm break-words">{detail}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {refused ? (
              <button
                type="button"
                onClick={() => setConfirmFirst(true)}
                className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-amber-300 bg-white px-4 text-sm font-bold text-amber-900 hover:bg-amber-100"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" /> Remove it
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => void queue.send()}
              disabled={sending}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-amber-600 px-4 text-sm font-bold text-white hover:bg-amber-700 disabled:opacity-60"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" /> Send now
            </button>
          </div>
        </div>
      ) : null}

      {stale.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm">
            {plural(stale.length, 'saved scan is', 'saved scans are')} from an earlier day and can&apos;t be counted any more.
            Ask the class sponsor to correct those days.
          </p>
          <button
            type="button"
            onClick={() => setConfirmStale(true)}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-amber-300 bg-white px-4 text-sm font-bold text-amber-900 hover:bg-amber-100"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" /> Remove them
          </button>
        </div>
      ) : null}

      {memoryOnly ? (
        <p className="text-sm font-semibold">
          This device can&apos;t save scans for later. Keep this page open until they are sent.
        </p>
      ) : null}

      <ConfirmDialog
        open={confirmStale}
        onOpenChange={setConfirmStale}
        title={`Remove ${plural(stale.length, 'old scan', 'old scans')}?`}
        description="They were never sent and can't be counted any more. This can't be undone."
        confirmLabel="Remove old scans"
        destructive
        onConfirm={queue.removeStale}
      />
      <ConfirmDialog
        open={confirmFirst}
        onOpenChange={setConfirmFirst}
        title="Remove this scan?"
        description="The server refused it, so it was never recorded. The other saved scans are sent next."
        confirmLabel="Remove scan"
        destructive
        onConfirm={queue.removeFirst}
      />
    </div>
  );
}
