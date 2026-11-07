'use client';

// Attendance rules: the school's time zone, school days, late / scanning / cut-off times, check-out
// scanning, and holidays and make-up days.

import * as React from 'react';
import { CalendarOff, CalendarPlus, Loader2, Lock, Save, Trash2 } from 'lucide-react';

import { useAttendanceAccess } from '@/components/attendance/attendance-ui';
import {
  useAttendanceSettings,
  useSaveAttendanceSettings,
  useSchoolCalendar,
  useSetCalendarDay,
} from '@/components/attendance/queries';
import { errorMessage, formatDate, isoDay } from '@/components/students/format';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { PageShell } from '@/components/ui/page-shell';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { notify } from '@/components/ui/toaster';
import { cn } from '@/lib/utils';
import type { AttendanceSettings } from '@/types/daily-attendance';

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']; // index = date.weekday()
const COMMON_TIMEZONES = [
  'Africa/Monrovia', 'Africa/Accra', 'Africa/Lagos', 'Africa/Freetown', 'Africa/Abidjan',
  'Africa/Nairobi', 'Africa/Johannesburg', 'Europe/London', 'America/New_York', 'UTC',
];
const inputClass = 'h-11 text-base md:h-9 md:text-sm';

// The server sends "HH:MM:SS"; <input type="time"> wants "HH:MM"
const hhmm = (value: string) => value.slice(0, 5);
const forForm = (s: AttendanceSettings): AttendanceSettings => ({
  ...s,
  late_after: hhmm(s.late_after),
  scan_closes_at: hhmm(s.scan_closes_at),
  auto_absent_at: hhmm(s.auto_absent_at),
});
const shift = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return isoDay(d);
};

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4 rounded-xl border bg-card p-4 md:p-6" aria-label={title}>
      <div>
        <h2 className="text-base font-semibold">{title}</h2>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

