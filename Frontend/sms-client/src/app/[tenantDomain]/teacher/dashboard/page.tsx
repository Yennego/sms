'use client';

import { useAuth } from '@/hooks/use-auth';
import { useTenant } from '@/hooks/use-tenant';
import {
    Users, BookOpen, GraduationCap, ClipboardList,
    Clock, Calendar, Award,
    ChevronRight, Plus, FileText
} from 'lucide-react';
import Link from 'next/link';
import { useDashboardService } from '@/services/api/dashboard-service';
import { useTeacherService } from '@/services/api/teacher-service';
import { useTimetableService, type Timetable } from '@/services/api/timetable-service';
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';
import { SponsorTodayCard } from '@/components/attendance/SponsorTodayCard';

interface Lesson {
    id: string;
    time: string;
    subject: string;
    className: string;
}

const hhmm = (t: string) => (t || '').slice(0, 5);

/** The teacher's slots on today's weekday, earliest first (a slot's class_id is the subject assignment). */
function lessonsToday(timetables: Timetable[], assignmentIds: Set<string>, teacherId: string): Lesson[] {
    const today = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    const seen = new Set<string>();
    const lessons: (Lesson & { start: string })[] = [];
    for (const t of timetables) {
        if (!t.is_active || seen.has(t.id)) continue; // the teacher filter can return a timetable twice
        seen.add(t.id);
        for (const slot of t.time_slots) {
            if ((slot.day_of_week || '').toLowerCase() !== today) continue;
            const mine = (slot.class_id && assignmentIds.has(slot.class_id)) || slot.teacher_id === teacherId;
            if (!mine) continue;
            lessons.push({
                id: slot.id,
                start: slot.start_time,
                time: `${hhmm(slot.start_time)}–${hhmm(slot.end_time)}`,
                subject: slot.subject_name || slot.name,
                className: [t.grade_name, t.section_name].filter(Boolean).join(' - ') || t.name,
            });
        }
    }
    return lessons.sort((a, b) => a.start.localeCompare(b.start));
}

