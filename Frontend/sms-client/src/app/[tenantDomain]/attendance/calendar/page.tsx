'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTenant } from '@/hooks/use-tenant';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { AttendanceCalendar } from '@/components/attendance/AttendanceCalendar';

export default function AttendanceCalendarPage() {
  const router = useRouter();
  const { tenant, isLoading: tenantLoading } = useTenant();
  const { user, isLoading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && !user) {
      if (tenant?.domain) {
        router.push(`/${tenant.domain}/login`);
      } else {
        router.push('/login');
      }
    }
  }, [user, authLoading, router, tenant]);

  if (tenantLoading || authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Loading...</h2>
          <p className="text-gray-500">Please wait...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Redirecting...</h2>
          <p className="text-gray-500">Please wait...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => router.push(`/${tenant?.domain}/attendance`)}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Attendance Calendar</h1>
          <p className="text-gray-600 mt-1">
            Monthly view of attendance data
          </p>
        </div>
      </div>

      {/* Attendance Calendar */}
      <AttendanceCalendar />
    </div>
  );
}