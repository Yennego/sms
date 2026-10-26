'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { errorMessageOf } from '@/utils/error-utils';
import { CalendarOff, CalendarPlus, Loader2, Save, Trash2 } from 'lucide-react';

import PermissionGuard from '@/components/auth/permission-guard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useDailyAttendanceService } from '@/services/api/daily-attendance-service';
import { AttendanceSettings, SchoolCalendarDay } from '@/types/daily-attendance';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']; // index = date.weekday()

const COMMON_TIMEZONES = [
  'Africa/Monrovia', 'Africa/Accra', 'Africa/Lagos', 'Africa/Freetown', 'Africa/Abidjan',
  'Africa/Nairobi', 'Africa/Johannesburg', 'Europe/London', 'America/New_York', 'UTC',
];

const isoDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const addDays = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return isoDate(d);
};

// Backend sends "HH:MM:SS"; <input type="time"> wants "HH:MM"
const hhmm = (value: string) => value.slice(0, 5);

export default function AttendanceSettingsPage() {
  const { getSettings, updateSettings, listCalendar, setCalendarDay, deleteCalendarDay } = useDailyAttendanceService();

  const [settings, setSettings] = useState<AttendanceSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [days, setDays] = useState<SchoolCalendarDay[]>([]);
  const [newDay, setNewDay] = useState({ date: '', label: '', isSchoolDay: false });
  const [savingDay, setSavingDay] = useState(false);

  const loadCalendar = useCallback(async () => {
    try {
      setDays(await listCalendar(addDays(-30), addDays(365)));
    } catch (err) {
      toast.error(errorMessageOf(err, 'Failed to load the school calendar'));
    }
  }, [listCalendar]);

  useEffect(() => {
    getSettings()
      .then(s => setSettings({ ...s, late_after: hhmm(s.late_after), scan_closes_at: hhmm(s.scan_closes_at), auto_absent_at: hhmm(s.auto_absent_at) }))
      .catch((err: unknown) => toast.error(errorMessageOf(err, 'Failed to load attendance settings')));
  }, [getSettings]);

  useEffect(() => { loadCalendar(); }, [loadCalendar]);

  const update = <K extends keyof AttendanceSettings>(key: K, value: AttendanceSettings[K]) =>
    setSettings(prev => (prev ? { ...prev, [key]: value } : prev));

  const toggleDay = (day: number) => {
    if (!settings) return;
    const set = new Set(settings.school_days);
    if (set.has(day)) set.delete(day);
    else set.add(day);
    update('school_days', Array.from(set).sort());
  };

  const onSave = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const saved = await updateSettings(settings);
      setSettings({ ...saved, late_after: hhmm(saved.late_after), scan_closes_at: hhmm(saved.scan_closes_at), auto_absent_at: hhmm(saved.auto_absent_at) });
      toast.success('Attendance settings saved');
    } catch (err) {
      toast.error(errorMessageOf(err, 'Failed to save settings'));
    } finally {
      setSaving(false);
    }
  };

  const onAddDay = async () => {
    if (!newDay.date) {
      toast.error('Pick a date');
      return;
    }
    setSavingDay(true);
    try {
      await setCalendarDay(newDay.date, newDay.isSchoolDay, newDay.label.trim() || undefined);
      setNewDay({ date: '', label: '', isSchoolDay: false });
      await loadCalendar();
      toast.success('Calendar updated');
    } catch (err) {
      toast.error(errorMessageOf(err, 'Failed to update the calendar'));
    } finally {
      setSavingDay(false);
    }
  };

  const onDeleteDay = async (date: string) => {
    try {
      await deleteCalendarDay(date);
      setDays(prev => prev.filter(d => d.date !== date));
    } catch (err) {
      toast.error(errorMessageOf(err, 'Failed to remove the day'));
    }
  };

  return (
    <PermissionGuard requiredRole="admin" fallback={<div>You do not have permission to access this page.</div>}>
      <div className="container mx-auto px-4 py-8 space-y-6 max-w-4xl">
        <div>
          <h1 className="text-3xl font-bold">Attendance Settings</h1>
          <p className="text-gray-600 mt-1">School days, late and cut-off times, and holidays.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Daily rules</CardTitle>
          </CardHeader>
          <CardContent>
            {!settings ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : (
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="timezone">School timezone</Label>
                  <Input
                    id="timezone"
                    list="timezones"
                    value={settings.timezone}
                    onChange={e => update('timezone', e.target.value)}
                  />
                  <datalist id="timezones">
                    {COMMON_TIMEZONES.map(tz => <option key={tz} value={tz} />)}
                  </datalist>
                  <p className="text-xs text-gray-500">Decides what &quot;today&quot; is and when the times below apply.</p>
                </div>

                <div className="space-y-2">
                  <Label>School days</Label>
                  <div className="flex flex-wrap gap-2">
                    {WEEKDAYS.map((name, idx) => (
                      <button
                        key={name}
                        type="button"
                        onClick={() => toggleDay(idx)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-semibold border ${settings.school_days.includes(idx)
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="late_after">Late after</Label>
                    <Input id="late_after" type="time" value={settings.late_after} onChange={e => update('late_after', e.target.value)} />
                    <p className="text-xs text-gray-500">Scans after this time count as late.</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="scan_closes_at">Scanning closes</Label>
                    <Input id="scan_closes_at" type="time" value={settings.scan_closes_at} onChange={e => update('scan_closes_at', e.target.value)} />
                    <p className="text-xs text-gray-500">Scans after this time are rejected.</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="auto_absent_at">Auto-absent at</Label>
                    <Input id="auto_absent_at" type="time" value={settings.auto_absent_at} onChange={e => update('auto_absent_at', e.target.value)} />
                    <p className="text-xs text-gray-500">Students not marked by then are recorded absent.</p>
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div>
                    <Label htmlFor="checkout">Check-out scanning</Label>
                    <p className="text-xs text-gray-500">Allow a second scan at the end of the day to record when students leave.</p>
                  </div>
                  <Switch
                    id="checkout"
                    checked={settings.allow_checkout_scan}
                    onCheckedChange={checked => update('allow_checkout_scan', checked)}
                  />
                </div>

                <div className="flex justify-end">
                  <Button onClick={onSave} disabled={saving}>
                    {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                    Save settings
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Holidays &amp; make-up days</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr_auto_auto] gap-3 items-end">
              <div className="space-y-2">
                <Label htmlFor="cal-date">Date</Label>
                <Input id="cal-date" type="date" value={newDay.date} onChange={e => setNewDay(d => ({ ...d, date: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cal-label">Label</Label>
                <Input id="cal-label" placeholder="e.g. Independence Day" maxLength={100}
                  value={newDay.label} onChange={e => setNewDay(d => ({ ...d, label: e.target.value }))} />
              </div>
              <div className="flex items-center gap-2 pb-2">
                <Switch id="cal-school" checked={newDay.isSchoolDay} onCheckedChange={checked => setNewDay(d => ({ ...d, isSchoolDay: checked }))} />
                <Label htmlFor="cal-school" className="text-sm">Make-up school day</Label>
              </div>
              <Button onClick={onAddDay} disabled={savingDay}>
                {savingDay ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CalendarPlus className="h-4 w-4 mr-2" />}
                Add
              </Button>
            </div>

            {days.length === 0 ? (
              <p className="text-sm text-gray-500">No holidays or make-up days in the next year.</p>
            ) : (
              <ul className="divide-y rounded-lg border">
                {days.map(day => (
                  <li key={day.date} className="flex items-center justify-between px-4 py-3 text-sm">
                    <div className="flex items-center gap-3">
                      {day.is_school_day ? <CalendarPlus className="h-4 w-4 text-emerald-600" /> : <CalendarOff className="h-4 w-4 text-rose-600" />}
                      <span className="font-medium">
                        {new Date(`${day.date}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                      </span>
                      <span className="text-gray-500">{day.label || (day.is_school_day ? 'Make-up school day' : 'Holiday')}</span>
                    </div>
                    <button onClick={() => onDeleteDay(day.date)} title="Remove" className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-rose-600">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </PermissionGuard>
  );
}