export default function TeacherDashboard() {
    const { user } = useAuth();
    const { tenant } = useTenant();
    const dashboardService = useDashboardService();
    const { getTeacherAssignments } = useTeacherService();
    const { getTimetables } = useTimetableService();

    const { data: statsData, isLoading: statsLoading } = useQuery({
        queryKey: ['dashboard-stats', user?.id],
        queryFn: () => dashboardService.getStats(),
        enabled: !!user?.id
    });

    // Today's lessons: timetable slots of the subjects this teacher is assigned to
    const { data: todaysLessons, isLoading: scheduleLoading } = useQuery({
        queryKey: ['teacher-today-lessons', user?.id],
        queryFn: async () => {
            const teacherId = user?.id as string;
            const [assignments, timetables] = await Promise.all([
                getTeacherAssignments(teacherId),
                getTimetables({ teacher_id: teacherId }),
            ]);
            return lessonsToday(timetables, new Set(assignments.map((a: { id: string }) => a.id)), teacherId);
        },
        enabled: !!user?.id
    });

    const teacherName = user?.firstName || 'Teacher';
    const t = statsData?.teacher_stats;

    const stats = [
        { label: 'Assigned Classes', value: t?.assigned_classes?.toString() || '0', icon: BookOpen, color: 'text-indigo-600', bg: 'bg-indigo-50' },
        { label: 'Total Students', value: t?.total_students?.toString() || '0', icon: Users, color: 'text-emerald-600', bg: 'bg-emerald-50' },
        { label: 'Pending Grades', value: t?.pending_grades?.toString() || '0', icon: Clock, color: 'text-rose-600', bg: 'bg-rose-50' },
        { label: 'Active Assignments', value: t?.active_assignments?.toString() || '0', icon: FileText, color: 'text-blue-600', bg: 'bg-blue-50' },
    ];

    return (
        <div className="min-h-screen bg-[#f8fafc] p-6 lg:p-10">
            <div className="mx-auto max-w-7xl space-y-8">

                {/* Welcome Header */}
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
                            Welcome back, <span style={{ color: (tenant?.primaryColor || '#4f46e5') as any }}>{teacherName}!</span> 👋
                        </h1>
                        <p className="text-slate-500 mt-1">Here's what's happening in your classes today.</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <Link href="../academics/assignments" className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-100 uppercase tracking-wide">
                            <Plus className="h-4 w-4" />
                            Create Assignment
                        </Link>
                    </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {stats.map((stat, i) => (
                        <div key={i} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
                            <div className="flex items-center justify-between mb-4">
                                <div className={`p-2 ${stat.bg} rounded-lg`}>
                                    <stat.icon className={`h-6 w-6 ${stat.color}`} />
                                </div>
                            </div>
                            {statsLoading ? (
                                <Skeleton className="h-8 w-16" />
                            ) : (
                                <h3 className="text-2xl font-bold text-slate-900">{stat.value}</h3>
                            )}
                            <p className="text-sm text-slate-500 mt-0.5">{stat.label}</p>
                        </div>
                    ))}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

                    {/* Main Content - Schedule & Overview */}
                    <div className="lg:col-span-8 space-y-6">
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                            <div className="p-6 border-b border-slate-50 flex items-center justify-between">
                                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                                    <Calendar className="h-5 w-5 text-indigo-600" />
                                    Today&apos;s lessons
                                </h3>
                                <Link href="../academics/timetables" className="text-sm font-bold text-indigo-600 hover:text-indigo-700">Full timetable</Link>
                            </div>
                            <div className="divide-y divide-slate-50">
                                {scheduleLoading ? (
                                    [1, 2].map(i => (
                                        <div key={i} className="p-6 flex items-center gap-4">
                                            <Skeleton className="h-4 w-20" />
                                            <div className="space-y-2">
                                                <Skeleton className="h-4 w-40" />
                                                <Skeleton className="h-3 w-20" />
                                            </div>
                                        </div>
                                    ))
                                ) : todaysLessons && todaysLessons.length > 0 ? (
                                    todaysLessons.map((item) => (
                                        <div key={item.id} className="p-4 sm:p-6 flex items-center gap-4 sm:gap-6">
                                            <div className="text-sm font-bold text-slate-400 w-24 shrink-0 tabular-nums">{item.time}</div>
                                            <div className="min-w-0">
                                                <div className="font-bold text-slate-900 truncate">{item.subject}</div>
                                                <div className="text-xs text-slate-500">{item.className}</div>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="p-10 text-center text-slate-500 text-sm">
                                        You have no lessons on the timetable today.
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Sidebar - Quick Actions & Information */}
                    <div className="lg:col-span-4 space-y-6">
                        {user?.id && <SponsorTodayCard teacherId={user.id} attendanceHref="./attendance" />}
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                            <h3 className="text-lg font-bold text-slate-900 mb-6 font-display">Hub Actions</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <Link href="./attendance" className="flex flex-col items-center justify-center p-4 rounded-xl bg-indigo-50 border border-indigo-100 hover:bg-indigo-100 transition-colors group">
                                    <ClipboardList className="h-6 w-6 text-indigo-600 mb-2" />
                                    <span className="text-[10px] font-bold text-indigo-900 uppercase">Attendance</span>
                                </Link>
                                <Link href="../academics/assignments" className="flex flex-col items-center justify-center p-4 rounded-xl bg-emerald-50 border border-emerald-100 hover:bg-emerald-100 transition-colors group">
                                    <FileText className="h-6 w-6 text-emerald-600 mb-2" />
                                    <span className="text-[10px] font-bold text-emerald-900 uppercase">Assignments</span>
                                </Link>
                                <Link href="../academics/grading-hub" className="flex flex-col items-center justify-center p-4 rounded-xl bg-rose-50 border border-rose-100 hover:bg-rose-100 transition-colors group">
                                    <GraduationCap className="h-6 w-6 text-rose-600 mb-2" />
                                    <span className="text-[10px] font-bold text-rose-900 uppercase">Grading</span>
                                </Link>
                                <Link href="../academics/timetable" className="flex flex-col items-center justify-center p-4 rounded-xl bg-slate-50 border border-slate-100 hover:bg-slate-100 transition-colors group">
                                    <Calendar className="h-6 w-6 text-slate-600 mb-2" />
                                    <span className="text-[10px] font-bold text-slate-900 uppercase">Timetable</span>
                                </Link>
                            </div>
                        </div>

                        <div className="bg-gradient-to-br from-indigo-600 to-indigo-900 rounded-2xl p-6 text-white shadow-xl shadow-indigo-200">
                            <div className="flex items-center gap-3 mb-4">
                                <Award className="h-6 w-6 text-indigo-300" />
                                <h4 className="font-bold">Grading Status</h4>
                            </div>
                            <p className="text-sm text-indigo-100 leading-relaxed mb-6">
                                You have {t?.pending_grades || 0} assignments awaiting your review. Keeping feedback timely helps students grow faster!
                            </p>
                            <button
                                onClick={() => window.location.href = '../academics/grading-hub'}
                                className="w-full py-3 bg-white text-indigo-600 font-bold rounded-xl text-sm hover:bg-indigo-50 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-indigo-950/20"
                            >
                                Start Grading Now <ChevronRight className="h-4 w-4" />
                            </button>
                        </div>
                    </div>

                </div>

            </div>
        </div>
    );
}
