'use client';

import { useAuth } from '@/hooks/use-auth';
import { useTenant } from '@/hooks/use-tenant';
import {
    FileText, Calendar, Award, BookOpen, ArrowLeft, TrendingUp
} from 'lucide-react';
import Link from 'next/link';

import { useStudentGradeService } from '@/services/api/student-grade-service';
import { useEnrollmentService } from '@/services/api/enrollment-service';
import { useEffect, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';

export default function StudentExamsPage() {
    const { user } = useAuth();
    const { tenant } = useTenant();
    const studentGradeService = useStudentGradeService();
    const enrollmentService = useEnrollmentService();

    const [loading, setLoading] = useState(true);
    const [grades, setGrades] = useState<any[]>([]);
    const [enrollment, setEnrollment] = useState<any>(null);

    useEffect(() => {
        const loadData = async () => {
            if (!user?.id) return;
            setLoading(true);
            try {
                const currentEnrollment = await enrollmentService.getCurrentEnrollment(user.id);
                setEnrollment(currentEnrollment);

                if (currentEnrollment) {
                    const allGrades = await studentGradeService.getGrades({
                        student_id: user.id,
                        academic_year_id: currentEnrollment.academic_year_id
                    });

                    // Filter for Exams only (and maybe Mid-Term, Final)
                    const examGrades = allGrades.filter((g: any) =>
                        ['exam', 'mid-term', 'final', 'test'].some(t =>
                            (g.assessment_type || '').toLowerCase().includes(t) ||
                            (g.assessment_name || '').toLowerCase().includes('exam')
                        )
                    );
                    setGrades(examGrades);
                }
            } catch (err) {
                console.error('Failed to load exams:', err);
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
                <div>
                    <Link href="./dashboard" className="text-sm font-bold text-slate-400 hover:text-indigo-600 flex items-center gap-1 mb-2">
                        <ArrowLeft className="h-4 w-4" /> Back to Dashboard
                    </Link>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-3">
                        <FileText className="h-8 w-8 text-indigo-600" />
                        Exam Results
                    </h1>
                    <p className="text-slate-500 mt-1">
                        {enrollment
                            ? `Official examination results for ${enrollment.academic_year?.name || 'Current Academic Year'}`
                            : 'View your performance in major examinations.'}
                    </p>
                </div>

                {/* Exam List */}
                <div className="space-y-6">
                    {loading ? (
                        [1, 2, 3].map(i => <Skeleton key={i} className="h-24 rounded-2xl" />)
                    ) : grades.length > 0 ? (
                        grades.map((exam) => (
                            <div key={exam.id} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:shadow-md transition-all group">
                                <div className="flex items-center gap-6">
                                    <div className={`w-16 h-16 rounded-2xl flex flex-col items-center justify-center font-black text-xl shadow-inner ${(exam.percentage || 0) >= 50
                                        ? 'bg-emerald-50 text-emerald-600'
                                        : 'bg-rose-50 text-rose-600'
                                        }`}>
                                        {exam.letter_grade || '-'}
                                        <span className="text-[10px] font-medium opacity-60">GRADE</span>
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <Badge variant="outline" className="bg-slate-50 text-slate-500 border-slate-200">
                                                {exam.subject_name || 'General'}
                                            </Badge>
                                            <span className="text-xs text-slate-400 font-medium flex items-center gap-1">
                                                <Calendar className="h-3 w-3" />
                                                {format(new Date(exam.assessment_date), 'MMMM dd, yyyy')}
                                            </span>
                                        </div>
                                        <h3 className="text-lg font-bold text-slate-900 group-hover:text-indigo-700 transition-colors">
                                            {exam.assessment_name}
                                        </h3>
                                        <p className="text-sm text-slate-500 mt-1">
                                            {exam.assessment_type || 'Exam'}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-8 border-t md:border-t-0 md:border-l border-slate-50 pt-4 md:pt-0 md:pl-8">
                                    <div className="text-center">
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Score</p>
                                        <p className="text-2xl font-black text-slate-900">
                                            {exam.score} <span className="text-base text-slate-400 font-medium">/ {exam.max_score}</span>
                                        </p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Percentage</p>
                                        <div className={`px-3 py-1 rounded-full font-bold text-sm ${(exam.percentage || 0) >= 50 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                                            }`}>
                                            {Math.round(exam.percentage || 0)}%
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="bg-white rounded-3xl p-20 text-center border border-dashed border-slate-200">
                            <div className="p-4 bg-slate-50 rounded-full w-fit mx-auto mb-6">
                                <FileText className="h-10 w-10 text-slate-300" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900">No Exams Recorded</h3>
                            <p className="text-slate-500 mt-2">There are no exam results available for this academic year yet.</p>
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
}
