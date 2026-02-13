'use client';

import { useAuth } from '@/hooks/use-auth';
import { useTenant } from '@/hooks/use-tenant';
import {
    GraduationCap, BookOpen, Clock, Calendar,
    Award, FileText, CheckCircle2, AlertCircle,
    TrendingUp, MessageSquare, ChevronRight
} from 'lucide-react';
import Link from 'next/link';
import { useDashboardService } from '@/services/api/dashboard-service';
import { useAssignmentService } from '@/services/api/assignment-service';
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';

export default function StudentDashboard() {
    const { user } = useAuth();
    const { tenant } = useTenant();
    const dashboardService = useDashboardService();
    const assignmentService = useAssignmentService();

    const { data: statsData, isLoading: statsLoading } = useQuery({
        queryKey: ['dashboard-stats', user?.id],
        queryFn: () => dashboardService.getStats(),
        enabled: !!user?.id
    });

    const { data: assignments, isLoading: assignmentsLoading } = useQuery({
        queryKey: ['upcoming-assignments', user?.id], // Use user.id or another existing property
        queryFn: () => assignmentService.getAssignments({ is_published: true }),
        enabled: !!user?.id
    });

    const studentName = user?.firstName || 'Student';

    const s = statsData?.student_stats;
    const stats = [
        { label: 'GPA (Est.)', value: s?.gpa?.toFixed(1) || '0.0', icon: TrendingUp, color: 'text-indigo-600', bg: 'bg-indigo-50' },
        { label: 'Active Courses', value: s?.active_courses?.toString() || '0', icon: BookOpen, color: 'text-emerald-600', bg: 'bg-emerald-50' },
        { label: 'Pending Tasks', value: s?.pending_tasks?.toString() || '0', icon: FileText, color: 'text-rose-600', bg: 'bg-rose-50' },
        { label: 'Attendance', value: `${s?.attendance_percentage || 0}%`, icon: CheckCircle2, color: 'text-blue-600', bg: 'bg-blue-50' },
    ];

    // Filter for upcoming deadlines (due in the future and not yet submitted if logic was in backend)
    const upcomingDeadlines = assignments?.slice(0, 3).map(a => ({
        id: a.id,
        title: a.title,
        subject: a.subject_name,
        due: new Date(a.due_date).toLocaleDateString(),
        status: 'pending' // Simplified for now
    })) || [];

    return (
        <div className="min-h-screen bg-[#f8fafc] p-6 lg:p-10">
            <div className="mx-auto max-w-7xl space-y-8">

                {/* Welcome Header */}
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
                            Hello, <span style={{ color: (tenant?.primaryColor || '#4f46e5') as any }}>{studentName}!</span> ✨
                        </h1>
                        <p className="text-slate-500 mt-1">Ready to continue your learning journey today?</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-sm font-medium px-4 py-2 bg-white border border-slate-200 rounded-lg shadow-sm flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-slate-400" />
                            {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
                        </span>
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
                                <Skeleton className="h-8 w-20" />
                            ) : (
                                <h3 className="text-2xl font-bold text-slate-900">{stat.value}</h3>
                            )}
                            <p className="text-sm text-slate-500 mt-0.5">{stat.label}</p>
                        </div>
                    ))}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

                    {/* Main - Upcoming Deadlines & Progress */}
                    <div className="lg:col-span-8 space-y-6">
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                            <div className="p-6 border-b border-slate-50 flex items-center justify-between">
                                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                                    <Clock className="h-5 w-5 text-indigo-600" />
                                    Upcoming Deadlines
                                </h3>
                                <Link href="../academics/assignments" className="text-sm font-bold text-indigo-600 hover:text-indigo-700">View All</Link>
                            </div>
                            <div className="divide-y divide-slate-50">
                                {assignmentsLoading ? (
                                    [1, 2].map(i => (
                                        <div key={i} className="p-6 flex items-center gap-4">
                                            <Skeleton className="h-8 w-8 rounded-full" />
                                            <div className="space-y-2">
                                                <Skeleton className="h-4 w-40" />
                                                <Skeleton className="h-3 w-20" />
                                            </div>
                                        </div>
                                    ))
                                ) : upcomingDeadlines.length > 0 ? (
                                    upcomingDeadlines.map((item) => (
                                        <div key={item.id} className="p-6 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                                            <div className="flex items-center gap-4">
                                                <div className={`p-2 rounded-full ${item.status === 'submitted' ? 'bg-emerald-50' : 'bg-rose-50'}`}>
                                                    {item.status === 'submitted' ? (
                                                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                                                    ) : (
                                                        <AlertCircle className="h-4 w-4 text-rose-600" />
                                                    )}
                                                </div>
                                                <div>
                                                    <div className="font-bold text-slate-900">{item.title}</div>
                                                    <div className="text-xs text-slate-500">{item.subject} • Due: {item.due}</div>
                                                </div>
                                            </div>
                                            {item.status !== 'submitted' && (
                                                <Link
                                                    href="../academics/assignments"
                                                    className="text-xs font-bold text-indigo-600 hover:underline"
                                                >
                                                    Submit Now
                                                </Link>
                                            )}
                                        </div>
                                    ))
                                ) : (
                                    <div className="p-10 text-center text-slate-500 text-sm italic">
                                        No upcoming assignments found.
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                            <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                                <Award className="h-5 w-5 text-indigo-600" />
                                Recent Results
                            </h3>
                            <div className="space-y-4">
                                <div className="p-10 text-center text-slate-500 text-sm italic bg-slate-50 rounded-xl border border-dashed border-slate-200">
                                    No recent graded work available yet.
                                </div>
                            </div>
                            <Link href="./grades" className="mt-4 block text-center py-2 text-sm font-bold text-indigo-600 hover:text-indigo-700">
                                View Full Grade History
                            </Link>
                        </div>
                    </div>

                    {/* Sidebar - Quick Links & Announcements */}
                    <div className="lg:col-span-4 space-y-6">
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                            <h3 className="text-lg font-bold text-slate-900 mb-6">Learning Gems</h3>
                            <div className="space-y-3">
                                <Link href="./courses" className="flex items-center justify-between p-3 rounded-xl border border-transparent hover:border-slate-100 hover:bg-slate-50 transition-all group">
                                    <div className="flex items-center gap-3">
                                        <BookOpen className="h-5 w-5 text-indigo-500" />
                                        <span className="text-sm font-bold text-slate-700">My Courses</span>
                                    </div>
                                    <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-indigo-500" />
                                </Link>
                                <Link href="./timetable" className="flex items-center justify-between p-3 rounded-xl border border-transparent hover:border-slate-100 hover:bg-slate-50 transition-all group">
                                    <div className="flex items-center gap-3">
                                        <Calendar className="h-5 w-5 text-emerald-500" />
                                        <span className="text-sm font-bold text-slate-700">Timetable</span>
                                    </div>
                                    <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-emerald-500" />
                                </Link>
                                <Link href="./attendance" className="flex items-center justify-between p-3 rounded-xl border border-transparent hover:border-slate-100 hover:bg-slate-50 transition-all group">
                                    <div className="flex items-center gap-3">
                                        <CheckCircle2 className="h-5 w-5 text-blue-500" />
                                        <span className="text-sm font-bold text-slate-700">Attendance</span>
                                    </div>
                                    <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-blue-500" />
                                </Link>
                            </div>
                        </div>

                        <div className="bg-gradient-to-br from-indigo-600 to-indigo-900 rounded-2xl p-6 text-white shadow-xl shadow-indigo-200">
                            <div className="flex items-center gap-3 mb-4">
                                <MessageSquare className="h-6 w-6 text-indigo-300" />
                                <h4 className="font-bold">Student Hub</h4>
                            </div>
                            <p className="text-sm text-indigo-100 leading-relaxed mb-6">
                                Got questions about your subjects? Use the communication center to reach out to your teachers.
                            </p>
                            <button
                                onClick={() => window.location.href = './communication'}
                                className="w-full py-3 bg-white text-indigo-600 font-bold rounded-xl text-sm hover:bg-indigo-50 transition-colors flex items-center justify-center gap-2"
                            >
                                Go to Messenger <ChevronRight className="h-4 w-4" />
                            </button>
                        </div>
                    </div>

                </div>

            </div>
        </div>
    );
}
