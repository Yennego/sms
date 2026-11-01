// The gate scanner's offline queue (phase6-design.md section 1, "Offline gate queue"): scans made
// while the connection is down wait here, in IndexedDB, until they are sent. Plain IndexedDB with
// a small promise wrapper (no package: installs aren't possible offline).
//
// Every storage access is wrapped: in a private window, with storage blocked or full, the queue
// falls back to memory, so scans survive until the page closes instead of being lost at once.
// Items are kept in the order they were scanned (an auto-increment key) and carry their school, so
// a shared device signed into another school never sends them there.

const DB_NAME = 'sms-gate-scanner';
const DB_VERSION = 1;
const STORE = 'scans';

export type QueuedScanKind = 'card' | 'manual';

export interface QueuedScan {
  /** Auto-increment key: the order the scans were made in. Set by the store. */
  seq?: number;
  /** Sent with the scan; the server ignores a scan it has already seen. */
  client_scan_id: string;
  /** The school's address segment (`/{school}/...`) the scan belongs to. */
  school: string;
  kind: QueuedScanKind;
  /** The card's token (card scans). */
  token?: string;
  mode: 'check_in' | 'check_out';
  /** Typed admission number (manual check-in). */
  admission_number?: string;
  device_label?: string;
  /** When the card was read: ISO 8601 with the device's offset. */
  scanned_at: string;
  /** The server's last refusal other than a network failure, shown in the banner. */
  last_error?: string;
}

// ---- Memory fallback -------------------------------------------------------------------------------

let memory: QueuedScan[] = [];
let memorySeq = 0;

// ---- IndexedDB -------------------------------------------------------------------------------------

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    try {
      if (typeof indexedDB === 'undefined') throw new Error('IndexedDB is not available');
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'seq', autoIncrement: true });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('IndexedDB could not be opened'));
      request.onblocked = () => reject(new Error('IndexedDB is blocked by another tab'));
    } catch (error) {
      reject(error);
    }
  });
  // Try again next time instead of caching a failure
  dbPromise.catch(() => {
    dbPromise = null;
  });
  return dbPromise;
}

/** Runs one request in its own transaction and resolves when the transaction completes. */
async function run<T>(mode: IDBTransactionMode, make: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    try {
      const tx = db.transaction(STORE, mode);
      const request = make(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(request.result);
      tx.onerror = () => reject(tx.error ?? request.error ?? new Error('IndexedDB request failed'));
      tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'));
    } catch (error) {
      reject(error);
    }
  });
}

// ---- API -------------------------------------------------------------------------------------------

/** Adds a scan at the end of the queue. Returns false when it is only kept in memory. */
export async function enqueueScan(scan: QueuedScan): Promise<boolean> {
  const item = { ...scan };
  delete item.seq;
  try {
    await run('readwrite', (store) => store.add(item));
    return true;
  } catch {
    memory.push({ ...item, seq: ++memorySeq });
    return false;
  }
}

/** The school's queued scans, oldest first (stored and in-memory ones). */
export async function listScans(school: string): Promise<QueuedScan[]> {
  let stored: QueuedScan[] = [];
  try {
    stored = await run<QueuedScan[]>('readonly', (store) => store.getAll() as IDBRequest<QueuedScan[]>);
  } catch {
    stored = [];
  }
  // Stored ones first: memory only holds scans made after storage failed
  return [...stored, ...memory].filter((s) => s.school === school);
}

/** Removes one scan (after the server answered 200 for it). */
export async function removeScan(scan: QueuedScan): Promise<void> {
  memory = memory.filter((s) => s.client_scan_id !== scan.client_scan_id);
  if (scan.seq === undefined) return;
  try {
    const stored = await run<QueuedScan | undefined>('readonly', (store) => store.get(scan.seq as number));
    if (stored && stored.client_scan_id === scan.client_scan_id) {
      await run('readwrite', (store) => store.delete(scan.seq as number));
    }
  } catch {
    // Storage unavailable: nothing stored to remove
  }
}

/** Saves the server's refusal on a queued scan, so the banner can show it. */
export async function markScanError(scan: QueuedScan, message: string): Promise<void> {
  const inMemory = memory.find((s) => s.client_scan_id === scan.client_scan_id);
  if (inMemory) {
    inMemory.last_error = message;
    return;
  }
  if (scan.seq === undefined) return;
  try {
    await run('readwrite', (store) => store.put({ ...scan, last_error: message }));
  } catch {
    // Storage unavailable: the message just isn't kept
  }
}

// ---- Scan fields -----------------------------------------------------------------------------------

/** A random UUID (v4); crypto.randomUUID needs https, so fall back to getRandomValues. */
export function newScanId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  } catch {
    // fall through
  }
  const bytes = new Uint8Array(16);
  try {
    crypto.getRandomValues(bytes);
  } catch {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** ISO 8601 in the device's local time with its offset: "2026-10-20T07:42:05+00:00". */
export function isoWithOffset(d: Date = new Date()): string {
  const pad = (n: number) => String(Math.abs(Math.trunc(n))).padStart(2, '0');
  const offset = -d.getTimezoneOffset();
  const sign = offset >= 0 ? '+' : '-';
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}` +
    `${sign}${pad(offset / 60)}:${pad(offset % 60)}`
  );
}
