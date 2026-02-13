'use client';

import { useState, useEffect, useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { useClassService } from '@/services/api/class-service';
import { useStudentGradeService } from '@/services/api/student-grade-service';
import { useSubjectService } from '@/services/api/subject-service';
import { useAcademicGradeService as useGradeLevelService } from '@/services/api/academic-grade-service';
import { useEnrollmentService } from '@/services/api/enrollment-service';
import { usePromotionService, PromotionCriteria } from '@/services/api/promotion-service';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle
} from '@/components/ui/card';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    BookOpen,
    Users,
    Download,
    Filter,
    Search,
    RefreshCw,
    FileText,
    TrendingUp,
    AlertCircle,
    Loader2,
    CheckCircle2,
    XCircle
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

export default function GradebookPage() {
    const classService = useClassService();
    const gradeService = useStudentGradeService();
    const subjectService = useSubjectService();
    const gradeLevelService = useGradeLevelService();
    const enrollmentService = useEnrollmentService();
    const promotionService = usePromotionService();
    const pathname = usePathname();

    const [loading, setLoading] = useState(false);
    const [classes, setClasses] = useState<any[]>([]);
    const [subjects, setSubjects] = useState<any[]>([]);
    const [grades, setGrades] = useState<any[]>([]);
    const [academicYears, setAcademicYears] = useState<any[]>([]);
    const [criteria, setCriteria] = useState<PromotionCriteria | null>(null);

    // Selection state
    const [selectedAcademicYear, setSelectedAcademicYear] = useState<string>('');
    const [selectedClassId, setSelectedClassId] = useState<string>('all');
    const [selectedSubjectId, setSelectedSubjectId] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState('');

    // Data state
    const [students, setStudents] = useState<any[]>([]);
    const [studentGrades, setStudentGrades] = useState<any[]>([]);

    const loadInitialData = async () => {
        try {
            const [ayList, clsList, subList] = await Promise.all([
                enrollmentService.getAcademicYears(),
                classService.getClasses(),
                subjectService.getActiveSubjects()
            ]);

            setAcademicYears(ayList || []);
            setClasses(clsList || []);
            setSubjects(subList || []);

            const current = (ayList || []).find((ay: any) => ay.is_current);
            if (current) setSelectedAcademicYear(current.id);
        } catch (err) {
            toast.error('Failed to load initial configuration');
        }
    };

    useEffect(() => {
        loadInitialData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const loadGradebookData = async () => {
        if (!selectedAcademicYear) return;

        setLoading(true);
        try {
            // 1. Fetch Students
            let roster: any[] = [];
            if (selectedClassId !== 'all') {
                roster = await classService.getClassEnrollments(selectedClassId, { is_active: true });
            } else {
                // Option to fetch all students for the year? 
                // For simplicity, let's require a class or show empty.
                roster = [];
            }

            const mappedStudents = roster.map((en: any) => ({
                id: en.student_id,
                enrollment_id: en.id,
                name: en.student_name || en.student_obj?.full_name || en.student_id.split('-')[0],
                rollNumber: en.student_admission_number || en.student_obj?.roll_number || '-'
            }));
            setStudents(mappedStudents);

            // 2. Fetch Grades
            const gradeFilters: any = {};
            if (selectedSubjectId !== 'all') gradeFilters.subject_id = selectedSubjectId;

            // Note: We might need a more broad fetch for the matrix.
            // For now, fetch all for these students.
            if (mappedStudents.length > 0) {
                // Optimized: Filter by student IDs on the backend
                gradeFilters.student_ids = mappedStudents.map(s => s.id);
                gradeFilters.limit = 1000;
                const filteredGrades = await gradeService.getGrades(gradeFilters);
                setStudentGrades(filteredGrades);
            } else {
                setStudentGrades([]);
            }

        } catch (err) {
            toast.error('Failed to load gradebook');
        } finally {
            setLoading(false);
        }
    };

    const loadCriteria = async () => {
        if (!selectedAcademicYear) return;
        try {
            // Get grade from selected class if possible
            let gradeId: string | undefined = undefined;
            if (selectedClassId !== 'all') {
                const cls = classes.find(c => c.id === selectedClassId);
                if (cls) gradeId = cls.grade_id;
            }

            const res = await promotionService.getCriteria(selectedAcademicYear, gradeId);
            setCriteria(res);
        } catch (err) {
            console.error("Failed to load promotion criteria:", err);
        }
    };

    useEffect(() => {
        if (selectedAcademicYear) {
            loadGradebookData();
            loadCriteria();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedAcademicYear, selectedClassId, selectedSubjectId]);

    // Matrix processing
    const assessments = useMemo(() => {
        const set = new Set<string>();
        const list: any[] = [];
        studentGrades.forEach(g => {
            if (g.assessment_type === 'attendance') return;
            const key = `${g.assessment_type}-${g.assessment_id || g.assessment_name}`;
            if (!set.has(key)) {
                set.add(key);
                list.push({
                    id: g.assessment_id,
                    type: g.assessment_type,
                    name: g.assessment_name,
                    date: g.assessment_date,
                    maxScore: g.max_score
                });
            }
        });
        return list.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }, [studentGrades]);

    const attendanceGrades = useMemo(() => {
        return studentGrades.filter(g => g.assessment_type === 'attendance');
    }, [studentGrades]);

    const filteredStudents = useMemo(() => {
        if (!searchQuery) return students;
        return students.filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase()));
    }, [students, searchQuery]);

    const getScore = (studentId: string, assessmentId: string, assessmentName: string) => {
        return studentGrades.find(g =>
            g.student_id === studentId &&
            g.assessment_type !== 'attendance' &&
            (g.assessment_id === assessmentId || g.assessment_name === assessmentName)
        );
    };

    const getAttendanceScore = (studentId: string) => {
        return attendanceGrades.find(g => g.student_id === studentId);
    };

    const calculateStudentAvg = (studentId: string) => {
        const sGrades = studentGrades.filter(g => g.student_id === studentId && g.assessment_type !== 'attendance');
        if (sGrades.length === 0) return 0;

        if (criteria?.aggregate_method === 'weighted' && criteria.weighting_schema) {
            const weights = criteria.weighting_schema;
            let totalWeightedScore = 0;
            let totalUsedWeight = 0;

            // Group grades by type
            const gradesByType: Record<string, number[]> = {};
            sGrades.forEach(g => {
                const type = g.assessment_type?.toLowerCase();
                if (!gradesByType[type]) gradesByType[type] = [];
                gradesByType[type].push(g.percentage);
            });

            Object.entries(gradesByType).forEach(([type, scores]) => {
                const typeWeight = weights[type] || 0;
                if (typeWeight > 0) {
                    const typeAvg = scores.reduce((a, b) => a + b, 0) / scores.length;
                    totalWeightedScore += (typeAvg * typeWeight);
                    totalUsedWeight += typeWeight;
                }
            });

            if (totalUsedWeight === 0) {
                // Fallback to simple average if no weighted types found
                const total = sGrades.reduce((sum, g) => sum + g.percentage, 0);
                return total / sGrades.length;
            }

            return totalWeightedScore / (totalUsedWeight / 100);
        }

        const total = sGrades.reduce((sum, g) => sum + g.percentage, 0);
        return total / sGrades.length;
    };

    return (
        <div className="p-6 space-y-6 bg-gray-50/30 min-h-screen">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-extrabold text-indigo-950 flex items-center gap-2">
                        <TrendingUp className="w-8 h-8 text-indigo-600" />
                        Academic Gradebook
                    </h1>
                    <p className="text-muted-foreground">Comprehensive performance matrix and subject tracking.</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" className="gap-2">
                        <Download className="w-4 h-4" /> Export CSV
                    </Button>
                    <Button className="bg-indigo-600 hover:bg-indigo-700 gap-2">
                        <FileText className="w-4 h-4" /> Finalize Reports
                    </Button>
                </div>
            </div>

            {/* Filters */}
            <Card className="border-none shadow-sm">
                <CardContent className="pt-6">
                    <div className="flex flex-wrap items-center gap-4">
                        <div className="flex-1 min-w-[200px]">
                            <Label className="text-[10px] uppercase font-bold text-gray-400 mb-1.5 block">Academic Year</Label>
                            <Select value={selectedAcademicYear} onValueChange={setSelectedAcademicYear}>
                                <SelectTrigger><SelectValue placeholder="Select Year" /></SelectTrigger>
                                <SelectContent>
                                    {academicYears.map(ay => <SelectItem key={ay.id} value={ay.id}>{ay.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex-1 min-w-[200px]">
                            <Label className="text-[10px] uppercase font-bold text-gray-400 mb-1.5 block">Class / Roster</Label>
                            <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                                <SelectTrigger><SelectValue placeholder="All Classes" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Select a Class</SelectItem>
                                    {classes.map(c => (
                                        <SelectItem key={c.id} value={c.id}>
                                            {c.grade_name} - {c.section_name} | {c.subject_name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex-1 min-w-[200px]">
                            <Label className="text-[10px] uppercase font-bold text-gray-400 mb-1.5 block">Subject Filter</Label>
                            <Select value={selectedSubjectId} onValueChange={setSelectedSubjectId}>
                                <SelectTrigger><SelectValue placeholder="All Subjects" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Subjects</SelectItem>
                                    {subjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex-[2] min-w-[300px]">
                            <Label className="text-[10px] uppercase font-bold text-gray-400 mb-1.5 block">Search Student</Label>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <Input
                                    placeholder="Type student name..."
                                    className="pl-10"
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="flex items-end h-[60px]">
                            <Button variant="ghost" size="icon" onClick={loadGradebookData} disabled={loading}>
                                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Gradebook Matrix */}
            <Card className="border-none shadow-sm overflow-hidden">
                <CardHeader className="bg-white border-b border-gray-100 py-4 flex flex-row items-center justify-between">
                    <div>
                        <div className="flex items-center gap-2">
                            <CardTitle className="text-lg">Performance Matrix</CardTitle>
                            {criteria && (
                                <Badge variant="secondary" className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border-indigo-200 text-[10px] uppercase font-bold py-0.5">
                                    {criteria.aggregate_method === 'weighted' ? 'Weighted aggregation' : 'Simple average'}
                                </Badge>
                            )}
                        </div>
                        <CardDescription>Individual assessment breakdowns and cumulative averages.</CardDescription>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-red-500 rounded-full" /> <span className="text-xs text-gray-500 font-medium">Failing (&lt;50%)</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-green-500 rounded-full" /> <span className="text-xs text-gray-500 font-medium">Passing</span>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader className="bg-gray-50/50">
                                <TableRow>
                                    <TableHead className="pl-6 w-[250px] sticky left-0 bg-gray-50/50 z-10 border-r">Student Name</TableHead>
                                    {assessments.map(a => (
                                        <TableHead key={a.id || a.name} className="min-w-[120px] text-center">
                                            <div className="flex flex-col items-center">
                                                <span className="text-xs font-bold text-indigo-900">{a.name}</span>
                                                <Badge variant="outline" className="text-[9px] py-0 h-4 bg-white">
                                                    {a.type} • {a.maxScore}%
                                                </Badge>
                                            </div>
                                        </TableHead>
                                    ))}
                                    <TableHead className="w-[100px] text-center bg-green-50/30 font-bold text-green-900">
                                        Attendance
                                    </TableHead>
                                    <TableHead className="w-[120px] text-center bg-indigo-50/30 font-bold text-indigo-900">
                                        Subject Avg
                                    </TableHead>
                                    <TableHead className="w-[100px] text-center">GPA</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow>
                                        <TableCell colSpan={assessments.length + 3} className="h-40 text-center">
                                            <Loader2 className="w-8 h-8 animate-spin text-indigo-300 mx-auto" />
                                            <p className="text-sm text-gray-400 mt-2">Compiling matrix data...</p>
                                        </TableCell>
                                    </TableRow>
                                ) : filteredStudents.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={assessments.length + 3} className="h-40 text-center">
                                            <div className="flex flex-col items-center gap-2">
                                                <Users className="w-8 h-8 text-gray-200" />
                                                <p className="text-sm text-gray-400">Select a class to view the gradebook roster.</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : filteredStudents.map(student => {
                                    const avg = calculateStudentAvg(student.id);
                                    return (
                                        <TableRow key={student.id} className="hover:bg-gray-50/50 transition-colors group">
                                            <TableCell className="pl-6 font-medium sticky left-0 bg-white group-hover:bg-gray-50/50 z-10 border-r">
                                                <div className="flex flex-col">
                                                    <span>{student.name}</span>
                                                    <span className="text-[10px] text-gray-400">Adm ID: {student.rollNumber}</span>
                                                </div>
                                            </TableCell>
                                            {assessments.map(a => {
                                                const grade = getScore(student.id, a.id, a.name);
                                                return (
                                                    <TableCell key={a.id || a.name} className="text-center">
                                                        {grade ? (
                                                            <div className="flex flex-col items-center gap-1">
                                                                <span className={`text-sm font-bold ${grade.percentage < 50 ? 'text-red-500' : 'text-gray-900'}`}>
                                                                    {grade.score}
                                                                </span>
                                                                <span className="text-[9px] text-gray-400 font-medium">
                                                                    {grade.letter_grade} ({Math.round(grade.percentage)}%)
                                                                </span>
                                                            </div>
                                                        ) : (
                                                            <span className="text-gray-300">-</span>
                                                        )}
                                                    </TableCell>
                                                );
                                            })}
                                            <TableCell className="text-center bg-green-50/10">
                                                {(() => {
                                                    const att = getAttendanceScore(student.id);
                                                    return att ? (
                                                        <span className="text-sm font-bold text-green-600">
                                                            {Math.round(att.percentage)}%
                                                        </span>
                                                    ) : (
                                                        <span className="text-gray-300">-</span>
                                                    );
                                                })()}
                                            </TableCell>
                                            <TableCell className="text-center bg-indigo-50/10 font-black">
                                                <div className={`text-sm ${avg < 50 ? 'text-red-600' : 'text-indigo-600'}`}>
                                                    {avg.toFixed(1)}%
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <Badge className={`${avg >= 50 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'} border-none`}>
                                                    {(avg / 25).toFixed(2)}
                                                </Badge>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            {/* Legend & Stats */}
            {students.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Card className="border-none shadow-sm bg-white">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-bold flex items-center gap-2">
                                <CheckCircle2 className="w-4 h-4 text-green-500" /> Subject Performance
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-xs text-gray-500 mb-4">Class average performance across available assessments.</p>
                            <div className="space-y-3">
                                {assessments.slice(0, 3).map(a => {
                                    const total = studentGrades.filter(g => (g.assessment_id === a.id || g.assessment_name === a.name)).reduce((sum, g) => sum + g.percentage, 0);
                                    const count = studentGrades.filter(g => (g.assessment_id === a.id || g.assessment_name === a.name)).length;
                                    const classAvg = count > 0 ? total / count : 0;
                                    return (
                                        <div key={a.id || a.name} className="space-y-1">
                                            <div className="flex justify-between text-xs font-medium">
                                                <span>{a.name}</span>
                                                <span>{Math.round(classAvg)}%</span>
                                            </div>
                                            <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                                <div className="h-full bg-indigo-500" style={{ width: `${classAvg}%` }} />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-none shadow-sm bg-white">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-bold flex items-center gap-2">
                                <AlertCircle className="w-4 h-4 text-amber-500" /> Intervention Needed
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex flex-col items-center justify-center py-4">
                                <p className="text-3xl font-black text-amber-600">
                                    {students.filter(s => calculateStudentAvg(s.id) < 50).length}
                                </p>
                                <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Students Under 50%</p>
                            </div>
                            <Button
                                variant="outline"
                                className="w-full text-xs h-8 border-dashed border-amber-200 text-amber-600 hover:bg-amber-50"
                                onClick={() => {
                                    const tenantDomain = pathname.split('/')[1];
                                    window.location.href = `/${tenantDomain}/academics/remedial`;
                                }}
                            >
                                View Remedial List
                            </Button>
                        </CardContent>
                    </Card>

                    <Card className="border-none shadow-sm bg-indigo-900 text-white">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-bold flex items-center gap-2">
                                <FileText className="w-4 h-4 text-indigo-300" /> Export Options
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            <Button variant="secondary" className="w-full justify-start gap-2 bg-white/10 border-none hover:bg-white/20 text-white">
                                <Download className="w-4 h-4" /> Download Excel (.xlsx)
                            </Button>
                            <Button variant="secondary" className="w-full justify-start gap-2 bg-white/10 border-none hover:bg-white/20 text-white">
                                <FileText className="w-4 h-4" /> Generate Report PDFs
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}
