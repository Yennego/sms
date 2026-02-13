'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTenant } from '@/hooks/use-tenant';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { StudentAttendanceHistory } from '@/components/attendance/StudentAttendanceHistory';

interface PageProps {
  params: {
    studentId: string;
    tenantDomain: string;
  };
}

export default function StudentAttendancePage({ params }: PageProps) {
  const router = useRouter();
  const { tenant, isLoading: tenantLoading } = useTenant();
  const { user, isLoading: authLoading } = useAuth();
  const { studentId } = params;

  const userRole = user?.role || 
    (Array.isArray(user?.roles) && user.roles.length > 0 ? 
      (typeof user.roles[0] === 'string' ? 
        user.roles[0] : 
        user.roles[0].name) : 
      'admin');

  useEffect(() => {
    if (!authLoading && !user) {
      if (tenant?.domain) {
        router.push(`/${tenant.domain}/login`);
      } else {
        router.push('/login');
      }
    }
  }, [user, authLoading, router, tenant]);

  const hasPermission = userRole === 'admin' || userRole === 'teacher';

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

  if (!user || !hasPermission) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2 text-red-600">Access Denied</h2>
          <p className="text-gray-700">You &#39;don&#39;t have permission to view student records.</p>
          <Button 
            onClick={() => router.push(`/${tenant?.domain}/attendance`)} 
            className="mt-4"
          >
            Back to Attendance
          </Button>
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
          onClick={() => router.push(`/${tenant?.domain}/attendance/students`)}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Students
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Student Attendance History</h1>
          <p className="text-gray-600 mt-1">
            Detailed attendance record for student
          </p>
        </div>
      </div>

      {/* Student Attendance History */}
      <StudentAttendanceHistory studentId={studentId} showStudentInfo={true} />
    </div>
  );
}
