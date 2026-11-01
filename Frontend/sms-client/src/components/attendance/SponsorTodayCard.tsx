'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ClipboardList, Loader2 } from 'lucide-react';

import { useClassService } from '@/services/api/class-service';
import { useDailyAttendanceService } from '@/services/api/daily-attendance-service';
import { DailyRoster } from '@/types/daily-attendance';

interface SponsorTodayCardProps {
  teacherId: string;
  attendanceHref: string;
}

/** Today's attendance for the class this teacher sponsors (renders nothing for non-sponsors). */
export function SponsorTodayCard({ teacherId, attendanceHref }: SponsorTodayCardProps) {
  const { getClasses } = useClassService();
  const { getRoster } = useDailyAttendanceService();
  const [rosters, setRosters] = useState<DailyRoster[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    getClasses({ class_teacher_id: teacherId, is_active: true })
      .then(classes => Promise.all(classes.map(c => getRoster(c.id))))
      .then(result => { if (!cancelled) setRosters(result); })
      .catch(() => { if (!cancelled) setRosters([]); });
    return () => { cancelled = true; };
  }, [teacherId, getClasses, getRoster]);

  if (rosters === null) {
    return (
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
      </div>
    );
  }
  if (rosters.length === 0) return null;

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-slate-900">My class today</h3>
        <Link href={attendanceHref} className="text-sm font-semibold text-indigo-600 hover:underline">Open roster</Link>
      </div>
      {rosters.map(roster => {
        const count = (...statuses: string[]) =>
          roster.entries.filter(e => e.record && statuses.includes(e.record.status)).length;
        const unmarked = roster.entries.filter(e => !e.record).length;
        const stats = [
          { label: 'Present', value: count('present', 'tardy'), style: 'text-emerald-700' },
          { label: 'Late', value: count('late'), style: 'text-orange-600' },
          { label: 'Absent', value: count('absent'), style: 'text-rose-700' },
          { label: 'Excused', value: count('excused', 'sick'), style: 'text-sky-700' },
        ];
        return (
          <div key={roster.class_id} className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <ClipboardList className="h-4 w-4 text-indigo-600" /> {roster.class_name}
              {!roster.day.is_school_day && <span className="text-xs font-medium text-amber-600">· {roster.day.reason ?? 'No school today'}</span>}
            </div>
            <div className="grid grid-cols-4 gap-2 text-center">
              {stats.map(s => (
                <div key={s.label} className="rounded-xl bg-slate-50 py-2">
                  <div className={`text-xl font-black ${s.style}`}>{s.value}</div>
                  <div className="text-[10px] font-bold uppercase text-slate-400">{s.label}</div>
                </div>
              ))}
            </div>
            {roster.day.is_school_day && unmarked > 0 && (
              <p className="text-xs font-semibold text-amber-600">{unmarked} student{unmarked === 1 ? '' : 's'} not marked yet</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
