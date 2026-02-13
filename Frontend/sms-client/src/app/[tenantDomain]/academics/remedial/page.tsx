'use client';

import React, { useState, useEffect } from 'react';
import { usePromotionService } from '@/services/api/promotion-service';
import { useEnrollmentService } from '@/services/api/enrollment-service';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
import { Input } from '@/components/ui/input';
import {
    Loader2,
    BookOpen,
    Calendar,
    Search,
    RefreshCw,
    AlertCircle,
    ShieldAlert,
    UserCheck,
    Clock
} from 'lucide-react';
import { toast } from 'sonner';

export default function RemedialsPage() {
    const [sessions, setSessions] = useState<any[]>([]);
    const [atRisk, setAtRisk] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [academicYearId, setAcademicYearId] = useState<string>('');

    const { getAllRemedialSessions, identifyAtRisk, createRemedialSessions } = usePromotionService();
    const { getCurrentAcademicYear } = useEnrollmentService();

    const loadInitialData = async () => {
        setLoading(true);
        try {
            const ay = await getCurrentAcademicYear();
            if (ay) {
                setAcademicYearId(ay.id);
                const [sessData, riskData] = await Promise.all([
                    getAllRemedialSessions(0, 50),
                    identifyAtRisk(ay.id)
                ]);
                setSessions(sessData || []);
                setAtRisk(riskData || []);
            }
        } catch (err) {
            console.error('Failed to load remedial data', err);
            toast.error('Failed to load current remedial data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadInitialData();
    }, []);

    const handleSchedule = async (enrollmentId: string, subjectId: string) => {
        try {
            await createRemedialSessions(enrollmentId, [subjectId]);
            toast.success('Remedial session scheduled successfully');
            await loadInitialData(); // Refresh both lists
        } catch (err) {
            toast.error('Failed to schedule remedial session');
        }
    };

    const filteredSessions = sessions.filter(s =>
        (s.student_name?.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (s.subject_name?.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return (
        <div className="container mx-auto py-8 px-4 space-y-8">
            <div className="flex flex-col gap-6">
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-bold text-indigo-900 flex items-center gap-3">
                            <BookOpen className="w-8 h-8 text-indigo-600" />
                            Remedial Management
                        </h1>
                        <p className="text-muted-foreground pt-1">Identify at-risk students and manage remedial interventions.</p>
                    </div>
                    <Button onClick={loadInitialData} variant="outline" className="border-indigo-100 text-indigo-600 hover:bg-indigo-50">
                        <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                        Sync & Refresh
                    </Button>
                </div>

                {/* At-Risk / Intervention Needed Section */}
                <Card className="border-amber-100 bg-amber-50/20 shadow-sm overflow-hidden">
                    <CardHeader className="bg-amber-50/50 border-b border-amber-100 flex flex-row items-center justify-between">
                        <div>
                            <CardTitle className="text-lg text-amber-900 flex items-center gap-2">
                                <ShieldAlert className="w-5 h-5 text-amber-600" />
                                Intervention Needed
                            </CardTitle>
                            <CardDescription className="text-amber-700/70">Students whose weighted grades fall below the passing threshold.</CardDescription>
                        </div>
                        <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-200">
                            {atRisk.length} Potential Cases
                        </Badge>
                    </CardHeader>
                    <CardContent className="p-0">
                        {loading ? (
                            <div className="h-32 flex items-center justify-center"><Loader2 className="animate-spin text-amber-400" /></div>
                        ) : atRisk.length === 0 ? (
                            <div className="py-8 text-center text-sm text-gray-400 font-medium">No new at-risk cases identified.</div>
                        ) : (
                            <Table>
                                <TableHeader className="bg-amber-50/30">
                                    <TableRow>
                                        <TableHead className="text-amber-900 font-bold">Student</TableHead>
                                        <TableHead className="text-amber-900 font-bold">Subject</TableHead>
                                        <TableHead className="text-amber-900 font-bold">Current Grade</TableHead>
                                        <TableHead className="text-amber-900 font-bold text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {atRisk.map((risk, idx) => (
                                        <TableRow key={idx} className="bg-white/50 hover:bg-amber-50/40">
                                            <TableCell className="font-medium text-gray-900">{risk.student_name}</TableCell>
                                            <TableCell className="text-indigo-700 font-medium">{risk.subject_name}</TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className="bg-red-50 text-red-600 border-red-100">
                                                    {risk.current_grade.toFixed(1)}% / {risk.passing_mark}%
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button
                                                    size="sm"
                                                    className="bg-amber-600 hover:bg-amber-700 text-white gap-2"
                                                    onClick={() => handleSchedule(risk.enrollment_id, risk.subject_id)}
                                                >
                                                    <Clock className="w-3 h-3" /> Schedule
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                    </CardContent>
                </Card>

                {/* Filter / Search for active sessions */}
                <div className="flex items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-indigo-50">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <Input
                            placeholder="Filter sessions by student or subject..."
                            className="pl-10 border-indigo-50 focus:border-indigo-200"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                {/* Active Sessions List */}
                <Card className="border-indigo-50 shadow-sm overflow-hidden">
                    <CardHeader className="bg-indigo-50/30 border-b border-indigo-100">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <UserCheck className="w-5 h-5 text-indigo-600" />
                            Active & Logged Sessions
                        </CardTitle>
                        <CardDescription>Comprehensive list of student remediations across the institution.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-gray-50/50">
                                    <TableHead>Student</TableHead>
                                    <TableHead>Subject</TableHead>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Score</TableHead>
                                    <TableHead>Result</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-40 text-center">
                                            <Loader2 className="w-10 h-10 animate-spin text-indigo-600 mx-auto" />
                                        </TableCell>
                                    </TableRow>
                                ) : filteredSessions.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center py-20 text-muted-foreground">
                                            <div className="flex flex-col items-center gap-3">
                                                <AlertCircle className="w-10 h-10 text-gray-200" />
                                                <p>No remedial sessions found.</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredSessions.map((s) => (
                                        <TableRow key={s.id} className="hover:bg-indigo-50/20 transition-colors">
                                            <TableCell className="font-medium">
                                                <div className="flex flex-col">
                                                    <span className="text-indigo-900">{s.student_name || "Unknown"}</span>
                                                    <span className="text-xs text-gray-400">{s.student_id?.substring(0, 8)}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>{s.subject_name || "Unknown"}</TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2 text-gray-600">
                                                    <Calendar className="w-3.5 h-3.5" />
                                                    {new Date(s.scheduled_date).toLocaleDateString()}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge
                                                    variant={s.status === 'completed' ? 'default' : 'secondary'}
                                                    className={s.status === 'completed' ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-amber-100 text-amber-700 hover:bg-amber-200'}
                                                >
                                                    {s.status.toUpperCase()}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="font-mono">
                                                {s.new_score != null ? `${s.new_score}%` : '-'}
                                            </TableCell>
                                            <TableCell>
                                                {s.passed != null ? (
                                                    <Badge className={s.passed ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}>
                                                        {s.passed ? 'PASSED' : 'FAILED'}
                                                    </Badge>
                                                ) : (
                                                    <span className="text-gray-300">-</span>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
