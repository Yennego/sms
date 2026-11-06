'use client';

// One student's attendance for staff (opened from a class report or the student's profile).

import { useParams, useRouter } from 'next/navigation';

import { DailyAttendanceHistory } from '@/components/attendance/DailyAttendanceHistory';
import { PageShell } from '@/components/ui/page-shell';

export default function StudentAttendanceRecordPage() {
  const router = useRouter();
  const { studentId } = useParams<{ studentId: string }>();

  return (
    <PageShell
      title="Attendance record"
      eyebrow={
        <button type="button" onClick={() => router.back()} className="inline-flex min-h-11 items-center hover:underline md:min-h-0">
          ← Back
        </button>
      }
    >
      {studentId ? <DailyAttendanceHistory studentId={studentId} showStudentName /> : null}
    </PageShell>
  );
}
