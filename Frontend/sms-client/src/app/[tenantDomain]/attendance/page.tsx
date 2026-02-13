'use client';

import { useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTenant } from '@/hooks/use-tenant';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar, Users, BarChart3, Clock, UserCheck, AlertCircle } from 'lucide-react';
import { AttendanceSummaryCard } from '@/components/attendance/AttendanceSummaryCard';
import { useAttendanceSummary } from '@/hooks/queries/attendance';

export default function AttendancePage() {
  const router = useRouter();
  const { tenant, isLoading: tenantLoading } = useTenant();
  const { user, isLoading: authLoading } = useAuth();

  const today = useMemo(() => new Date().toISOString().split('T')[0], []);

  const { data: summary, isLoading: queryLoading, isError } = useAttendanceSummary({
    start_date: today,
    end_date: today
  });

  const loading = queryLoading;
  const error = isError ? 'Failed to load attendance summary' : null;

  // Get user role
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

  if (tenantLoading || authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Loading Attendance...</h2>
          <p className="text-gray-500">Please wait while we prepare your attendance dashboard.</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const isTeacher = userRole === 'teacher';
  const isAdmin = userRole === 'admin';
  const isStudent = userRole === 'student';

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Attendance Management</h1>
          <p className="text-gray-600 mt-1">
            {tenant?.name} - {new Date().toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}
          </p>
        </div>

        {(isTeacher || isAdmin) && (
          <Button
            onClick={() => router.push(`/${tenant?.domain}/attendance/daily`)}
            className="flex items-center gap-2"
            disabled={loading}
          >
            <UserCheck className="h-4 w-4" />
            Mark Attendance
          </Button>
        )}
      </div>

      {/* Today's Summary */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <AttendanceSummaryCard
            title="Today's Attendance"
            summary={summary}
            showProgress={true}
          />
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Daily Attendance */}
        {(isTeacher || isAdmin) && (
          <Card className="cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => router.push(`/${tenant?.domain}/attendance/daily`)}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-blue-600" />
                Daily Attendance
              </CardTitle>
              <CardDescription>
                Mark attendance for today&apos;s classes
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">
                Quick and efficient attendance marking for all your classes.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Calendar View */}
        <Card className="cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => router.push(`/${tenant?.domain}/attendance/calendar`)}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-green-600" />
              Calendar View
            </CardTitle>
            <CardDescription>
              Monthly attendance overview
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600">
              View attendance patterns and trends in a calendar format.
            </p>
          </CardContent>
        </Card>

        {/* Reports */}
        {(isAdmin || isTeacher) && (
          <Card className="cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => router.push(`/${tenant?.domain}/attendance/reports`)}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-purple-600" />
                Reports & Analytics
              </CardTitle>
              <CardDescription>
                Detailed attendance reports
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">
                Generate comprehensive attendance reports and analytics.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Student History (for students or when viewing specific student) */}
        {isStudent && (
          <Card className="cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => router.push(`/${tenant?.domain}/attendance/history`)}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-orange-600" />
                My Attendance
              </CardTitle>
              <CardDescription>
                View your attendance history
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">
                Track your attendance record and performance.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Students Overview (for teachers/admins) */}
        {(isAdmin || isTeacher) && (
          <Card className="cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => router.push(`/${tenant?.domain}/attendance/students`)}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-orange-600" />
                Student Records
              </CardTitle>
              <CardDescription>
                Individual student attendance
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">
                View detailed attendance records for individual students.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Alerts & Notifications */}
        {(isAdmin || isTeacher) && (
          <Card className="cursor-pointer hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-red-600" />
                Alerts
              </CardTitle>
              <CardDescription>
                Attendance alerts and notifications
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">
                Monitor students with poor attendance patterns.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-4 w-4" />
              <span>{error}</span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
