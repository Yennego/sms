'use client';

import { useAuth } from '@/hooks/use-auth';
import { useTenant } from '@/hooks/use-tenant';
import {
    ClipboardList, ArrowLeft, CheckCircle2,
    XCircle, Clock, Calendar, BarChart3
} from 'lucide-react';
import Link from 'next/link';

import { useAttendanceService } from '@/services/api/attendance-service';
import { useEnrollmentService } from '@/services/api/enrollment-service';
import { useEffect, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';

export default function StudentAttendance() {
    const { user } = useAuth();
    const { tenant } = useTenant();
    const attendanceService = useAttendanceService();
    const enrollmentService = useEnrollmentService();

    const [loading, setLoading] = useState(true);
    const [summary, setSummary] = useState<any>(null);
    const [logs, setLogs] = useState<any[]>([]);
    const [enrollment, setEnrollment] = useState<any>(null);

    useEffect(() => {
        const loadAttendanceData = async () => {
            if (!user?.id) return;
            setLoading(true);
            try {
                // 1. Get current enrollment
                const currentEnrollment = await enrollmentService.getCurrentEnrollment(user.id);
                setEnrollment(currentEnrollment);

                if (currentEnrollment) {
                    // 2. Get attendance summary
                    const attendanceSummary = await attendanceService.getAttendanceSummary({
                        student_id: user.id,
                        academic_year_id: currentEnrollment.academic_year_id
                    } as any);
                    setSummary(attendanceSummary);

                    // 3. Get recent attendance logs
                    const attendanceLogs = await attendanceService.getAttendanceRecords({
                        student_id: user.id,
                        academic_year_id: currentEnrollment.academic_year_id
                    });

                    // Sort by date descending and take top 10
                    const sortedLogs = attendanceLogs
                        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                        .slice(0, 10);

                    setLogs(sortedLogs);
                }
            } catch (error) {
                console.error('Failed to load attendance data:', error);
            } finally {
                setLoading(false);
            }
        };
        loadAttendanceData();
    }, [user?.id]);

    return (
        <div className="min-h-screen bg-[#f8fafc] p-6 lg:p-10">
            <div className="mx-auto max-w-7xl space-y-8">

                {/* Header */}
                <div>
                    <Link href="./dashboard" className="text-sm font-bold text-slate-400 hover:text-indigo-600 flex items-center gap-1 mb-2">
                        <ArrowLeft className="h-4 w-4" /> Back to Dashboard
                    </Link>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-3">
                        <ClipboardList className="h-8 w-8 text-indigo-600" />
                        My Attendance Record
                    </h1>
                    <p className="text-slate-500 mt-1">
                        {enrollment
                            ? `${enrollment.academic_year_name || enrollment.academic_year} • Semester 1`
                            : 'Academic Year 2025/2026 • Semester 1'}
                    </p>
                </div>

                {/* Attendance Summary */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    {loading ? (
                        [1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32 rounded-2xl" />)
                    ) : (
                        <>
                            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Total Presence</p>
                                <p className="text-3xl font-extrabold text-indigo-600">{summary?.attendance_percentage || summary?.attendance_rate || 0}%</p>
                                <div className="w-full h-1 bg-slate-100 rounded-full mt-4 overflow-hidden">
                                    <div className="h-full bg-indigo-500" style={{ width: `${summary?.attendance_percentage || summary?.attendance_rate || 0}%` }}></div>
                                </div>
                            </div>
                            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Days Present</p>
                                <p className="text-3xl font-extrabold text-emerald-600">{summary?.present_count || 0}</p>
                            </div>
                            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Days Absent</p>
                                <p className="text-3xl font-extrabold text-rose-600">{summary?.absent_count || 0}</p>
                            </div>
                            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Late arrivals</p>
                                <p className="text-3xl font-extrabold text-orange-600">{summary?.late_count || 0}</p>
                            </div>
                        </>
                    )}
                </div>

                {/* Attendance Log */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                    <div className="p-6 border-b border-slate-50 flex items-center justify-between">
                        <h3 className="text-lg font-bold text-slate-900">Recent Attendance Log</h3>
                        <BarChart3 className="h-5 w-5 text-slate-300" />
                    </div>
                    <div className="divide-y divide-slate-100">
                        {loading ? (
                            [1, 2, 3].map(i => (
                                <div key={i} className="p-6 flex items-center justify-between">
                                    <div className="space-y-2">
                                        <Skeleton className="h-5 w-24" />
                                        <Skeleton className="h-3 w-16" />
                                    </div>
                                    <Skeleton className="h-6 w-20 rounded-lg" />
                                </div>
                            ))
                        ) : logs.length > 0 ? (
                            logs.map((log) => (
                                <div key={log.id} className="p-6 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                                    <div className="flex items-center gap-6">
                                        <div className="flex flex-col">
                                            <span className="text-sm font-bold text-slate-900">{format(new Date(log.date), 'EEEE')}</span>
                                            <span className="text-[10px] text-slate-400 font-medium">{log.date}</span>
                                        </div>
                                        <div className="hidden md:block">
                                            <span className="text-xs text-slate-500 font-medium">Remarks: <span className="italic">{log.comments || log.notes || '-'}</span></span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center gap-2 ${log.status === 'present' ? 'bg-emerald-50 text-emerald-700' :
                                            log.status === 'absent' ? 'bg-rose-50 text-rose-700' :
                                                'bg-orange-50 text-orange-700'
                                            }`}>
                                            {log.status === 'present' && <CheckCircle2 className="h-3 w-3" />}
                                            {log.status === 'absent' && <XCircle className="h-3 w-3" />}
                                            {log.status === 'late' && <Clock className="h-3 w-3" />}
                                            {log.status}
                                        </span>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="p-20 text-center">
                                <div className="p-4 bg-slate-50 rounded-full w-fit mx-auto mb-6">
                                    <ClipboardList className="h-10 w-10 text-slate-300" />
                                </div>
                                <h3 className="text-lg font-bold text-slate-900">No Attendance Records</h3>
                                <p className="text-slate-500 mt-2">No attendance data has been logged for you yet.</p>
                            </div>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
}
