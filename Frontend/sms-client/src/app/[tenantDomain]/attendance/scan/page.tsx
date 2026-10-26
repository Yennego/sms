'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, CameraOff, CheckCircle2, Clock, Keyboard, LogIn, LogOut, ScanLine, XCircle } from 'lucide-react';
import type { Html5Qrcode } from 'html5-qrcode';

import { useDailyAttendanceService } from '@/services/api/daily-attendance-service';
import { ScanMode, ScanRejectReason, ScanResult } from '@/types/daily-attendance';
import { errorMessageOf } from '@/utils/error-utils';

const TOKEN_PREFIX = 'SMS1.';
const RESULT_MS = 2500;        // how long a result stays on screen
const SAME_CARD_MS = 4000;     // ignore the camera re-reading the same card
const DEVICE_KEY = 'attendance-scanner-device';
const CAMERA_ELEMENT_ID = 'attendance-camera';

const REASON_TEXT: Record<ScanRejectReason, string> = {
  invalid_signature: 'Not a valid school ID card',
  wrong_tenant: 'This card belongs to another school',
  unknown_student: 'Student not found',
  revoked: 'Old card: a newer card was issued. Ask the office for the current card.',
  inactive_student: 'Student is no longer active (graduated, withdrawn or transferred)',
  not_school_day: 'Today is not a school day',
  scan_closed: 'Scanning has closed for today. See the class sponsor.',
  not_enrolled: 'Student is not enrolled in a class today',
  not_your_class: 'You can only scan students in your own class',
  checkout_disabled: 'Check-out scanning is turned off',
  not_checked_in: 'Student has not checked in today',
};

type Outcome = { result: ScanResult; at: Date } | { error: string; at: Date };

function readDevice(): string {
  try { return window.localStorage.getItem(DEVICE_KEY) || ''; } catch { return ''; }
}

function saveDevice(value: string) {
  try { window.localStorage.setItem(DEVICE_KEY, value); } catch { /* storage unavailable */ }
}

function beep(kind: 'ok' | 'warn' | 'error') {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const tones = kind === 'ok' ? [880] : kind === 'warn' ? [660, 660] : [220, 180];
    tones.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      osc.connect(gain);
      gain.connect(ctx.destination);
      const start = ctx.currentTime + i * 0.18;
      gain.gain.setValueAtTime(0.25, start);
      osc.start(start);
      osc.stop(start + 0.14);
    });
    setTimeout(() => ctx.close(), 800);
  } catch { /* audio unavailable */ }
}

const timeOf = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

function headline(outcome: Outcome): { tone: 'ok' | 'warn' | 'error'; title: string; detail: string } {
  if ('error' in outcome) return { tone: 'error', title: 'Scan failed', detail: outcome.error };
  const { result } = outcome;
  if (result.result === 'rejected') {
    return { tone: 'error', title: 'Not checked in', detail: result.reason ? REASON_TEXT[result.reason] : 'Rejected' };
  }
  const status = result.status ?? '';
  if (result.result === 'duplicate') {
    const detail = result.mode === 'check_out'
      ? `Already checked out at ${timeOf(result.check_out_at)}`
      : result.check_in_at
        ? `Already checked in at ${timeOf(result.check_in_at)} (${status})`
        : `Already marked ${status}`;
    return { tone: 'warn', title: 'Already recorded', detail };
  }
  if (result.mode === 'check_out') return { tone: 'ok', title: 'Checked out', detail: `at ${timeOf(result.check_out_at)}` };
  return {
    tone: status === 'late' ? 'warn' : 'ok',
    title: status === 'late' ? 'Late' : 'Present',
    detail: `Checked in at ${timeOf(result.check_in_at)}`,
  };
}

const TONE_STYLES = {
  ok: 'bg-emerald-600',
  warn: 'bg-amber-500',
  error: 'bg-rose-600',
};

