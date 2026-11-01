'use client';

import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { DailyAttendanceHistory } from '@/components/attendance/DailyAttendanceHistory';

export default function StudentAttendancePage() {
  const router = useRouter();
  const { studentId } = useParams<{ studentId: string }>();

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Button variant="outline" size="sm" onClick={() => router.back()}>
        <ArrowLeft className="h-4 w-4 mr-2" /> Back
      </Button>
      {studentId && <DailyAttendanceHistory studentId={studentId} showStudentName />}
    </div>
  );
}
