'use client';

import { useAuth } from '@/hooks/use-auth';
import { ClipboardList, ArrowLeft, Loader2, BookOpen } from 'lucide-react';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';

import { useSearchParams } from 'next/navigation';
import { useClassService } from '@/services/api/class-service';
import { useDailyAttendanceService } from '@/services/api/daily-attendance-service';
import { DailyRosterPanel } from '@/components/attendance/DailyRosterPanel';

// Browser-local date; replaced by the school's own "today" from the server once loaded
const localToday = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

interface SponsoredClass {
    id: string;
    name: string;
}

export default function TeacherAttendance() {
    const { user } = useAuth();
    const searchParams = useSearchParams();
    const classIdFromUrl = searchParams.get('classId'); // Class ID of a class this teacher sponsors
    const { getClasses } = useClassService();
    const { getDayInfo } = useDailyAttendanceService();

    const [classes, setClasses] = useState<SponsoredClass[]>([]);
    const [loadingClasses, setLoadingClasses] = useState(true);
    const [selectedClassId, setSelectedClassId] = useState<string>(classIdFromUrl || '');
    const [date, setDate] = useState<string>(localToday());

    // Only the class sponsor (or an admin) can mark attendance, so list sponsored classes
    useEffect(() => {
        const fetchClasses = async () => {
            if (!user?.id) return;
            setLoadingClasses(true);
            try {
                const data = await getClasses({ class_teacher_id: user.id, is_active: true });
                const mapped = data.map(item => ({
                    id: item.id,
                    name: item.name || `${item.grade_name} ${item.section_name}`,
                }));
                setClasses(mapped);
                // A sponsor usually has one class: select it straight away
                if (!classIdFromUrl && mapped.length === 1) setSelectedClassId(mapped[0].id);
            } catch (err) {
                console.error('Failed to fetch sponsored classes', err);
                toast.error('Failed to load your classes');
            } finally {
                setLoadingClasses(false);
            }
        };
        fetchClasses();
    }, [user?.id, classIdFromUrl, getClasses]);

    useEffect(() => {
        getDayInfo().then(info => setDate(info.today)).catch(() => { /* keep browser date */ });
    }, [getDayInfo]);

    const selectedClass = classes.find(c => c.id === selectedClassId);

    return (
        <div className="min-h-screen bg-[#f8fafc] p-6 lg:p-10">
            <div className="mx-auto max-w-7xl space-y-8">

                {/* Header */}
                <div>
                    <Link href="./dashboard" className="text-sm font-bold text-slate-400 hover:text-indigo-600 flex items-center gap-1 mb-2">
                        <ArrowLeft className="h-4 w-4" /> Back to Dashboard
                    </Link>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-3">
                        <ClipboardList className="h-8 w-8 text-indigo-600" />
                        Daily Attendance
                    </h1>
                    <p className="text-slate-500 mt-1">
                        {selectedClass ? selectedClass.name : 'Select a class'} • {new Date(`${date}T00:00:00`).toLocaleDateString()}
                    </p>
                </div>

                {/* Class selector */}
                <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                    <div className="flex items-center gap-4">
                        <BookOpen className="h-5 w-5 text-indigo-600" />
                        <label className="font-semibold text-slate-700">Class:</label>
                        {loadingClasses ? (
                            <div className="flex items-center gap-2 text-slate-400">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                <span className="text-sm">Loading your classes...</span>
                            </div>
                        ) : classes.length === 0 ? (
                            <span className="text-sm text-slate-500">You are not the sponsor of any class</span>
                        ) : (
                            <select
                                value={selectedClassId}
                                onChange={e => setSelectedClassId(e.target.value)}
                                className="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all cursor-pointer"
                            >
                                <option value="">-- Select a class --</option>
                                {classes.map(cls => (
                                    <option key={cls.id} value={cls.id}>{cls.name}</option>
                                ))}
                            </select>
                        )}
                    </div>
                </div>

                {selectedClassId && (
                    <DailyRosterPanel classId={selectedClassId} date={date} onDateChange={setDate} />
                )}
            </div>
        </div>
    );
}