export default function AttendanceScanPage() {
  const { scan, manualCheckIn } = useDailyAttendanceService();

  const [mode, setMode] = useState<ScanMode>('check_in');
  const [device, setDevice] = useState('');
  const [entry, setEntry] = useState('');
  const [busy, setBusy] = useState(false);
  const [current, setCurrent] = useState<Outcome | null>(null);
  const [recent, setRecent] = useState<Outcome[]>([]);
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<Html5Qrcode | null>(null);
  const busyRef = useRef(false);
  const lastCardRef = useRef<{ text: string; at: number }>({ text: '', at: 0 });
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const modeRef = useRef(mode);
  const deviceRef = useRef(device);
  modeRef.current = mode;
  deviceRef.current = device;

  useEffect(() => { setDevice(readDevice()); }, []);

  const show = useCallback((outcome: Outcome) => {
    setCurrent(outcome);
    setRecent(prev => [outcome, ...prev].slice(0, 20));
    beep(headline(outcome).tone);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setCurrent(null), RESULT_MS);
  }, []);

  // A card token goes to /scan; anything else is treated as an admission number (manual check-in)
  const submit = useCallback(async (raw: string) => {
    const text = raw.trim();
    if (!text || busyRef.current) return;
    if (!text.startsWith(TOKEN_PREFIX) && modeRef.current === 'check_out') {
      show({ error: 'Admission numbers can only be used to check in. Scan the card to check out.', at: new Date() });
      return;
    }
    busyRef.current = true;
    setBusy(true);
    try {
      const result = text.startsWith(TOKEN_PREFIX)
        ? await scan(text, modeRef.current, deviceRef.current)
        : await manualCheckIn(text, deviceRef.current);
      show({ result, at: new Date() });
    } catch (err) {
      show({ error: errorMessageOf(err, 'Could not reach the server'), at: new Date() });
    } finally {
      busyRef.current = false;
      setBusy(false);
      inputRef.current?.focus();
    }
  }, [scan, manualCheckIn, show]);

  const onCameraRead = useCallback((text: string) => {
    const now = Date.now();
    if (text === lastCardRef.current.text && now - lastCardRef.current.at < SAME_CARD_MS) return;
    lastCardRef.current = { text, at: now };
    submit(text);
  }, [submit]);

  const stopCamera = useCallback(async () => {
    const camera = cameraRef.current;
    cameraRef.current = null;
    setCameraOn(false);
    if (camera) {
      try { await camera.stop(); camera.clear(); } catch { /* already stopped */ }
    }
  }, []);

  const startCamera = useCallback(async () => {
    setCameraError(null);
    try {
      // Loaded on demand: the library touches `window` and isn't needed for handheld scanners
      const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import('html5-qrcode');
      const camera = new Html5Qrcode(CAMERA_ELEMENT_ID, {
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        verbose: false,
      });
      cameraRef.current = camera;
      await camera.start({ facingMode: 'environment' }, { fps: 10, qrbox: { width: 240, height: 240 } }, onCameraRead, () => { /* no code in frame */ });
      setCameraOn(true);
    } catch (err) {
      cameraRef.current = null;
      setCameraError(errorMessageOf(err, 'Camera unavailable. Allow camera access, or use a handheld scanner.'));
    }
  }, [onCameraRead]);

  useEffect(() => () => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    stopCamera();
  }, [stopCamera]);

  // Keep the input focused so a handheld (keyboard) scanner always types into it
  useEffect(() => {
    const refocus = () => {
      const active = document.activeElement;
      if (!active || active === document.body) inputRef.current?.focus();
    };
    const id = setInterval(refocus, 1000);
    return () => clearInterval(id);
  }, []);

  const view = current ? headline(current) : null;
  const student = current && 'result' in current ? current.result.student : null;

  return (
    <div className="min-h-screen bg-[#f8fafc] p-4 lg:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-3">
              <ScanLine className="h-8 w-8 text-indigo-600" /> Scan ID Cards
            </h1>
            <p className="text-slate-500 mt-1">Scan a student&apos;s card, or type their admission number and press Enter.</p>
          </div>
          <div className="flex items-center gap-2 rounded-xl bg-white border border-slate-200 p-1">
            {(['check_in', 'check_out'] as ScanMode[]).map(m => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold ${mode === m ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                {m === 'check_in' ? <LogIn className="h-4 w-4" /> : <LogOut className="h-4 w-4" />}
                {m === 'check_in' ? 'Check in' : 'Check out'}
              </button>
            ))}
          </div>
        </div>

        {/* Result */}
        <div className={`rounded-3xl p-8 min-h-[180px] flex items-center gap-6 text-white transition-colors ${view ? TONE_STYLES[view.tone] : 'bg-slate-800'}`}>
          {view ? (
            <>
              {student?.photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={student.photo} alt="" className="h-28 w-28 rounded-2xl object-cover border-4 border-white/40" />
              ) : (
                <div className="h-28 w-28 rounded-2xl bg-white/20 flex items-center justify-center text-4xl font-bold">
                  {student ? student.name.split(' ').map(n => n[0]).join('').slice(0, 2) : view.tone === 'error' ? <XCircle className="h-14 w-14" /> : <CheckCircle2 className="h-14 w-14" />}
                </div>
              )}
              <div className="min-w-0">
                <div className="text-4xl font-black">{view.title}</div>
                {student && <div className="text-2xl font-semibold mt-1 truncate">{student.name}</div>}
                {student?.class_name && <div className="text-lg opacity-90">{student.class_name}</div>}
                <div className="text-lg mt-2 opacity-95">{view.detail}</div>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-4 text-slate-300">
              <ScanLine className="h-12 w-12" />
              <span className="text-2xl font-semibold">{busy ? 'Checking...' : 'Ready to scan'}</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Handheld scanner / typed entry */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
            <div className="flex items-center gap-2 font-bold text-slate-700"><Keyboard className="h-5 w-5" /> Scanner / admission number</div>
            <form onSubmit={e => { e.preventDefault(); const value = entry; setEntry(''); submit(value); }}>
              <input
                ref={inputRef}
                autoFocus
                value={entry}
                onChange={e => setEntry(e.target.value)}
                placeholder="Scan a card or type an admission number"
                autoComplete="off"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-lg font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
              />
            </form>
            <div className="space-y-1">
              <label htmlFor="device" className="text-xs font-semibold text-slate-500">This device (shown in the attendance history)</label>
              <input
                id="device"
                value={device}
                onChange={e => { setDevice(e.target.value); saveDevice(e.target.value); }}
                placeholder="e.g. Main gate tablet"
                maxLength={100}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-500"
              />
            </div>
            <p className="text-xs text-slate-400">Typed admission numbers are recorded as a manual check-in (for damaged or forgotten cards).</p>
          </div>

          {/* Camera */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-slate-700"><Camera className="h-5 w-5" /> Camera</div>
              <button
                onClick={() => (cameraOn ? stopCamera() : startCamera())}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold ${cameraOn ? 'bg-slate-100 text-slate-700' : 'bg-indigo-600 text-white'}`}
              >
                {cameraOn ? <CameraOff className="h-4 w-4" /> : <Camera className="h-4 w-4" />}
                {cameraOn ? 'Stop camera' : 'Start camera'}
              </button>
            </div>
            <div id={CAMERA_ELEMENT_ID} className="w-full overflow-hidden rounded-xl bg-slate-100 min-h-[60px]" />
            {cameraError && <p className="text-sm text-rose-600">{cameraError}</p>}
          </div>
        </div>

        {/* Recent */}
        {recent.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
            <div className="px-5 py-3 font-bold text-slate-700 flex items-center gap-2 border-b border-slate-100"><Clock className="h-4 w-4" /> Recent scans</div>
            <ul className="divide-y divide-slate-100">
              {recent.map((outcome, i) => {
                const h = headline(outcome);
                const s = 'result' in outcome ? outcome.result.student : null;
                return (
                  <li key={i} className="flex items-center justify-between gap-4 px-5 py-2.5 text-sm">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${TONE_STYLES[h.tone]}`} />
                      <span className="font-semibold text-slate-800 truncate">{s?.name ?? h.title}</span>
                      <span className="text-slate-500 truncate">{s ? `${h.title} · ${h.detail}` : h.detail}</span>
                    </div>
                    <span className="text-xs text-slate-400 shrink-0">{outcome.at.toLocaleTimeString()}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
