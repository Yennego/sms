import { AttendanceSource, DailyStatus } from '@/types/daily-attendance';

// Shared look for school-day statuses (roster, history, scanner)
export const STATUS_STYLES: Record<DailyStatus, { label: string; badge: string; button: string }> = {
  present: { label: 'Present', badge: 'bg-emerald-100 text-emerald-700', button: 'bg-emerald-600 text-white shadow-emerald-200' },
  late: { label: 'Late', badge: 'bg-orange-100 text-orange-700', button: 'bg-orange-500 text-white shadow-orange-200' },
  tardy: { label: 'Tardy', badge: 'bg-orange-100 text-orange-700', button: 'bg-orange-500 text-white shadow-orange-200' },
  absent: { label: 'Absent', badge: 'bg-rose-100 text-rose-700', button: 'bg-rose-600 text-white shadow-rose-200' },
  excused: { label: 'Excused', badge: 'bg-sky-100 text-sky-700', button: 'bg-sky-600 text-white shadow-sky-200' },
  sick: { label: 'Sick', badge: 'bg-sky-100 text-sky-700', button: 'bg-sky-600 text-white shadow-sky-200' }, // blue, like excused (design brief 4.1)
};

export const SOURCE_LABELS: Record<AttendanceSource, string> = { qr: 'QR scan', manual: 'Manual', auto: 'Auto' };
