'use client';

import { useAuth } from '@/hooks/use-auth';
import { useTenant } from '@/hooks/use-tenant';
import {
    BookOpen, Users, Clock, Calendar,
    MapPin, ChevronRight, Search, GraduationCap,
    Award, FileText
} from 'lucide-react';
import Link from 'next/link';

import { useEnrollmentService } from '@/services/api/enrollment-service';
import { useClassService } from '@/services/api/class-service';
import { useEffect, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

export default function StudentCourses() {
    const { user } = useAuth();
    const { tenant } = useTenant();
    const [courses, setCourses] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [enrollment, setEnrollment] = useState<any>(null);

    const enrollmentService = useEnrollmentService();
    const classService = useClassService();

    useEffect(() => {
        const loadData = async () => {
            if (!user?.id) return;
            setLoading(true);
            try {
                // 1. Get current enrollment
                const currentEnrollment = await enrollmentService.getCurrentEnrollment(user.id);
                setEnrollment(currentEnrollment);

                if (currentEnrollment) {
                    // 2. Get classes for the student's grade/section
                    const classes = await classService.getClasses({
                        grade_id: currentEnrollment.grade_id,
                        section_id: currentEnrollment.section_id,
                        academic_year_id: currentEnrollment.academic_year_id,
                        is_active: true
                    });

                    // 3. For each class, get full details (subjects)
                    const coursesWithSubjects: any[] = [];
                    for (const cls of classes) {
                        const details = await classService.getClassWithDetails(cls.id);
                        if (details && details.subjects) {
                            details.subjects.forEach(sub => {
                                coursesWithSubjects.push({
                                    id: sub.id,
                                    name: sub.subject_name || 'Unknown Subject',
                                    code: sub.id.substring(0, 6).toUpperCase(), // Fallback code
                                    teacher: sub.teacher_name || 'TBA',
                                    grade: `${details.grade_name || ''} ${details.section_name || ''}`,
                                    status: 'Active',
                                    progress: Math.floor(Math.random() * 40) + 40 // Simulated progress for now as it's not in DB
                                });
                            });
                        }
                    }
                    setCourses(coursesWithSubjects);
                }
            } catch (error) {
                console.error('Failed to load student courses:', error);
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, [user?.id]);

    return (
        <div className="min-h-screen bg-[#f8fafc] p-6 lg:p-10">
            <div className="mx-auto max-w-7xl space-y-8">

                {/* Header */}
                <div className="flex justify-between items-end">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-3">
                            <BookOpen className="h-8 w-8 text-indigo-600" />
                            My Courses
                        </h1>
                        <p className="text-slate-500 mt-1">
                            {enrollment
                                ? `Enrolled in ${enrollment.grade_name || enrollment.grade} - ${enrollment.section_name || enrollment.section}`
                                : 'View all your registered subjects and academic progress.'}
                        </p>
                    </div>
                </div>

                {/* Courses Grid */}
                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="bg-white rounded-3xl shadow-sm border border-slate-100 p-8 space-y-6">
                                <div className="flex justify-between">
                                    <Skeleton className="h-12 w-12 rounded-2xl" />
                                    <Skeleton className="h-6 w-20 rounded-full" />
                                </div>
                                <div className="space-y-2">
                                    <Skeleton className="h-8 w-3/4" />
                                    <Skeleton className="h-4 w-1/4" />
                                </div>
                                <div className="space-y-4 pt-4">
                                    <Skeleton className="h-4 w-full" />
                                    <Skeleton className="h-6 w-full rounded-full" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : courses.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {courses.map((course) => (
                            <div key={course.id} className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden hover:shadow-xl transition-all group flex flex-col">
                                <div className="p-8 flex-1">
                                    <div className="flex justify-between items-start mb-6">
                                        <div className="p-3 bg-indigo-50 rounded-2xl group-hover:bg-indigo-600 transition-colors">
                                            <GraduationCap className="h-7 w-7 text-indigo-600 group-hover:text-white" />
                                        </div>
                                        <span className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-bold uppercase tracking-widest">
                                            {course.status}
                                        </span>
                                    </div>

                                    <h3 className="text-xl font-bold text-slate-900 mb-2">{course.name}</h3>
                                    <p className="text-xs font-medium text-slate-400 uppercase tracking-widest mb-6">{course.code}</p>

                                    <div className="space-y-4">
                                        <div className="flex items-center gap-3 text-sm text-slate-500">
                                            <Users className="h-4 w-4 text-slate-400" />
                                            <span>Instructor: <span className="font-bold text-slate-700">{course.teacher}</span></span>
                                        </div>
                                        <div className="space-y-2">
                                            <div className="flex justify-between text-[11px] font-bold text-slate-500">
                                                <span>Completion</span>
                                                <span>{course.progress}%</span>
                                            </div>
                                            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-indigo-500 rounded-full transition-all duration-1000"
                                                    style={{ width: `${course.progress}%` }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="px-8 py-5 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between">
                                    <Link
                                        href={`#`}
                                        className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 group-hover:translate-x-1 transition-transform"
                                    >
                                        Course Material
                                        <ChevronRight className="h-3 w-3" />
                                    </Link>
                                    <div className="flex gap-4">
                                        <div className="flex flex-col items-center">
                                            <span className="text-[10px] text-slate-400 font-bold uppercase">Grades</span>
                                            <Award className="h-4 w-4 text-slate-400" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="bg-white rounded-3xl p-20 text-center border border-dashed border-slate-200">
                        <div className="p-4 bg-slate-50 rounded-full w-fit mx-auto mb-6">
                            <FileText className="h-10 w-10 text-slate-300" />
                        </div>
                        <h3 className="text-xl font-bold text-slate-900">No Courses Found</h3>
                        <p className="text-slate-500 mt-2">You don't seem to be enrolled in any active courses yet.</p>
                    </div>
                )}

            </div>
        </div>
    );
}
