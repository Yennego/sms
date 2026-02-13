'use client';

import { useAuth } from '@/hooks/use-auth';
import { useTenant } from '@/hooks/use-tenant';
import {
    Users, BookOpen, GraduationCap, ClipboardList,
    Clock, Calendar, Award, MessageSquare,
    ChevronRight, Plus, ListChecks, FileText
} from 'lucide-react';
import { PermissionGuard } from '@/components/common/PermissionGuard';
import Link from 'next/link';
import { useDashboardService } from '@/services/api/dashboard-service';
import { useClassService } from '@/services/api/class-service';
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';

export default function TeacherDashboard() {
    const { user } = useAuth();
    const { tenant } = useTenant();
    const dashboardService = useDashboardService();
    const classService = useClassService();

    const { data: statsData, isLoading: statsLoading } = useQuery({
        queryKey: ['dashboard-stats', user?.id],
        queryFn: () => dashboardService.getStats(),
        enabled: !!user?.id
    });

    const { data: classes, isLoading: classesLoading } = useQuery({
        queryKey: ['teacher-classes', user?.id],
        queryFn: () => classService.getClasses({ teacher_id: user?.id, is_active: true }),
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

    const upcomingSchedule = classes?.slice(0, 3).map(c => ({
        id: c.id,
        time: 'Today',
        subject: c.subject_name || 'Class Session',
        class: `${c.grade_name} - ${c.section_name}`,
        room: 'Online'
    })) || [];

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
                                    My Schedule
                                </h3>
                                <Link href="../academics/timetable" className="text-sm font-bold text-indigo-600 hover:text-indigo-700">Full Timetable</Link>
                            </div>
                            <div className="divide-y divide-slate-50">
                                {classesLoading ? (
                                    [1, 2].map(i => (
                                        <div key={i} className="p-6 flex items-center gap-4">
                                            <Skeleton className="h-4 w-20" />
                                            <div className="space-y-2">
                                                <Skeleton className="h-4 w-40" />
                                                <Skeleton className="h-3 w-20" />
                                            </div>
                                        </div>
                                    ))
                                ) : upcomingSchedule.length > 0 ? (
                                    upcomingSchedule.map((item) => (
                                        <div key={item.id} className="p-6 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                                            <div className="flex items-center gap-6">
                                                <div className="text-sm font-bold text-slate-400 w-16 uppercase">{item.time}</div>
                                                <div>
                                                    <div className="font-bold text-slate-900">{item.subject}</div>
                                                    <div className="text-xs text-slate-500">{item.class} • {item.room}</div>
                                                </div>
                                            </div>
                                            <ChevronRight className="h-4 w-4 text-slate-300" />
                                        </div>
                                    ))
                                ) : (
                                    <div className="p-10 text-center text-slate-500 text-sm italic">
                                        No active classes assigned yet.
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                            <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                                <ListChecks className="h-5 w-5 text-indigo-600" />
                                Recent Activity
                            </h3>
                            <div className="h-[200px] flex items-center justify-center bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-400 text-sm italic">
                                Activity logs will appear here as the term progresses.
                            </div>
                        </div>
                    </div>

                    {/* Sidebar - Quick Actions & Information */}
                    <div className="lg:col-span-4 space-y-6">
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                            <h3 className="text-lg font-bold text-slate-900 mb-6 font-display">Hub Actions</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <Link href="./classes" className="flex flex-col items-center justify-center p-4 rounded-xl bg-indigo-50 border border-indigo-100 hover:bg-indigo-100 transition-colors group">
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
