'use client';

import { useAuth } from '@/hooks/use-auth';
import { useTenant } from '@/hooks/use-tenant';
import {
    ClipboardList, Search, Filter,
    Check, X, Save, ArrowLeft,
    Users, Calendar as CalendarIcon,
    Loader2, Clock, BookOpen
} from 'lucide-react';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';

import { useSearchParams } from 'next/navigation';
import { useTeacherService } from '@/services/api/teacher-service';
import { useAttendanceService } from '@/services/api/attendance-service';
import { AttendanceStatus } from '@/types/attendance';

export default function TeacherAttendance() {
    const { user } = useAuth();
    const { tenant } = useTenant();
    const searchParams = useSearchParams();
    const classIdFromUrl = searchParams.get('classId'); // This is the Assignment ID
    const { getAssignmentStudents, getTeacherAssignments } = useTeacherService();
    const { bulkMarkAttendanceViaProxy } = useAttendanceService();

    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(true);
    const [students, setStudents] = useState<any[]>([]);

    // Class selector state (when no classId in URL)
    const [teacherClasses, setTeacherClasses] = useState<any[]>([]);
    const [selectedClassId, setSelectedClassId] = useState<string>('');
    const [loadingClasses, setLoadingClasses] = useState(false);
    const [selectedClassInfo, setSelectedClassInfo] = useState<any>(null);

    // The effective classId (from URL or selected)
    const classId = classIdFromUrl || selectedClassId;

    // Status state
    const [studentStatus, setStudentStatus] = useState<Record<string, string>>({});

    // Always fetch teacher's classes to get assignment info including academic_year_id
    useEffect(() => {
        const fetchTeacherClasses = async () => {
            if (!user?.id) return;

            setLoadingClasses(true);
            try {
                const assignments = await getTeacherAssignments(user.id);
                const mapped = assignments.map((item: any) => ({
                    id: item.id,
                    name: `${item.grade_name} ${item.section_name} - ${item.subject_name}`,
                    grade_name: item.grade_name,
                    section_name: item.section_name,
                    section_id: item.section_id,
                    subject_name: item.subject_name,
                    academic_year_id: item.academic_year_id
                }));
                setTeacherClasses(mapped);

                // If coming from URL, auto-set the selected class info
                if (classIdFromUrl) {
                    const cls = mapped.find((c: any) => c.id === classIdFromUrl);
                    if (cls) {
                        setSelectedClassInfo(cls);
                    }
                }
            } catch (err) {
                console.error('Failed to fetch teacher classes', err);
                toast.error('Failed to load your classes');
            } finally {
                setLoadingClasses(false);
                setLoading(false);
            }
        };

        fetchTeacherClasses();
    }, [user?.id, classIdFromUrl, getTeacherAssignments]);

    // Fetch students when classId is available
    useEffect(() => {
        const fetchStudents = async () => {
            if (!classId) return;

            setLoading(true);
            try {
                const data = await getAssignmentStudents(classId);
                // Map API response. Backend get_students_for_class returns list of dicts.
                const mapped = data.map((s: any) => ({
                    id: s.student_id || s.id,
                    name: s.full_name || `${s.first_name || ''} ${s.last_name || ''}`.trim() || 'Unknown',
                    admissionNo: s.admission_number || '-',
                    status: 'present' // Default to present
                }));
                setStudents(mapped);

                // Initialize status
                const initialStatus: Record<string, string> = {};
                mapped.forEach((s: any) => initialStatus[s.id] = 'present');
                setStudentStatus(initialStatus);

                // Find class info for selected class
                if (!classIdFromUrl && selectedClassId) {
                    const cls = teacherClasses.find(c => c.id === selectedClassId);
                    setSelectedClassInfo(cls);
                }
            } catch (err) {
                console.error('Failed to fetch students', err);
                toast.error('Failed to load student list');
            } finally {
                setLoading(false);
            }
        };

        if (classId) {
            fetchStudents();
        } else {
            setLoading(false);
        }
    }, [classId, getAssignmentStudents, classIdFromUrl, selectedClassId, teacherClasses]);


    const onToggleStatus = (id: string, newStatus: string) => {
        setStudentStatus(prev => ({ ...prev, [id]: newStatus }));
    };

    const onSave = async () => {
        if (!selectedClassInfo && !classIdFromUrl) {
            toast.error('Please select a class first');
            return;
        }

        // Get the class info - either from selected or find from teacher classes
        const activeClass = selectedClassInfo || teacherClasses.find(c => c.id === classIdFromUrl);

        if (!activeClass?.academic_year_id) {
            toast.error('Missing academic year information');
            return;
        }

        setSaving(true);
        try {
            // Build attendance data payload
            const attendances = students.map(student => ({
                student_id: student.id,
                status: (studentStatus[student.id] || 'present').toUpperCase() as AttendanceStatus
            }));

            const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format

            await bulkMarkAttendanceViaProxy({
                class_id: activeClass.section_id || '', // section_id is the class
                academic_year_id: activeClass.academic_year_id,
                date: today,
                attendances: attendances
            });

            toast.success('Attendance saved successfully!');
        } catch (error: any) {
            console.error('Failed to save attendance:', error);
            toast.error(error?.message || 'Failed to save attendance');
        } finally {
            setSaving(false);
        }
    };

    // Get class subtitle
    const getClassSubtitle = () => {
        if (selectedClassInfo) {
            return `${selectedClassInfo.grade_name} ${selectedClassInfo.section_name} • ${selectedClassInfo.subject_name} • ${new Date().toLocaleDateString()}`;
        }
        return `Select a class • ${new Date().toLocaleDateString()}`;
    };

    return (
        <div className="min-h-screen bg-[#f8fafc] p-6 lg:p-10">
            <div className="mx-auto max-w-7xl space-y-8">

                {/* Header */}
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                        <Link href="./dashboard" className="text-sm font-bold text-slate-400 hover:text-indigo-600 flex items-center gap-1 mb-2">
                            <ArrowLeft className="h-4 w-4" /> Back to Dashboard
                        </Link>
                        <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-3">
                            <ClipboardList className="h-8 w-8 text-indigo-600" />
                            Attendance Marking
                        </h1>
                        <p className="text-slate-500 mt-1">{getClassSubtitle()}</p>
                    </div>
                    <button
                        onClick={onSave}
                        disabled={saving || students.length === 0}
                        className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 transition-all active:scale-[0.98]"
                    >
                        {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
                        {saving ? 'Saving...' : 'Save Attendance'}
                    </button>
                </div>

                {/* Class Selector - Only show when no classId in URL */}
                {!classIdFromUrl && (
                    <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                        <div className="flex items-center gap-4">
                            <BookOpen className="h-5 w-5 text-indigo-600" />
                            <label className="font-semibold text-slate-700">Select Class:</label>
                            {loadingClasses ? (
                                <div className="flex items-center gap-2 text-slate-400">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    <span className="text-sm">Loading your classes...</span>
                                </div>
                            ) : teacherClasses.length === 0 ? (
                                <span className="text-sm text-slate-500">No classes assigned to you</span>
                            ) : (
                                <select
                                    value={selectedClassId}
                                    onChange={e => setSelectedClassId(e.target.value)}
                                    className="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all cursor-pointer"
                                >
                                    <option value="">-- Select a class --</option>
                                    {teacherClasses.map((cls) => (
                                        <option key={cls.id} value={cls.id}>{cls.name}</option>
                                    ))}
                                </select>
                            )}
                        </div>
                    </div>
                )}

                {/* Dashboard Tools */}
                <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
                            <span className="text-sm font-bold text-slate-600">Present: {Object.values(studentStatus).filter(s => s === 'present').length}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full bg-rose-500"></span>
                            <span className="text-sm font-bold text-slate-600">Absent: {Object.values(studentStatus).filter(s => s === 'absent').length}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full bg-orange-500"></span>
                            <span className="text-sm font-bold text-slate-600">Late: {Object.values(studentStatus).filter(s => s === 'late').length}</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => {
                                const newStatus = { ...studentStatus };
                                students.forEach(s => newStatus[s.id] = 'present');
                                setStudentStatus(newStatus);
                            }}
                            disabled={students.length === 0}
                            className="px-3 py-1.5 text-xs font-bold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 disabled:opacity-50 rounded-lg transition-colors border border-emerald-100"
                        >
                            Mark All Present
                        </button>
                    </div>
                </div>

                {/* Student List Table */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="bg-slate-50/50">
                                <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Student Name</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Admission No.</th>
                                <th className="px-6 py-4 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Quick Mark</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-20 text-center">
                                        <div className="flex flex-col items-center gap-3">
                                            <Loader2 className="h-8 w-8 text-indigo-600 animate-spin" />
                                            <span className="text-slate-500">Loading students...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : students.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-20 text-center">
                                        <div className="flex flex-col items-center gap-3">
                                            <Users className="h-12 w-12 text-slate-300" />
                                            <span className="text-slate-500 font-medium">
                                                {!classId ? 'Please select a class to view students' : 'No students found in this class'}
                                            </span>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                students.map((student) => (
                                    <tr key={student.id} className="hover:bg-slate-50/50 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="h-8 w-8 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-xs">
                                                    {student.name.split(' ').map((n: string) => n[0]).join('')}
                                                </div>
                                                <span className="font-bold text-slate-800 text-sm">{student.name}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-sm text-slate-500 font-medium">{student.admissionNo}</span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex justify-center">
                                                <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider shadow-sm ${studentStatus[student.id] === 'present' ? 'bg-emerald-100 text-emerald-700 shadow-emerald-50' :
                                                    studentStatus[student.id] === 'absent' ? 'bg-rose-100 text-rose-700 shadow-rose-50' :
                                                        'bg-orange-100 text-orange-700 shadow-orange-50'
                                                    }`}>
                                                    {studentStatus[student.id]}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => onToggleStatus(student.id, 'present')}
                                                    className={`p-2 rounded-lg transition-all ${studentStatus[student.id] === 'present' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-200' : 'bg-slate-50 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600'}`}
                                                    title="Present"
                                                >
                                                    <Check className="h-4 w-4 font-bold" />
                                                </button>
                                                <button
                                                    onClick={() => onToggleStatus(student.id, 'absent')}
                                                    className={`p-2 rounded-lg transition-all ${studentStatus[student.id] === 'absent' ? 'bg-rose-600 text-white shadow-lg shadow-rose-200' : 'bg-slate-50 text-slate-400 hover:bg-rose-50 hover:text-rose-600'}`}
                                                    title="Absent"
                                                >
                                                    <X className="h-4 w-4 font-bold" />
                                                </button>
                                                <button
                                                    onClick={() => onToggleStatus(student.id, 'late')}
                                                    className={`p-2 rounded-lg transition-all ${studentStatus[student.id] === 'late' ? 'bg-orange-600 text-white shadow-lg shadow-orange-200' : 'bg-slate-50 text-slate-400 hover:bg-orange-50 hover:text-orange-600'}`}
                                                    title="Late"
                                                >
                                                    <Clock className="h-4 w-4 font-bold" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

            </div>
        </div>
    );
}
