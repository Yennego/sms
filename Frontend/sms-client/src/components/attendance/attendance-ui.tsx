'use client';

// Shared pieces of the Attendance area: who may see or run the school's attendance, status badges
// in the fixed colours (design brief 4.1, always with a label), count tiles, the day notices and
// the class picker.

import * as React from 'react';
import { AlertTriangle, Info } from 'lucide-react';

import { selectClass } from '@/components/students/admission-form';
import { StatusBadge, type StatusBadgeStatus } from '@/components/ui/status-badge';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';
import type { DailyStatus, SchoolDayInfo } from '@/types/daily-attendance';

const ADMIN_ROLES = ['admin', 'tenant-admin', 'super-admin', 'superadmin'];

/**
 * What the signed-in person may do with the whole school's attendance (the server decides; this
 * only shapes the screens): admins, and anyone with manage_school_attendance, run it; the principal
 * and registrar (view_school_attendance) read it.
 */
export function useAttendanceAccess() {
  const { user, isLoading } = useAuth();
  const roles = new Set(
    [user?.role, ...(user?.roles ?? []).map((r: { name?: string } | string) => (typeof r === 'string' ? r : r?.name))]
      .filter(Boolean) as string[]
  );
  const permissions = new Set(user?.permissions ?? []);
  const runsSchool = [...roles].some((r) => ADMIN_ROLES.includes(r)) || permissions.has('manage_school_attendance');
  return {
    user,
    isLoading,
    runsSchool,
    viewsSchool: runsSchool || permissions.has('view_school_attendance'),
    isTeacher: roles.has('teacher'),
  };
}

const BADGE: Record<DailyStatus, StatusBadgeStatus> = {
  present: 'present',
  late: 'late',
  tardy: 'late',
  absent: 'absent',
  excused: 'excused',
  sick: 'sick',
};

const LABEL: Record<DailyStatus, string> = {
  present: 'Present',
  late: 'Late',
  tardy: 'Late',
  absent: 'Absent',
  excused: 'Excused',
  sick: 'Sick',
};

export function dailyStatusLabel(status: DailyStatus): string {
  return LABEL[status] ?? status;
}

export function DailyStatusBadge({ status, size }: { status: DailyStatus | null; size?: 'sm' | 'md' }) {
  if (!status) return <StatusBadge status="neutral" label="Not marked" size={size} />;
  return <StatusBadge status={BADGE[status] ?? 'neutral'} label={LABEL[status] ?? status} size={size} />;
}

export function rate(value: number | null | undefined): string {
  return value === null || value === undefined ? '–' : `${Math.round(value)}%`;
}

export interface CountTile {
  label: string;
  value: React.ReactNode;
  /** Status colour for the label (omit for a neutral tile) */
  status?: StatusBadgeStatus;
}

/** Numbers with their label; the status tiles use the fixed status colours and icons. */
export function CountTiles({ tiles, className }: { tiles: CountTile[]; className?: string }) {
  return (
    <dl className={cn('grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4', className)}>
      {tiles.map((t) => (
        <div key={t.label} className="rounded-xl border bg-card p-4">
          <dt className="text-sm text-muted-foreground">
            {t.status ? <StatusBadge status={t.status} label={t.label} /> : t.label}
          </dt>
          <dd className="mt-2 text-2xl font-semibold tabular-nums">{t.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** "Not a school day" and "the cut-off has passed" notices for a day. */
export function DayNotices({
  day,
  marking = false,
}: {
  day: Pick<SchoolDayInfo, 'is_school_day' | 'reason' | 'auto_absent_applied'>;
  /** On a marking screen the notices say what that means for marking */
  marking?: boolean;
}) {
  return (
    <>
      {!day.is_school_day ? (
        <div role="status" className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <AlertTriangle className="size-5 shrink-0" aria-hidden="true" />
          <p>
            <span className="font-semibold">Not a school day</span>
            {day.reason ? `: ${day.reason}` : ''}.{marking ? " Attendance can't be marked." : ''}
          </p>
        </div>
      ) : null}
      {day.auto_absent_applied ? (
        <div role="status" className="flex gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
          <Info className="size-5 shrink-0" aria-hidden="true" />
          <p>
            The cut-off time has passed: students who weren&apos;t marked or scanned are recorded absent.
            {marking ? ' You can still correct any student.' : ''}
          </p>
        </div>
      ) : null}
    </>
  );
}

/** A labelled class picker (native select: large on phones, quick with a keyboard). */
export function ClassPicker({
  id,
  value,
  onChange,
  classes,
  loading,
  placeholder = 'Choose a class',
  className,
}: {
  id: string;
  value: string;
  onChange: (classId: string) => void;
  classes: { id: string; name: string }[];
  loading?: boolean;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={cn('grid gap-2', className)}>
      <label htmlFor={id} className="text-sm font-medium">
        Class
      </label>
      <select id={id} className={selectClass} value={value} onChange={(e) => onChange(e.target.value)} disabled={loading}>
        <option value="">{loading ? 'Loading classes…' : placeholder}</option>
        {classes.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </div>
  );
}

/** A labelled date input. */
export function DateField({
  id,
  label,
  value,
  onChange,
  max,
  className,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (date: string) => void;
  max?: string;
  className?: string;
}) {
  return (
    <div className={cn('grid gap-2', className)}>
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        type="date"
        className={selectClass}
        value={value}
        max={max || undefined}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
