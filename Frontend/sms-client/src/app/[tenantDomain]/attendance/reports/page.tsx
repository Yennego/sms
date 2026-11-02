'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { BarChart3, Download, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';
import { useTenant } from '@/hooks/use-tenant';
import { useClassService } from '@/services/api/class-service';
import { useDailyAttendanceService } from '@/services/api/daily-attendance-service';
import { ClassAttendanceReport } from '@/types/daily-attendance';
import { errorMessageOf } from '@/utils/error-utils';

interface ClassOption { id: string; name: string }

const rate = (value: number | null) => (value === null ? '—' : `${value}%`);

function downloadCsv(report: ClassAttendanceReport) {
  const header = ['Student', 'Admission No.', 'Present', 'Late', 'Absent', 'Excused', 'Sick', 'Not marked', 'Rate (%)'];
  const rows = report.rows.map(r => [
    r.student_name, r.admission_number ?? '', r.present, r.late, r.absent, r.excused, r.sick, r.unmarked,
    r.attendance_rate ?? '',
  ]);
  const escape = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const csv = [header, ...rows].map(line => line.map(escape).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `attendance-${(report.class_name ?? 'class').replace(/\s+/g, '-')}-${report.start_date}-to-${report.end_date}.csv`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export default function AttendanceReportsPage() {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const { getClasses } = useClassService();
  const { getClassReport } = useDailyAttendanceService();

  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [classId, setClassId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [report, setReport] = useState<ClassAttendanceReport | null>(null);
  const [loading, setLoading] = useState(false);

  const isAdmin = Array.isArray(user?.roles)
    ? user.roles.some((r: unknown) => ['admin', 'superadmin', 'super-admin'].includes(typeof r === 'string' ? r : (r as { name?: string })?.name ?? ''))
    : user?.role === 'admin';
  const wholeSchool = isAdmin || (user?.permissions ?? []).includes('view_school_attendance');

  // Admins, the principal and the registrar report on any class; a sponsor on the classes they sponsor
  useEffect(() => {
    if (!user?.id) return;
    getClasses(wholeSchool ? { is_active: true } : { class_teacher_id: user.id, is_active: true })
      .then(list => {
        const options = list.map(c => ({ id: c.id, name: c.name || `${c.grade_name} ${c.section_name}` }));
        setClasses(options);
        if (options.length === 1) setClassId(options[0].id);
      })
      .catch((err: unknown) => toast.error(errorMessageOf(err, 'Failed to load classes')));
  }, [user?.id, wholeSchool, getClasses]);

  const run = async () => {
    if (!classId) {
      toast.error('Choose a class');
      return;
    }
    setLoading(true);
    try {
      const data = await getClassReport(classId, startDate || undefined, endDate || undefined);
      setReport(data);
      setStartDate(data.start_date);
      setEndDate(data.end_date);
    } catch (err) {
      setReport(null);
      toast.error(errorMessageOf(err, 'Failed to build the report'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3"><BarChart3 className="h-8 w-8" /> Attendance Reports</h1>
        <p className="text-gray-600 mt-1">School-day attendance per student for a class. Leave the dates empty for the academic year so far.</p>
      </div>

      <div className="bg-white rounded-2xl border shadow-sm p-4 flex flex-wrap items-end gap-4">
        <div className="space-y-1">
          <label className="text-xs font-semibold text-gray-500" htmlFor="report-class">Class</label>
          <select id="report-class" value={classId} onChange={e => { setClassId(e.target.value); setReport(null); }}
            className="block min-w-[220px] px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:border-indigo-500">
            <option value="">-- Select a class --</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-semibold text-gray-500" htmlFor="report-start">From</label>
          <input id="report-start" type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
            className="block px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:border-indigo-500" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-semibold text-gray-500" htmlFor="report-end">To</label>
          <input id="report-end" type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
            className="block px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:border-indigo-500" />
        </div>
        <Button onClick={run} disabled={loading || !classId}>
          {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <BarChart3 className="h-4 w-4 mr-2" />}
          Show report
        </Button>
        {report && (
          <Button variant="outline" onClick={() => downloadCsv(report)}>
            <Download className="h-4 w-4 mr-2" /> Export CSV
          </Button>
        )}
      </div>

      {report && (
        <>
          <p className="text-sm text-gray-600">
            <b>{report.class_name}</b> · {new Date(`${report.start_date}T00:00:00`).toLocaleDateString()} – {new Date(`${report.end_date}T00:00:00`).toLocaleDateString()} · {report.school_days} school days · class rate <b>{rate(report.totals.attendance_rate)}</b>
          </p>
          <div className="bg-white rounded-2xl border shadow-sm overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase tracking-wider text-gray-500">
                <tr>
                  <th className="px-5 py-3">Student</th>
                  <th className="px-3 py-3 text-right">Present</th>
                  <th className="px-3 py-3 text-right">Late</th>
                  <th className="px-3 py-3 text-right">Absent</th>
                  <th className="px-3 py-3 text-right">Excused</th>
                  <th className="px-3 py-3 text-right">Sick</th>
                  <th className="px-3 py-3 text-right">Not marked</th>
                  <th className="px-5 py-3 text-right">Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {report.rows.length === 0 ? (
                  <tr><td colSpan={8} className="px-5 py-10 text-center text-gray-500">No students are enrolled in this class.</td></tr>
                ) : report.rows.map(r => (
                  <tr key={r.student_id} className="hover:bg-gray-50">
                    <td className="px-5 py-3">
                      <Link href={`/${tenant?.domain}/attendance/students/${r.student_id}`} className="font-semibold text-indigo-700 hover:underline">
                        {r.student_name}
                      </Link>
                      <div className="text-xs text-gray-500">{r.admission_number}</div>
                    </td>
                    <td className="px-3 py-3 text-right text-emerald-700">{r.present}</td>
                    <td className="px-3 py-3 text-right text-orange-600">{r.late}</td>
                    <td className="px-3 py-3 text-right text-rose-700">{r.absent}</td>
                    <td className="px-3 py-3 text-right text-sky-700">{r.excused}</td>
                    <td className="px-3 py-3 text-right text-violet-700">{r.sick}</td>
                    <td className={`px-3 py-3 text-right ${r.unmarked ? 'text-amber-600' : 'text-gray-400'}`}>{r.unmarked}</td>
                    <td className="px-5 py-3 text-right font-semibold">{rate(r.attendance_rate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
