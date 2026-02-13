'use client';

import { useAuth } from '@/hooks/use-auth';
import { useTenant } from '@/hooks/use-tenant';
import { useState, useEffect } from 'react';
import { useTeacherService } from '@/services/api/teacher-service';
import {
    BookOpen, Users, Clock, Calendar,
    MapPin, ChevronRight, Search, Filter,
    GraduationCap, X, Loader2
} from 'lucide-react';
import Link from 'next/link';

export default function TeacherClasses() {
    const { user } = useAuth();
    const { tenant } = useTenant();

    // Mock data for classes
    const { getTeacherAssignments, getAssignmentStudents } = useTeacherService();
    const [classes, setClasses] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // Modal state for viewing class details
    const [showDetailsModal, setShowDetailsModal] = useState(false);
    const [selectedClass, setSelectedClass] = useState<any>(null);
    const [classStudents, setClassStudents] = useState<any[]>([]);
    const [studentsLoading, setStudentsLoading] = useState(false);

    useEffect(() => {
        const fetchClasses = async () => {
            if (!user?.id) return;
            try {
                const data = await getTeacherAssignments(user.id);
                // Map API response to UI model
                const mapped = data.map((item: any) => ({
                    id: item.class_id, // Use class_id (Section ID) or Assignment ID? Assignment ID is better for unique key if one teacher has multiple subjects in same class
                    assignmentId: item.id,
                    name: item.subject_name || item.class_name,
                    grade: `${item.grade_name} - ${item.section_name}`,
                    grade_id: item.grade_id,
                    section_id: item.section_id,
                    subject_id: item.subject_id,
                    academic_year_id: item.academic_year_id,
                    room: item.room || 'Main Building',
                    students: 'View',
                    schedule: 'See Timetable'
                }));
                setClasses(mapped);
            } catch (err) {
                console.error('Failed to fetch classes', err);
            } finally {
                setLoading(false);
            }
        };

        fetchClasses();
    }, [user?.id, getTeacherAssignments]);

    // Fetch students when modal opens
    const handleViewDetails = async (cls: any) => {
        setSelectedClass(cls);
        setShowDetailsModal(true);
        setStudentsLoading(true);
        setClassStudents([]);

        try {
            const students = await getAssignmentStudents(cls.assignmentId);
            setClassStudents(students.map((s: any) => ({
                id: s.student_id || s.id,
                name: s.full_name || `${s.first_name || ''} ${s.last_name || ''}`.trim() || 'Unknown',
                admissionNo: s.admission_number || '-',
                email: s.email || '-'
            })));
        } catch (err) {
            console.error('Failed to fetch students', err);
        } finally {
            setStudentsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#f8fafc] p-6 lg:p-10">
            <div className="mx-auto max-w-7xl space-y-8">

                {/* Header */}
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-3">
                            <BookOpen className="h-8 w-8 text-indigo-600" />
                            My Classes
                        </h1>
                        <p className="text-slate-500 mt-1">View and manage your assigned subject loads and sections.</p>
                    </div>
                </div>

                {/* Filters & Search */}
                <div className="flex flex-col md:flex-row gap-4 items-center bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                        <input
                            placeholder="Search classes..."
                            className="w-full pl-10 pr-4 py-2 bg-slate-50 border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                        />
                    </div>
                </div>

                {/* Classes Grid */}
                {loading ? (
                    <div className="text-center py-20 text-slate-500">Loading classes...</div>
                ) : classes.length === 0 ? (
                    <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-300">
                        <p className="text-slate-500">No classes assigned to you yet.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {classes.map((cls: any) => (
                            <div key={cls.assignmentId} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden hover:shadow-md transition-all group">
                                <div className="p-6">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="p-2 bg-indigo-50 rounded-lg group-hover:bg-indigo-600 transition-colors">
                                            <GraduationCap className="h-6 w-6 text-indigo-600 group-hover:text-white" />
                                        </div>
                                        <span className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-bold uppercase tracking-wider">
                                            {cls.grade}
                                        </span>
                                    </div>
                                    <h3 className="text-lg font-bold text-slate-900 mb-1">{cls.name}</h3>
                                    <div className="space-y-3 mt-4">
                                        <div className="flex items-center gap-3 text-sm text-slate-500">
                                            <MapPin className="h-4 w-4 text-slate-400" />
                                            <span>Room: {cls.room}</span>
                                        </div>
                                        <div className="flex items-center gap-3 text-sm text-slate-500">
                                            <Users className="h-4 w-4 text-slate-400" />
                                            <span>{cls.students} Students</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="p-4 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between">
                                    <button
                                        onClick={() => handleViewDetails(cls)}
                                        className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                                    >
                                        View Details
                                        <ChevronRight className="h-3 w-3" />
                                    </button>
                                    <div className="flex gap-2">
                                        <Link
                                            href={`./attendance?classId=${cls.assignmentId}`}
                                            className="text-[10px] font-bold px-2 py-1 bg-white border border-slate-200 rounded text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-100 transition-colors"
                                        >
                                            Attendance
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

            </div>

            {/* Student Roster Modal */}
            {showDetailsModal && selectedClass && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden">
                        {/* Modal Header */}
                        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                            <div>
                                <h2 className="text-xl font-bold text-slate-900">{selectedClass.name}</h2>
                                <p className="text-sm text-slate-500 mt-1">{selectedClass.grade} • Student Roster</p>
                            </div>
                            <button
                                onClick={() => setShowDetailsModal(false)}
                                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                            >
                                <X className="h-5 w-5 text-slate-500" />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 overflow-y-auto max-h-[60vh]">
                            {studentsLoading ? (
                                <div className="flex flex-col items-center gap-3 py-12">
                                    <Loader2 className="h-8 w-8 text-indigo-600 animate-spin" />
                                    <span className="text-slate-500">Loading students...</span>
                                </div>
                            ) : classStudents.length === 0 ? (
                                <div className="flex flex-col items-center gap-3 py-12">
                                    <Users className="h-12 w-12 text-slate-300" />
                                    <span className="text-slate-500">No students enrolled in this class</span>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <div className="text-sm font-bold text-slate-500 mb-4">
                                        {classStudents.length} Students Enrolled
                                    </div>
                                    {classStudents.map((student, idx) => (
                                        <div
                                            key={student.id}
                                            className="flex items-center gap-4 p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
                                        >
                                            <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-sm">
                                                {student.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                                            </div>
                                            <div className="flex-1">
                                                <div className="font-semibold text-slate-800">{student.name}</div>
                                                <div className="text-xs text-slate-500">{student.admissionNo}</div>
                                            </div>
                                            <div className="text-xs text-slate-400 font-mono">#{idx + 1}</div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="p-4 border-t border-slate-100 flex justify-end gap-3">
                            <button
                                onClick={() => setShowDetailsModal(false)}
                                className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                            >
                                Close
                            </button>
                            <Link
                                href={`./attendance?classId=${selectedClass.assignmentId}`}
                                className="px-4 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors"
                            >
                                Mark Attendance
                            </Link>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