function RulesForm({ initial }: { initial: AttendanceSettings }) {
  const save = useSaveAttendanceSettings();
  const [form, setForm] = React.useState<AttendanceSettings>(() => forForm(initial));
  const [error, setError] = React.useState<string>();
  const set = <K extends keyof AttendanceSettings>(key: K, value: AttendanceSettings[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const toggleDay = (day: number) => {
    const days = new Set(form.school_days);
    if (days.has(day)) days.delete(day);
    else days.add(day);
    set('school_days', Array.from(days).sort());
  };

  const onSave = async () => {
    if (form.school_days.length === 0) {
      setError('Choose at least one school day.');
      return;
    }
    if (!form.timezone.trim()) {
      setError('Enter the school time zone, for example Africa/Monrovia.');
      return;
    }
    setError(undefined);
    try {
      const saved = await save.mutateAsync({ ...form, timezone: form.timezone.trim() });
      setForm(forForm(saved));
      notify.success('Attendance rules saved.');
    } catch (err) {
      notify.error(errorMessage(err, "The rules weren't saved. Check the times and try again."));
    }
  };

  return (
    <Section title="Daily rules" description="When a school day starts counting, and when it closes.">
      <FormField
        label="School time zone"
        description='Decides what "today" is and when the times below apply.'
        className="max-w-sm"
      >
        <Input
          list="timezones"
          className={inputClass}
          value={form.timezone}
          onChange={(e) => set('timezone', e.target.value)}
        />
      </FormField>
      <datalist id="timezones">
        {COMMON_TIMEZONES.map((tz) => (
          <option key={tz} value={tz} />
        ))}
      </datalist>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">School days</legend>
        <div className="flex flex-wrap gap-2">
          {WEEKDAYS.map((name, idx) => {
            const on = form.school_days.includes(idx);
            return (
              <button
                key={name}
                type="button"
                aria-pressed={on}
                onClick={() => toggleDay(idx)}
                className={cn(
                  'min-h-11 rounded-md border px-3 text-sm font-medium md:min-h-9',
                  on ? 'border-primary bg-primary text-primary-foreground' : 'bg-background hover:bg-muted'
                )}
              >
                {name}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-3">
        <FormField label="Late after" description="Scans after this time count as late.">
          <Input type="time" className={inputClass} value={form.late_after} onChange={(e) => set('late_after', e.target.value)} />
        </FormField>
        <FormField label="Scanning closes" description="Scans after this time are refused.">
          <Input type="time" className={inputClass} value={form.scan_closes_at} onChange={(e) => set('scan_closes_at', e.target.value)} />
        </FormField>
        <FormField label="Absent after" description="Students still not marked are recorded absent.">
          <Input type="time" className={inputClass} value={form.auto_absent_at} onChange={(e) => set('auto_absent_at', e.target.value)} />
        </FormField>
      </div>

      <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
        <div>
          <label htmlFor="checkout" className="text-sm font-medium">
            Check-out scanning
          </label>
          <p className="text-sm text-muted-foreground">A second scan at the end of the day records when students leave.</p>
        </div>
        <Switch id="checkout" checked={form.allow_checkout_scan} onCheckedChange={(on) => set('allow_checkout_scan', on)} />
      </div>

      {error ? (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}
      <div className="flex justify-end">
        <Button className="min-h-11 md:min-h-9" onClick={onSave} disabled={save.isPending}>
          {save.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Save aria-hidden="true" />}
          Save rules
        </Button>
      </div>
    </Section>
  );
}

function Holidays() {
  const from = React.useMemo(() => shift(-30), []);
  const to = React.useMemo(() => shift(365), []);
  const calendar = useSchoolCalendar(from, to);
  const setDay = useSetCalendarDay();
  const [draft, setDraft] = React.useState({ date: '', label: '', isSchoolDay: false });
  const [error, setError] = React.useState<string>();

  const add = async () => {
    if (!draft.date) {
      setError('Choose the date.');
      return;
    }
    setError(undefined);
    try {
      await setDay.mutateAsync({ date: draft.date, isSchoolDay: draft.isSchoolDay, label: draft.label.trim() || undefined });
      notify.success(`${formatDate(draft.date)} is ${draft.isSchoolDay ? 'a make-up school day' : 'a holiday'}.`);
      setDraft({ date: '', label: '', isSchoolDay: false });
    } catch (err) {
      notify.error(errorMessage(err, "The day wasn't added. Try again."));
    }
  };

  const remove = async (date: string) => {
    try {
      await setDay.mutateAsync({ date, remove: true });
      notify.success(`${formatDate(date)} follows the normal school days again.`);
    } catch (err) {
      notify.error(errorMessage(err, "The day wasn't removed. Try again."));
    }
  };

  const days = calendar.data ?? [];
  return (
    <Section
      title="Holidays and make-up days"
      description="A holiday closes a normal school day; a make-up day opens a day that is normally off."
    >
      <div className="grid items-end gap-3 sm:grid-cols-[minmax(0,10rem)_minmax(0,1fr)_auto_auto]">
        <FormField label="Date" error={error}>
          <Input type="date" className={inputClass} value={draft.date} onChange={(e) => setDraft((d) => ({ ...d, date: e.target.value }))} />
        </FormField>
        <FormField label="Name (optional)">
          <Input
            className={inputClass}
            placeholder="For example: Independence Day"
            maxLength={100}
            value={draft.label}
            onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))}
          />
        </FormField>
        <div className="flex min-h-11 items-center gap-2 md:min-h-9">
          <Switch id="makeup" checked={draft.isSchoolDay} onCheckedChange={(on) => setDraft((d) => ({ ...d, isSchoolDay: on }))} />
          <label htmlFor="makeup" className="text-sm">
            Make-up school day
          </label>
        </div>
        <Button className="min-h-11 md:min-h-9" onClick={add} disabled={setDay.isPending}>
          <CalendarPlus aria-hidden="true" />
          Add day
        </Button>
      </div>

      {calendar.isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : calendar.isError ? (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage(calendar.error, "The calendar didn't load.")} Reload the page to try again.
        </p>
      ) : days.length === 0 ? (
        <EmptyState icon={CalendarOff} description="No holidays or make-up days in the next year. Add them above." />
      ) : (
        <ul className="divide-y rounded-lg border">
          {days.map((day) => (
            <li key={day.date} className="flex items-center justify-between gap-3 px-4 py-2">
              <div className="flex min-w-0 items-center gap-3">
                {day.is_school_day ? (
                  <CalendarPlus className="size-4 shrink-0 text-green-700" aria-hidden="true" />
                ) : (
                  <CalendarOff className="size-4 shrink-0 text-red-700" aria-hidden="true" />
                )}
                <div className="min-w-0">
                  <p className="font-medium">{formatDate(day.date)}</p>
                  <p className="text-sm text-muted-foreground">
                    {day.label || (day.is_school_day ? 'Make-up school day' : 'Holiday')}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="min-h-11 md:min-h-9"
                onClick={() => remove(day.date)}
                disabled={setDay.isPending}
                aria-label={`Remove ${formatDate(day.date)}`}
              >
                <Trash2 aria-hidden="true" />
                Remove
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

export default function AttendanceRulesPage() {
  const { isLoading, runsSchool } = useAttendanceAccess();
  const settings = useAttendanceSettings();

  if (!isLoading && !runsSchool) {
    return (
      <PageShell title="Attendance rules">
        <EmptyState icon={Lock} description="Only the school's admins change the attendance rules." />
      </PageShell>
    );
  }

  return (
    <PageShell title="Attendance rules" description="School days, late and cut-off times, holidays and make-up days.">
      {settings.isLoading || isLoading ? (
        <Skeleton className="h-72 w-full rounded-xl" />
      ) : settings.isError || !settings.data ? (
        <EmptyState
          icon={Lock}
          title="The rules didn't load"
          description={`${errorMessage(settings.error, 'The server didn’t answer.')} Check your connection and try again.`}
          action={<Button onClick={() => settings.refetch()}>Try again</Button>}
        />
      ) : (
        <RulesForm initial={settings.data} />
      )}
      <Holidays />
    </PageShell>
  );
}
