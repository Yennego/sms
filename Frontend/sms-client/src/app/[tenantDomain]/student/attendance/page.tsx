'use client';

// The student's own school-day attendance this school year.

import { DailyAttendanceHistory } from '@/components/attendance/DailyAttendanceHistory';
import { PageShell } from '@/components/ui/page-shell';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/use-auth';

export default function MyAttendancePage() {
  const { user } = useAuth();
  return (
    <PageShell title="My attendance" description="Every school day this year.">
      {user?.id ? <DailyAttendanceHistory studentId={user.id} /> : <Skeleton className="h-64 w-full rounded-xl" />}
    </PageShell>
  );
}
