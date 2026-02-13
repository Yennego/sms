'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { usePromotionService } from '@/services/api/promotion-service';
import { useAcademicYear } from '@/contexts/academic-year-context';
import { useAcademicGradeService } from '@/services/api/academic-grade-service';
import { useSectionService } from '@/services/api/section-service';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@/components/ui/table';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Loader2, TrendingUp, UserCheck, UserX, AlertCircle, Save, ArrowRight, BookOpen, ChevronDown, ChevronUp } from 'lucide-react';
import RemedialPanel from '@/components/students/remedial-panel';

export default function PromotionDashboard() {
    const [loading, setLoading] = useState(false);
    const [academicYears, setAcademicYears] = useState<any[]>([]);
    const [selectedYear, setSelectedYear] = useState('');
    const [grades, setGrades] = useState<any[]>([]);
    const [selectedGrade, setSelectedGrade] = useState('');
    const [evaluationResults, setEvaluationResults] = useState<any[]>([]);
    const [sections, setSections] = useState<any[]>([]);
    const [selectedSection, setSelectedSection] = useState('all');
    const [scalingInput, setScalingInput] = useState<Record<string, number>>({});
    const [isTransitionModalOpen, setIsTransitionModalOpen] = useState(false);
    const [expandedRemedial, setExpandedRemedial] = useState<string | null>(null);

    const promotionService = usePromotionService();
    const gradeService = useAcademicGradeService();
    const sectionService = useSectionService();
    const { academicYears: ayList } = useAcademicYear();

    // Filter academic years to show only current and future/scheduled
    const filteredYears = useMemo(() => {
        const today = new Date();
        return ayList.filter(y => y.is_current || new Date(y.start_date) > today || (new Date(y.end_date) >= today));
    }, [ayList]);

    useEffect(() => {
        loadGrades();
    }, []);

    useEffect(() => {
        if (selectedGrade) {
            sectionService.getSectionsByGrade(selectedGrade).then(setSections);
        } else {
            setSections([]);
        }
        setSelectedSection('all');
    }, [selectedGrade]);

    const loadGrades = async () => {
        try {
            const data = await gradeService.getAllGrades();
            setGrades(data || []);
        } catch (err) {
            console.error('Failed to load grades', err);
        }
    };

    const runEvaluation = async () => {
        if (!selectedYear || !selectedGrade) {
            toast.error('Please select both academic year and grade');
            return;
        }
        setLoading(true);
        try {
            const results = await promotionService.evaluatePromotion(selectedYear, selectedGrade, selectedSection);
            setEvaluationResults(results || []);
            toast.success('Evaluation complete');
        } catch (err) {
            console.error('Evaluation failed', err);
            toast.error('Failed to evaluate students');
        } finally {
            setLoading(false);
        }
    };

    const handleScaling = async (enrollmentId: string) => {
        const points = scalingInput[enrollmentId];
        if (points === undefined || isNaN(points)) return;

        try {
            await promotionService.applyScaling(enrollmentId, points, 'Manual adjustment via dashboard');
            toast.success('Scaling applied');
            // Re-run evaluation for this year/grade to update list
            runEvaluation();
        } catch (err) {
            toast.error('Failed to apply scaling');
        }
    };

    const executeTransition = async () => {
        if (!selectedYear) return;

        setIsTransitionModalOpen(false);
        setLoading(true);
        const targetYear = ayList.find(y => y.id !== selectedYear)?.name || 'Next Academic Year';

        try {
            const res = await promotionService.startTransition(selectedYear, targetYear);
            toast.success('Year transition executed successfully!');
            console.log('Transition results:', res);
        } catch (err) {
            console.error('Transition failed', err);
            toast.error('Transition failed. Check console for details.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="container mx-auto py-8 px-4">
            <div className="flex flex-col gap-6">
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-bold">Promotion & Lifecycle Dashboard</h1>
                        <p className="text-muted-foreground pt-1">Automated student performance evaluation and year-end transition.</p>
                    </div>
                    <Button
                        onClick={() => setIsTransitionModalOpen(true)}
                        disabled={loading || evaluationResults.length === 0}
                        className="bg-indigo-600 hover:bg-indigo-700"
                    >
                        <ArrowRight className="w-4 h-4 mr-2" />
                        Execute Transition
                    </Button>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Evaluation Filters</CardTitle>
                        <CardDescription>Select a year and grade to evaluate promotion eligibility.</CardDescription>
                    </CardHeader>
                    <CardContent className="flex gap-4 items-end">
                        <div className="flex-1 space-y-2">
                            <label className="text-sm font-medium">Academic Year</label>
                            <Select value={selectedYear} onValueChange={setSelectedYear}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select Year" />
                                </SelectTrigger>
                                <SelectContent>
                                    {filteredYears.map(y => (
                                        <SelectItem key={y.id} value={y.id}>{y.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex-1 space-y-2">
                            <label className="text-sm font-medium">Grade</label>
                            <Select value={selectedGrade} onValueChange={setSelectedGrade}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select Grade" />
                                </SelectTrigger>
                                <SelectContent>
                                    {grades.map(g => (
                                        <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex-1 space-y-2">
                            <label className="text-sm font-medium">Section (Optional)</label>
                            <Select value={selectedSection} onValueChange={setSelectedSection}>
                                <SelectTrigger>
                                    <SelectValue placeholder="All Sections" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Sections</SelectItem>
                                    {sections.map(s => (
                                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <Button onClick={runEvaluation} disabled={loading} variant="secondary">
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <TrendingUp className="w-4 h-4 mr-2" />}
                            Evaluate Eligibility
                        </Button>
                    </CardContent>
                </Card>

                {evaluationResults.length > 0 && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Evaluation Results</CardTitle>
                            <CardDescription>
                                Summary of students who are passing, failing, or eligible for scaling.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Student</TableHead>
                                        <TableHead>Section</TableHead>
                                        <TableHead>Total Score</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Failed Subjects</TableHead>
                                        <TableHead className="w-[150px]">Manual Scaling</TableHead>
                                        <TableHead className="text-right">Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {evaluationResults
                                        .filter(res => selectedSection === 'all' || res.section_id === selectedSection)
                                        .map((res) => (
                                            <React.Fragment key={res.enrollment_id}>
                                                <TableRow>
                                                    <TableCell className="font-medium">
                                                        <div className="flex flex-col">
                                                            <span>{res.student_name || 'Unknown Student'}</span>
                                                            <span className="text-xs text-muted-foreground">{res.student_id.substring(0, 8)}</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        {sections.find(s => s.id === res.section_id)?.name || 'Unknown'}
                                                    </TableCell>
                                                    <TableCell>{res.total_score}%</TableCell>
                                                    <TableCell>
                                                        <Badge
                                                            variant={res.status === 'Eligible' ? 'default' : res.status === 'Repeating' ? 'destructive' : 'secondary'}
                                                        >
                                                            {res.status === 'Eligible' ? <UserCheck className="w-3 h-3 mr-1" /> : <UserX className="w-3 h-3 mr-1" />}
                                                            {res.status}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell>{res.failed_subject_ids?.length || 0}</TableCell>
                                                    <TableCell>
                                                        <Input
                                                            type="number"
                                                            placeholder="+/- points"
                                                            className="h-8 text-sm"
                                                            value={scalingInput[res.enrollment_id] || ''}
                                                            onChange={(e) => setScalingInput(prev => ({ ...prev, [res.enrollment_id]: parseFloat(e.target.value) }))}
                                                        />
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <div className="flex justify-end gap-2">
                                                            {(res.status === 'Repeating' || res.status === 'Conditional') && (
                                                                <Button
                                                                    size="sm"
                                                                    variant="ghost"
                                                                    className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50"
                                                                    onClick={() => setExpandedRemedial(expandedRemedial === res.enrollment_id ? null : res.enrollment_id)}
                                                                >
                                                                    <BookOpen className="w-4 h-4 mr-1" />
                                                                    {expandedRemedial === res.enrollment_id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                                                </Button>
                                                            )}
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                onClick={() => handleScaling(res.enrollment_id)}
                                                                disabled={scalingInput[res.enrollment_id] === undefined}
                                                            >
                                                                <Save className="w-4 h-4" />
                                                            </Button>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                                {expandedRemedial === res.enrollment_id && (
                                                    <TableRow className="bg-slate-50/50">
                                                        <TableCell colSpan={7} className="p-4">
                                                            <div className="max-w-3xl mx-auto">
                                                                <RemedialPanel enrollmentId={res.enrollment_id} />
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                )}
                                            </React.Fragment>
                                        ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                )}
            </div>

            <Dialog open={isTransitionModalOpen} onOpenChange={setIsTransitionModalOpen} align="top" showBackdrop={true}>
                <DialogContent className="max-w-xl bg-white/90 backdrop-blur-md border border-indigo-100 shadow-2xl mt-10">
                    <DialogHeader>
                        <div className="flex items-center gap-2 mb-2">
                            <div className="p-2 bg-indigo-50 rounded-full text-indigo-600">
                                <AlertCircle className="w-5 h-5" />
                            </div>
                            <DialogTitle className="text-xl">Execute Academic Transition</DialogTitle>
                        </div>
                        <DialogDescription className="text-base text-gray-600">
                            Confirming this will process all student promotions and remedial assignments for the current evaluation results.
                            <span className="block mt-2 font-medium text-indigo-700">This action will modify student levels for the next academic year.</span>
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex justify-end gap-3 mt-6">
                        <Button variant="ghost" onClick={() => setIsTransitionModalOpen(false)} className="hover:bg-gray-100">
                            Review More
                        </Button>
                        <Button className="bg-indigo-600 hover:bg-indigo-700 px-6 shadow-lg shadow-indigo-200" onClick={executeTransition}>
                            Confirm & Execute
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
