'use client';

import { useAuth } from '@/hooks/use-auth';
import { useTenant } from '@/hooks/use-tenant';
import {
    Award, TrendingUp, BookOpen, ChevronRight,
    Filter, Calendar, FileText, PieChart, School, User, SignpostBig,
    Scale, ChevronDown, ChevronUp, Info
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState, useMemo } from 'react';

import { useStudentGradeService } from '@/services/api/student-grade-service';
import { useEnrollmentService } from '@/services/api/enrollment-service';
import { useGradingService, GradingSchema } from '@/services/api/grading-service';
import { Skeleton } from '@/components/ui/skeleton';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { format } from 'date-fns';

export default function StudentGrades() {
    const { user } = useAuth();
    const { tenant } = useTenant();
    const gradeService = useStudentGradeService();
    const enrollmentService = useEnrollmentService();
    const gradingService = useGradingService();

    const [loading, setLoading] = useState(true);
    const [reportCard, setReportCard] = useState<any>(null);
    const [grades, setGrades] = useState<any[]>([]);
    const [enrollment, setEnrollment] = useState<any>(null);

    // Grading schema states
    const [gradingSchemas, setGradingSchemas] = useState<GradingSchema[]>([]);
    const [showSchemaInfo, setShowSchemaInfo] = useState(false);

    useEffect(() => {
        const loadGradeData = async () => {
            if (!user?.id) return;
            setLoading(true);
            try {
                // 1. Get current enrollment
                const currentEnrollment = await enrollmentService.getCurrentEnrollment(user.id);
                setEnrollment(currentEnrollment);

                if (currentEnrollment) {
                    // 2. Get report card summary
                    const academicYearName = typeof currentEnrollment.academic_year === 'string'
                        ? currentEnrollment.academic_year
                        : currentEnrollment.academic_year?.name || '';

                    const rc = await gradeService.getReportCard(user.id, academicYearName);
                    setReportCard(rc);

                    // 3. Get detailed grade breakdown
                    const allGrades = await gradeService.getGrades({ student_id: user.id });
                    setGrades(allGrades);

                    // 4. Get grading schemas for visibility
                    const schemas = await gradingService.getGradingSchemas();
                    setGradingSchemas(schemas || []);
                }
            } catch (error) {
                console.error('Failed to load grade data:', error);
            } finally {
                setLoading(false);
            }
        };
        loadGradeData();
    }, [user?.id]);

    const [activeTab, setActiveTab] = useState<'history' | 'report'>('history');

    return (
        <div className="min-h-screen bg-[#f8fafc] p-6 lg:p-10">
            <div className="mx-auto max-w-7xl space-y-8">
                {/* Header */}
                <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-3">
                            <Award className="h-8 w-8 text-indigo-600" />
                            My Learning Results
                        </h1>
                        <p className="text-slate-500 mt-1">
                            {enrollment
                                ? `${enrollment.academic_year?.name || enrollment.academic_year || '2025/2026'} • Semester 1 • ${enrollment.grade_name || enrollment.grade}`
                                : 'Track your performance across all assessments and subjects.'}
                        </p>
                    </div>

                    {/* View Switcher */}
                    <div className="flex p-1 bg-white rounded-xl border border-slate-200 shadow-sm">
                        <button
                            onClick={() => setActiveTab('history')}
                            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'history'
                                ? 'bg-indigo-50 text-indigo-700 shadow-sm'
                                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                                }`}
                        >
                            <TrendingUp className="h-4 w-4" />
                            Grade History
                        </button>
                        <button
                            onClick={() => setActiveTab('report')}
                            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'report'
                                ? 'bg-indigo-50 text-indigo-700 shadow-sm'
                                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                                }`}
                        >
                            <FileText className="h-4 w-4" />
                            Official Report Card
                        </button>
                    </div>
                </div>

                {/* How My Grade is Calculated - Collapsible Panel */}
                {gradingSchemas.length > 0 && (
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                        <button
                            onClick={() => setShowSchemaInfo(!showSchemaInfo)}
                            className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors"
                        >
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-amber-100 rounded-lg">
                                    <Scale className="w-4 h-4 text-amber-600" />
                                </div>
                                <div className="text-left">
                                    <h3 className="font-bold text-slate-800 text-sm">How My Grade is Calculated</h3>
                                    <p className="text-xs text-slate-500">Understand how each assessment type contributes to your final score</p>
                                </div>
                            </div>
                            {showSchemaInfo ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                        </button>
                        {showSchemaInfo && (
                            <div className="px-6 pb-6 pt-2 border-t border-slate-100">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {gradingSchemas.filter(s => s.is_active).map(schema => (
                                        <div key={schema.id} className="bg-gradient-to-br from-slate-50 to-amber-50/30 rounded-xl p-5 border border-slate-100">
                                            <div className="flex items-center gap-2 mb-4">
                                                <Award className="w-5 h-5 text-amber-600" />
                                                <span className="font-bold text-slate-800">{schema.name}</span>
                                            </div>
                                            {schema.description && (
                                                <p className="text-xs text-slate-500 mb-4 flex items-start gap-1.5">
                                                    <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
                                                    {schema.description}
                                                </p>
                                            )}
                                            <div className="space-y-3">
                                                {schema.categories.map(cat => (
                                                    <div key={cat.id}>
                                                        <div className="flex items-center justify-between mb-1">
                                                            <span className="text-sm font-medium text-slate-700">{cat.name}</span>
                                                            <span className="text-sm font-bold text-amber-600">{cat.weight}%</span>
                                                        </div>
                                                        <div className="h-2.5 bg-slate-200 rounded-full overflow-hidden">
                                                            <div
                                                                className="h-full bg-gradient-to-r from-amber-400 to-amber-500 rounded-full transition-all"
                                                                style={{ width: `${cat.weight}%` }}
                                                            />
                                                        </div>
                                                        {cat.description && (
                                                            <p className="text-[10px] text-slate-400 mt-1">{cat.description}</p>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="mt-4 pt-3 border-t border-slate-200/50 flex justify-between items-center">
                                                <span className="text-xs font-medium text-slate-500">Total Weight</span>
                                                <span className={`text-sm font-bold ${schema.categories.reduce((a, c) => a + c.weight, 0) === 100 ? 'text-emerald-600' : 'text-amber-600'}`}>
                                                    {schema.categories.reduce((a, c) => a + c.weight, 0)}%
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <p className="text-xs text-slate-400 mt-4 text-center italic">
                                    Your final grade is calculated by combining scores from each category based on these weights.
                                </p>
                            </div>
                        )}
                    </div>
                )}

                {/* Content Area */}
                <div className="min-h-[500px]">
                    {activeTab === 'history' ? (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            {loading ? (
                                [1, 2, 3].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)
                            ) : grades.length > 0 ? (
                                // Group grades by subject
                                (Object.entries(grades.reduce((acc, g) => {
                                    const sub = g.subject_name || 'General';
                                    if (!acc[sub]) acc[sub] = [];
                                    acc[sub].push(g);
                                    return acc;
                                }, {} as Record<string, any[]>)) as [string, any[]][]).map(([subject, subGrades]) => (
                                    <div key={subject} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                                        <div className="p-4 border-b border-slate-50 bg-slate-50/30 flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600">
                                                <BookOpen className="h-4 w-4" />
                                            </div>
                                            <h4 className="font-bold text-slate-800 uppercase tracking-tight text-sm flex-1">{subject}</h4>
                                            <Badge variant="outline" className="bg-white">{subGrades.length} Activities</Badge>
                                        </div>
                                        <div className="overflow-x-auto">
                                            <table className="w-full">
                                                <thead className="bg-slate-50/50 border-b border-slate-100">
                                                    <tr className="text-left">
                                                        <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Date</th>
                                                        <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Activity Type</th>
                                                        <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Assessment Name</th>
                                                        <th className="px-6 py-3 text-center text-[10px] font-bold text-slate-400 uppercase tracking-wider">Score / Target</th>
                                                        <th className="px-6 py-3 text-center text-[10px] font-bold text-slate-400 uppercase tracking-wider">Grade</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-50">
                                                    {subGrades.map((res) => (
                                                        <tr key={res.id} className="hover:bg-indigo-50/30 transition-colors group">
                                                            <td className="px-6 py-4 text-xs font-medium text-slate-400 whitespace-nowrap w-[1%]">
                                                                {format(new Date(res.assessment_date), 'MMM dd')}
                                                            </td>
                                                            <td className="px-6 py-4 w-[1%] whitespace-nowrap">
                                                                <Badge variant="secondary" className="bg-slate-100 text-slate-600 border-none font-bold text-[10px] uppercase">
                                                                    {res.assessment_type}
                                                                </Badge>
                                                            </td>
                                                            <td className="px-6 py-4 text-sm font-semibold text-slate-700 group-hover:text-indigo-700 transition-colors">
                                                                {res.assessment_name}
                                                            </td>
                                                            <td className="px-6 py-4 text-center whitespace-nowrap">
                                                                <div className="flex flex-col items-center">
                                                                    <span className="text-sm font-black text-slate-800">
                                                                        {res.score} <span className="text-slate-300 font-normal">/</span> {res.max_score}
                                                                    </span>
                                                                    <div className="h-1 w-16 bg-slate-100 rounded-full mt-1 overflow-hidden">
                                                                        <div
                                                                            className={`h-full rounded-full ${res.percentage >= 50 ? 'bg-emerald-500' : 'bg-rose-500'}`}
                                                                            style={{ width: `${Math.min(res.percentage, 100)}%` }}
                                                                        />
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            <td className="px-6 py-4 text-center w-[1%]">
                                                                <span className={`px-2.5 py-1 rounded-md font-bold text-xs border ${['A', 'B'].some(g => (res.letter_grade || '').startsWith(g))
                                                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                                                    : 'bg-indigo-50 text-indigo-700 border-indigo-100'
                                                                    }`}>
                                                                    {res.letter_grade || '-'}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="py-20 text-center bg-white rounded-3xl border border-dashed border-slate-200">
                                    <div className="p-4 bg-slate-50 rounded-full w-fit mx-auto mb-6">
                                        <TrendingUp className="h-10 w-10 text-slate-300" />
                                    </div>
                                    <h3 className="text-lg font-bold text-slate-900">No Grades Recorded Yet</h3>
                                    <p className="text-slate-500 mt-2 max-w-sm mx-auto">
                                        As you complete assignments, quizzes, and exams, your real-time results will appear here.
                                    </p>
                                </div>
                            )}
                        </div>
                    ) : (
                        /* Official Report Card View */
                        !loading && reportCard ? (
                            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <div className="mb-4 flex justify-end">
                                    <button
                                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold shadow-md shadow-indigo-200 hover:bg-indigo-700 transition-all flex items-center gap-2"
                                        onClick={() => window.print()}
                                    >
                                        <FileText className="h-4 w-4" />
                                        Print Official Use Copy
                                    </button>
                                </div>
                                <div id="report-card-replica" className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden max-w-5xl mx-auto print:shadow-none print:border-none print:m-0 print:rounded-none print-full-width">
                                    {/* Report Header */}
                                    <div className="bg-indigo-950 p-8 text-white flex justify-between items-start">
                                        <div className="flex items-center gap-6">
                                            <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center border border-white/20">
                                                <School className="w-10 h-10 text-indigo-300" />
                                            </div>
                                            <div>
                                                <h2 className="text-2xl font-black uppercase tracking-tighter">Academic Progress Report</h2>
                                                <div className="flex items-center gap-4 mt-1 opacity-70 text-sm font-medium">
                                                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> Session {reportCard.academic_year}</span>
                                                    <span>•</span>
                                                    <span>Period: Full Year</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xs font-black uppercase tracking-widest opacity-50">Report ID</p>
                                            <p className="text-lg font-mono font-bold">#{reportCard.student_id?.split('-')[0].toUpperCase()}</p>
                                        </div>
                                    </div>

                                    {/* Student Info Bar */}
                                    <div className="bg-indigo-50/50 border-b border-indigo-100/50 px-8 py-6 grid grid-cols-1 md:grid-cols-4 gap-6 text-left">
                                        <div>
                                            <Label className="text-[9px] uppercase font-black text-indigo-900/40 mb-1 block tracking-wider">Student Name</Label>
                                            <p className="font-bold text-gray-900 flex items-center gap-2">
                                                <User className="w-4 h-4 text-indigo-400" /> {reportCard.student_name}
                                            </p>
                                        </div>
                                        <div>
                                            <Label className="text-[9px] uppercase font-black text-indigo-900/40 mb-1 block tracking-wider">Admission #</Label>
                                            <p className="font-bold text-gray-900">{reportCard.admission_number}</p>
                                        </div>
                                        <div>
                                            <Label className="text-[9px] uppercase font-black text-indigo-900/40 mb-1 block tracking-wider">Level / Grade</Label>
                                            <p className="font-bold text-gray-900 uppercase">Grade: {reportCard.grade || 'N/A'}</p>
                                        </div>
                                        <div>
                                            <Label className="text-[9px] uppercase font-black text-indigo-900/40 mb-1 block tracking-wider">Cumulative GPA</Label>
                                            <div className="flex items-center gap-2">
                                                <p className="text-xl font-black text-indigo-600">{reportCard.gpa?.toFixed(2) || '0.00'}</p>
                                                <Badge className="bg-indigo-600 text-white border-none py-0 px-2 h-5 text-[10px]">PASS</Badge>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Performance Matrix */}
                                    <div className="p-8">
                                        <Table>
                                            <TableHeader>
                                                <TableRow className="border-indigo-100 hover:bg-transparent text-left">
                                                    <TableHead className="text-indigo-950 font-black uppercase text-[10px] w-[200px]">Subject / Unit</TableHead>
                                                    {(reportCard.active_columns || []).map((col: string) => (
                                                        <TableHead
                                                            key={col}
                                                            className={`text-center text-indigo-950 font-black uppercase text-[10px] ${['S1', 'S2', 'Final'].includes(col) ? 'bg-indigo-50' : 'bg-slate-50/50'}`}
                                                        >
                                                            {col}
                                                        </TableHead>
                                                    ))}
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {reportCard.subjects?.map((sub: any) => (
                                                    <TableRow key={sub.subject_id} className="border-indigo-50 group hover:bg-indigo-50/5 transition-colors text-left">
                                                        <TableCell className="py-3">
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-6 h-6 bg-gray-100 rounded flex items-center justify-center text-gray-400 group-hover:bg-indigo-100 group-hover:text-indigo-600 transition-colors">
                                                                    <BookOpen className="w-3 h-3" />
                                                                </div>
                                                                <span className="font-bold text-gray-800 text-sm">{sub.subject_name}</span>
                                                            </div>
                                                        </TableCell>
                                                        {(reportCard.active_columns || []).map((col: string) => {
                                                            let value: any = '-';
                                                            if (col.startsWith('P')) value = sub.period_grades?.[col];
                                                            else if (col.startsWith('S')) value = sub.semester_grades?.[col];
                                                            else if (col === 'Final') value = sub.percentage;

                                                            const displayValue = value !== null && value !== undefined && value !== '-' ? Math.round(Number(value)) : '-';
                                                            const isSummary = ['S1', 'S2', 'Final'].includes(col);

                                                            return (
                                                                <TableCell
                                                                    key={col}
                                                                    className={`text-center text-sm ${isSummary ? 'font-black text-indigo-700 bg-indigo-50/30' : 'font-bold text-gray-500 bg-slate-50/30'}`}
                                                                >
                                                                    {displayValue}{col === 'Final' && displayValue !== '-' ? '%' : ''}
                                                                </TableCell>
                                                            );
                                                        })}
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>

                                    {/* Signature Area */}
                                    <div className="px-8 pb-12 grid grid-cols-3 gap-12 mt-12 border-t border-gray-100 pt-8 text-left">
                                        {['class_teacher', 'academic_dean', 'principal'].map((key) => (
                                            <div key={key} className="border-t border-gray-200 pt-4 text-center">
                                                <div className="h-12 flex items-center justify-center mb-2 italic text-gray-300 text-[10px] uppercase font-bold tracking-widest">
                                                    {reportCard.signatures?.[key] ? (
                                                        <img src={reportCard.signatures[key]} alt="Signature" className="mx-auto h-12 object-contain" />
                                                    ) : (
                                                        "Pending Signature"
                                                    )}
                                                </div>
                                                <p className="text-[10px] font-black uppercase text-gray-950 mb-0.5">
                                                    {reportCard.signatory_names?.[key] || key.replace('_', ' ')}
                                                </p>
                                                <p className="text-[8px] font-medium text-gray-400 uppercase tracking-widest">
                                                    Official Signature
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="flex h-64 items-center justify-center border-2 border-dashed border-slate-200 rounded-2xl">
                                <div className="text-center">
                                    <p className="text-slate-500 font-bold">Report Card Unavailable</p>
                                    <p className="text-slate-400 text-sm">Please check back later</p>
                                </div>
                            </div>
                        )
                    )}
                </div>
            </div>
        </div>
    );
}

function CheckCircle2(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10Z" />
            <path d="m9 12 2 2 4-4" />
        </svg>
    );
}
