'use client';
"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useAcademicYearService } from "@/services/api/academic-year-service";
import { useAcademicGradeService } from "@/services/api/academic-grade-service";
import { useSubjectService } from "@/services/api/subject-service";
import { useStudentGradeService } from "@/services/api/student-grade-service";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
    AlertCircle,
    CheckCircle2,
    FileUp,
    Info,
    Loader2,
    ShieldCheck
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function PublishGradesPage() {
    const { user, isLoading: authLoading } = useAuth();
    const router = useRouter();

    // Services
    const ayService = useAcademicYearService();
    const levelService = useAcademicGradeService();
    const subjectService = useSubjectService();
    const gradeService = useStudentGradeService();

    // State
    const [academicYears, setAcademicYears] = useState<any[]>([]);
    const [levels, setLevels] = useState<any[]>([]);
    const [subjects, setSubjects] = useState<any[]>([]);

    const [selectedAY, setSelectedAY] = useState<string>("");
    const [selectedLevel, setSelectedLevel] = useState<string>("");
    const [selectedSubject, setSelectedSubject] = useState<string>("");
    const [selectedPeriod, setSelectedPeriod] = useState<string>("1");

    const [isPublishing, setIsPublishing] = useState(false);
    const [loadingData, setLoadingData] = useState(true);

    // Check Admin role
    const isAdmin = user?.roles?.some(r => r.name.toLowerCase() === 'admin' || r.name.toLowerCase() === 'superadmin');

    useEffect(() => {
        if (!authLoading && !isAdmin) {
            toast.error("Access Denied: Admin role required.");
            router.back();
        }
    }, [isAdmin, authLoading, router]);

    useEffect(() => {
        async function loadInitialData() {
            try {
                const [ayRes, levelRes, subjectRes] = await Promise.all([
                    ayService.getAcademicYears(),
                    levelService.getActiveGrades(),
                    subjectService.getAllSubjects()
                ]);
                setAcademicYears(ayRes || []);
                setLevels(levelRes || []);
                setSubjects(subjectRes || []);
            } catch (err) {
                console.error("Failed to load publishing data", err);
                toast.error("Failed to load configuration data");
            } finally {
                setLoadingData(false);
            }
        }
        if (isAdmin) loadInitialData();
    }, [isAdmin]);

    const handlePublish = async () => {
        if (!selectedAY || !selectedLevel || !selectedSubject || !selectedPeriod) {
            toast.warning("Please fill all selection fields");
            return;
        }

        if (!confirm(`Are you sure you want to publish all grades for this period? once published, they will be visible on report cards and student dashboards.`)) {
            return;
        }

        setIsPublishing(true);
        try {
            const res = await gradeService.publishGrades({
                academic_year_id: selectedAY,
                grade_id: selectedLevel,
                subject_id: selectedSubject,
                period_number: parseInt(selectedPeriod)
            });
            toast.success(`Successfully published ${res.published_count} grade records!`);
        } catch (err) {
            toast.error("Failed to publish grades. Please check your connection.");
        } finally {
            setIsPublishing(false);
        }
    };

    if (authLoading || loadingData) {
        return (
            <div className="h-screen flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            </div>
        );
    }

    if (!isAdmin) return null;

    return (
        <div className="p-6 max-w-4xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-black text-indigo-950 flex items-center gap-3">
                        <ShieldCheck className="w-8 h-8 text-indigo-600" />
                        Grade Publishing Hub
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Officially release student results to dashboards and report cards.
                    </p>
                </div>
            </div>

            <Alert className="bg-amber-50 border-amber-200">
                <Info className="h-4 w-4 text-amber-700" />
                <AlertDescription className="text-amber-700">
                    <span className="font-bold block mb-1">Important Notice</span>
                    Publishing grades is a final action. Once published, grades become visible to students and parents.
                    Teachers can still edit them, but changes will be immediately live.
                </AlertDescription>
            </Alert>

            <Card className="border-indigo-100 shadow-sm">
                <CardHeader>
                    <CardTitle className="text-lg">Publish Selection</CardTitle>
                    <CardDescription>Select the specific class and period to publish.</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <Label className="font-bold">Academic Year</Label>
                        <Select onValueChange={setSelectedAY} value={selectedAY}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select Year" />
                            </SelectTrigger>
                            <SelectContent>
                                {academicYears.map(ay => (
                                    <SelectItem key={ay.id} value={ay.id}>{ay.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label className="font-bold">Grade Level</Label>
                        <Select onValueChange={setSelectedLevel} value={selectedLevel}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select Grade" />
                            </SelectTrigger>
                            <SelectContent>
                                {levels.map(l => (
                                    <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label className="font-bold">Subject</Label>
                        <Select onValueChange={setSelectedSubject} value={selectedSubject}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select Subject" />
                            </SelectTrigger>
                            <SelectContent>
                                {subjects.map(s => (
                                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label className="font-bold">Period Number</Label>
                        <Select onValueChange={setSelectedPeriod} value={selectedPeriod}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select Period" />
                            </SelectTrigger>
                            <SelectContent>
                                {[1, 2, 3, 4, 5, 6].map(p => (
                                    <SelectItem key={p} value={String(p)}>Period {p}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
                <div className="p-6 border-t bg-gray-50/50 flex justify-end">
                    <Button
                        onClick={handlePublish}
                        disabled={isPublishing || !selectedAY || !selectedLevel || !selectedSubject}
                        className="bg-indigo-600 hover:bg-indigo-700 h-11 px-8 gap-2 font-bold"
                    >
                        {isPublishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileUp className="w-4 h-4" />}
                        Publish Grades Now
                    </Button>
                </div>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-emerald-50 border-emerald-100">
                    <CardContent className="pt-6 flex items-center gap-4">
                        <CheckCircle2 className="w-10 h-10 text-emerald-600" />
                        <div>
                            <h3 className="text-lg font-black text-emerald-950">Draft Mode</h3>
                            <p className="text-xs text-emerald-700">Accumulate grades throughout the term without parents seeing them.</p>
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-indigo-50 border-indigo-100">
                    <CardContent className="pt-6 flex items-center gap-4">
                        <ShieldCheck className="w-10 h-10 text-indigo-600" />
                        <div>
                            <h3 className="text-lg font-black text-indigo-950">Review First</h3>
                            <p className="text-xs text-indigo-700">Check class averages and completeness before you publish.</p>
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-amber-50 border-amber-100">
                    <CardContent className="pt-6 flex items-center gap-4">
                        <AlertCircle className="w-10 h-10 text-amber-600" />
                        <div>
                            <h3 className="text-lg font-black text-amber-950">One Button</h3>
                            <p className="text-xs text-amber-700">Bulk publish as many as 500+ grades in a single request.</p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
