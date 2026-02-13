'use client';

import { useAuth } from '@/hooks/use-auth';
import { useTenant } from '@/hooks/use-tenant';
import {
    Calendar as CalendarIcon, Clock, MapPin,
    BookOpen, User, BookCheck, ArrowLeft
} from 'lucide-react';
import Link from 'next/link';

import { useTimetableService, type Timetable, type TimeSlot } from '@/services/api/timetable-service';
import { useEnrollmentService } from '@/services/api/enrollment-service';
import { useEffect, useState, useMemo } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

export default function StudentTimetable() {
    const { user } = useAuth();
    const { tenant } = useTenant();
    const timetableService = useTimetableService();
    const enrollmentService = useEnrollmentService();

    const [loading, setLoading] = useState(true);
    const [timetable, setTimetable] = useState<Timetable | null>(null);
    const [enrollment, setEnrollment] = useState<any>(null);
    const [selectedDay, setSelectedDay] = useState('Monday');

    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

    useEffect(() => {
        const loadTimetable = async () => {
            if (!user?.id) return;
            setLoading(true);
            try {
                const currentEnrollment = await enrollmentService.getCurrentEnrollment(user.id);
                setEnrollment(currentEnrollment);

                if (currentEnrollment) {
                    // Fetch all timetables for this grade (remove AY filter to catch mismatches)
                    const timetables = await timetableService.getTimetables({
                        grade_id: currentEnrollment.grade_id,
                    });

                    const ayId = currentEnrollment.academic_year_id;
                    const secId = currentEnrollment.section_id;

                    // Aggregate slots from ALL active matching timetables:
                    // 1. Same Academic Year
                    // 2. Either Grade-wide OR matching specific Section
                    const matches = timetables.filter(t =>
                        t.is_active &&
                        t.academic_year_id === ayId &&
                        (!t.section_id || t.section_id === secId)
                    );

                    // Fallback to active timetables if no exact AY match found (safety)
                    const activeTimetables = matches.length > 0 ? matches : timetables.filter(t => t.is_active);

                    if (activeTimetables.length > 0) {
                        // Merge all slots into a virtual timetable
                        const aggregatedSlots = activeTimetables.reduce((acc, curr) => {
                            return [...acc, ...(curr.time_slots || [])];
                        }, [] as TimeSlot[]);

                        setTimetable({
                            ...activeTimetables[0],
                            name: 'Weekly Schedule',
                            time_slots: aggregatedSlots
                        });
                    } else {
                        setTimetable(null);
                    }
                }
            } catch (err) {
                console.error('Failed to load timetable:', err);
            } finally {
                setLoading(false);
            }
        };
        loadTimetable();
    }, [user?.id]);

    const filteredSlots = useMemo(() => {
        if (!timetable) return [];
        return timetable.time_slots
            .filter(slot => (slot.day_of_week || '').toLowerCase() === selectedDay.toLowerCase())
            .sort((a, b) => a.start_time.localeCompare(b.start_time));
    }, [timetable, selectedDay]);

    return (
        <div className="min-h-screen bg-[#f8fafc] p-6 lg:p-10">
            <div className="mx-auto max-w-7xl space-y-8">

                {/* Header */}
                <div>
                    <Link href="./dashboard" className="text-sm font-bold text-slate-400 hover:text-indigo-600 flex items-center gap-1 mb-2">
                        <ArrowLeft className="h-4 w-4" /> Back to Dashboard
                    </Link>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-3">
                        <CalendarIcon className="h-8 w-8 text-indigo-600" />
                        Class Timetable
                    </h1>
                    <p className="text-slate-500 mt-1">
                        {enrollment
                            ? `Weekly schedule for ${enrollment.grade_name || enrollment.grade} - ${enrollment.section_name || enrollment.section}`
                            : 'Weekly schedule for your assigned class.'}
                    </p>
                </div>

                {/* Days Selection */}
                <div className="flex overflow-x-auto gap-2 pb-2 scrollbar-hide">
                    {days.map((day) => (
                        <button
                            key={day}
                            onClick={() => setSelectedDay(day)}
                            className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap shadow-sm border ${day === selectedDay
                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-indigo-100'
                                : 'bg-white text-slate-500 border-slate-100 hover:bg-slate-50'
                                }`}
                        >
                            {day}
                        </button>
                    ))}
                </div>

                {/* Schedule list */}
                <div className="space-y-4">
                    {loading ? (
                        [1, 2, 3].map(i => (
                            <div key={i} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-6">
                                <Skeleton className="h-16 w-32 rounded-2xl" />
                                <div className="space-y-2 flex-1">
                                    <Skeleton className="h-6 w-1/3" />
                                    <Skeleton className="h-4 w-1/4" />
                                </div>
                            </div>
                        ))
                    ) : filteredSlots.length > 0 ? (
                        filteredSlots.map((item, i) => (
                            <div key={i} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-all flex flex-col md:flex-row md:items-center justify-between gap-6 group">
                                <div className="flex items-center gap-6">
                                    <div className="bg-indigo-50 text-indigo-600 p-4 rounded-2xl flex flex-col items-center justify-center min-w-[120px] group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                                        <Clock className="h-5 w-5 mb-1" />
                                        <span className="text-xs font-bold">{item.start_time.substring(0, 5)} - {item.end_time.substring(0, 5)}</span>
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-slate-900">{item.name || item.subject_name || 'Subject'}</h3>
                                        <div className="flex flex-wrap items-center gap-4 mt-2">
                                            <div className="flex items-center gap-1.5 text-slate-500 text-sm">
                                                <MapPin className="h-4 w-4" />
                                                <span>Room: {timetable?.id?.substring(0, 4) || 'TBA'}</span>
                                            </div>
                                            <div className="flex items-center gap-1.5 text-slate-500 text-sm">
                                                <User className="h-4 w-4 text-indigo-400" />
                                                <span className="font-medium text-slate-700">{item.teacher_name || 'TBA'}</span>
                                                <span className="text-slate-300 mx-1">•</span>
                                                <span className="text-indigo-600 font-bold">{item.subject_name || 'Subject'}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <button className="px-5 py-2.5 bg-slate-50 text-slate-600 font-bold rounded-xl text-xs hover:bg-slate-100 transition-colors border border-slate-100 flex items-center gap-2">
                                    <BookCheck className="h-4 w-4" />
                                    Lesson Plan
                                </button>
                            </div>
                        ))
                    ) : (
                        <div className="bg-white rounded-3xl p-20 text-center border border-dashed border-slate-200">
                            <div className="p-4 bg-slate-50 rounded-full w-fit mx-auto mb-6">
                                <CalendarIcon className="h-10 w-10 text-slate-300" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900">No Classes Logged</h3>
                            <p className="text-slate-500 mt-2">There are no classes scheduled for {selectedDay}.</p>
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
}
