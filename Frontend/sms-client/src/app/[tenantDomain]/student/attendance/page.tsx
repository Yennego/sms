'use client';

import { useAuth } from '@/hooks/use-auth';
import { ClipboardList, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

import { DailyAttendanceHistory } from '@/components/attendance/DailyAttendanceHistory';

export default function StudentAttendance() {
    const { user } = useAuth();

    return (
        <div className="min-h-screen bg-[#f8fafc] p-6 lg:p-10">
            <div className="mx-auto max-w-7xl space-y-8">
                <div>
                    <Link href="./dashboard" className="text-sm font-bold text-slate-400 hover:text-indigo-600 flex items-center gap-1 mb-2">
                        <ArrowLeft className="h-4 w-4" /> Back to Dashboard
                    </Link>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-3">
                        <ClipboardList className="h-8 w-8 text-indigo-600" />
                        My Attendance
                    </h1>
                    <p className="text-slate-500 mt-1">Your school-day attendance this academic year.</p>
                </div>

                {user?.id && <DailyAttendanceHistory studentId={user.id} />}
            </div>
        </div>
    );
}
