'use client';

import React, { useMemo } from 'react';
import { Timetable } from '@/services/api/timetable-service';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Printer, Download, School } from 'lucide-react';
import { useTenant } from '@/hooks/use-tenant';

interface Props {
    timetable: Timetable;
    isOpen: boolean;
    onClose: () => void;
}

const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function TimetableScheduleView({ timetable, isOpen, onClose }: Props) {
    const { tenant } = useTenant();

    // Group time slots by day and sort by start time
    const scheduleByDay = useMemo(() => {
        if (!timetable) return {};
        const grouped: Record<string, typeof timetable.time_slots> = {};

        timetable.time_slots.forEach(slot => {
            const day = slot.day_of_week.toLowerCase();
            if (!grouped[day]) {
                grouped[day] = [];
            }
            grouped[day].push(slot);
        });

        // Sort each day's slots by start time
        Object.keys(grouped).forEach(day => {
            grouped[day].sort((a, b) => {
                return a.start_time.localeCompare(b.start_time);
            });
        });

        return grouped;
    }, [timetable?.time_slots]);

    // Get all unique time periods across all days (for grid alignment)
    const allTimePeriods = useMemo(() => {
        if (!timetable) return [];
        const periods = new Set<string>();
        timetable.time_slots.forEach(slot => {
            periods.add(`${slot.start_time}-${slot.end_time}`);
        });
        return Array.from(periods).sort();
    }, [timetable?.time_slots]);

    // Early return if timetable is null
    if (!timetable) {
        return null;
    }

    // Color palette for subjects
    const subjectColors = [
        'bg-blue-100 border-blue-300',
        'bg-green-100 border-green-300',
        'bg-purple-100 border-purple-300',
        'bg-orange-100 border-orange-300',
        'bg-pink-100 border-pink-300',
        'bg-yellow-100 border-yellow-300',
        'bg-indigo-100 border-indigo-300',
    ];

    const getSubjectColor = (subjectId: string | undefined) => {
        if (!subjectId) return 'bg-gray-100 border-gray-300';
        const hash = subjectId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        return subjectColors[hash % subjectColors.length];
    };

    const handlePrint = () => {
        window.print();
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-[95vw] max-h-[90vh] overflow-y-auto">
                <style jsx global>{`
                    @media print {
                        .no-print { display: none !important; }
                        body * { visibility: hidden; }
                        .print-container, .print-container * { visibility: visible; }
                        .print-container {
                            position: absolute;
                            left: 0;
                            top: 0;
                            width: 100%;
                            padding: 20px;
                        }
                        .dialog-close-button { display: none !important; }
                        table { border-collapse: collapse !important; width: 100% !important; }
                        th, td { border: 1px solid #ddd !important; }
                        .subject-card { border: 1px solid #ccc !important; }
                    }
                `}</style>
                <div className="print-container">
                    <DialogHeader className="flex flex-row items-center justify-between no-print">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <div
                                    className="p-1 rounded-md bg-indigo-50"
                                    style={tenant?.primaryColor ? { backgroundColor: `${tenant.primaryColor}10` } : undefined}
                                >
                                    <School className="w-4 h-4 text-indigo-600" style={tenant?.primaryColor ? { color: tenant.primaryColor } : undefined} />
                                </div>
                                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                    {tenant?.name || 'School Management System'}
                                </span>
                            </div>
                            <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                                {timetable.name}
                            </DialogTitle>
                            <CardDescription>
                                <div className="flex gap-4 mt-2">
                                    <span>Academic Year: <strong className="text-gray-900">{timetable.academic_year}</strong></span>
                                    <span>Grade: <strong className="text-gray-900">{timetable.grade_name}</strong></span>
                                    {timetable.section_name && <span>Section: <strong className="text-gray-900">{timetable.section_name}</strong></span>}
                                </div>
                            </CardDescription>
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={handlePrint} className="flex items-center gap-2">
                                <Printer className="w-4 h-4" />
                                Print Schedule
                            </Button>
                            <Button variant="default" size="sm" onClick={handlePrint} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700">
                                <Download className="w-4 h-4" />
                                Download PDF
                            </Button>
                        </div>
                    </DialogHeader>

                    {/* Print Header (Only visible when printing) */}
                    <div className="hidden print:block mb-6 text-center border-b pb-4">
                        <h2 className="text-xl font-bold text-gray-700 mb-1 uppercase tracking-widest">
                            {tenant?.name || 'School Management System'}
                        </h2>
                        <h1 className="text-3xl font-extrabold text-black">{timetable.name}</h1>
                        <p className="text-lg text-gray-600 mt-2">
                            {timetable.grade_name} {timetable.section_name ? `- ${timetable.section_name}` : ''} | Academic Year: {timetable.academic_year}
                        </p>
                    </div>

                    <div className="mt-4 overflow-x-auto">
                        {/* Weekly Schedule Grid */}
                        <table className="w-full border-collapse min-w-[800px]">
                            <thead>
                                <tr className="bg-gray-50">
                                    <th className="border border-gray-300 p-2 text-sm font-semibold text-left w-24">Time</th>
                                    {daysOfWeek.map(day => (
                                        <th key={day} className="border border-gray-300 p-2 text-sm font-semibold text-center">
                                            {day}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {scheduleByDay && Object.keys(scheduleByDay).length > 0 ? (
                                    // Get all unique time slots
                                    Array.from(
                                        new Set(
                                            timetable.time_slots.map(slot => `${slot.start_time}-${slot.end_time}`)
                                        )
                                    )
                                        .sort()
                                        .map((timeRange) => {
                                            const [startTime, endTime] = timeRange.split('-');
                                            return (
                                                <tr key={timeRange}>
                                                    <td className="border border-gray-300 p-2 text-xs font-medium text-gray-600 align-top">
                                                        <div className="whitespace-nowrap">
                                                            {startTime}
                                                            <br />
                                                            {endTime}
                                                        </div>
                                                    </td>
                                                    {daysOfWeek.map(day => {
                                                        const dayKey = day.toLowerCase();
                                                        const slot = scheduleByDay[dayKey]?.find(
                                                            s => s.start_time === startTime && s.end_time === endTime
                                                        );

                                                        return (
                                                            <td
                                                                key={day}
                                                                className={`border border-gray-100 p-3 align-top min-h-[100px] transition-all hover:bg-gray-50/50 ${slot ? 'p-1' : 'bg-white'
                                                                    }`}
                                                            >
                                                                {slot && (
                                                                    <div className={`subject-card h-full rounded-lg border-l-4 p-3 shadow-sm ${getSubjectColor(slot.class_id)} animate-in fade-in zoom-in duration-300`}>
                                                                        <div className="font-bold text-sm text-gray-900 mb-1 leading-tight">
                                                                            {slot.subject_name || slot.name || 'Period'}
                                                                        </div>
                                                                        {slot.teacher_name && (
                                                                            <div className="text-[11px] font-medium text-gray-700 mb-2 flex items-center gap-1">
                                                                                <span className="opacity-70">Teacher:</span> {slot.teacher_name}
                                                                            </div>
                                                                        )}
                                                                        <div className="text-[10px] font-bold text-gray-500 bg-white/50 px-2 py-0.5 rounded-full w-fit">
                                                                            {slot.start_time} - {slot.end_time}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </td>
                                                        );
                                                    })}
                                                </tr>
                                            );
                                        })
                                ) : (
                                    <tr>
                                        <td colSpan={8} className="border border-gray-300 p-8 text-center text-gray-500">
                                            No time slots scheduled for this timetable.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Legend */}
                    {timetable.time_slots.length > 0 && (
                        <div className="mt-4 p-4 bg-gray-50 rounded-md">
                            <h4 className="text-sm font-semibold mb-2">Schedule Summary</h4>
                            <div className="text-sm text-gray-600 space-y-1">
                                <p>Total Periods: {timetable.time_slots.length}</p>
                                <p>Days: {Array.from(new Set(timetable.time_slots.map(s => s.day_of_week))).join(', ')}</p>
                            </div>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
