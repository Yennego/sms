'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { errorMessageOf } from '@/utils/error-utils';
import { useTenant } from '@/hooks/use-tenant';
import { useAuth } from '@/hooks/use-auth';
import { useClassService } from '@/services/api/class-service';
import { useDailyAttendanceService } from '@/services/api/daily-attendance-service';
import { Class } from '@/types/class';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, CalendarCheck, Loader2, Users } from 'lucide-react';
import { DailyRosterPanel } from '@/components/attendance/DailyRosterPanel';

// Browser-local date; replaced by the school's own "today" from the server once loaded
const localToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export default function DailyAttendancePage() {
  const router = useRouter();
  const { tenant, isLoading: tenantLoading } = useTenant();
  const { user, isLoading: authLoading } = useAuth();
  const classService = useClassService();
  const { getDayInfo, closeDay } = useDailyAttendanceService();
  const [classes, setClasses] = useState<Class[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [isLoadingClasses, setIsLoadingClasses] = useState(false);
  const [date, setDate] = useState<string>(localToday());
  const [closing, setClosing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const roleNames: string[] = Array.isArray(user?.roles)
    ? user.roles.map((r: unknown) => (typeof r === 'string' ? r : (r as { name?: string })?.name ?? ''))
    : user?.role ? [user.role] : [];
  const isAdmin = roleNames.some(r => ['admin', 'superadmin', 'super-admin'].includes(r));
  const hasPermission = isAdmin || roleNames.includes('teacher');

  useEffect(() => {
    if (!authLoading && !user) {
      router.push(tenant?.domain ? `/${tenant.domain}/login` : '/login');
    }
  }, [user, authLoading, router, tenant]);

  const loadClasses = useCallback(async () => {
    if (!tenant?.id || !user || authLoading) return;
    setIsLoadingClasses(true);
    try {
      setClasses(await classService.getClasses({ is_active: true }));
    } catch (error) {
      console.error('Error loading classes:', error);
      toast.error('Failed to load classes');
    } finally {
      setIsLoadingClasses(false);
    }
  }, [tenant?.id, user, authLoading, classService]);

  useEffect(() => { loadClasses(); }, [loadClasses]);

  useEffect(() => {
    getDayInfo().then(info => setDate(info.today)).catch(() => { /* keep browser date */ });
  }, [getDayInfo]);

  const onCloseDay = async () => {
    if (!window.confirm(`Mark every student without attendance on ${date} as absent, across all classes?`)) return;
    setClosing(true);
    try {
      const result = await closeDay(date);
      toast.success(`Closed ${result.date}: ${result.marked_absent} student(s) marked absent`);
      setRefreshKey(k => k + 1);
    } catch (err) {
      toast.error(errorMessageOf(err, 'Failed to close the day'));
    } finally {
      setClosing(false);
    }
  };

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
          <p className="text-gray-700">You don&apos;t have permission to mark attendance.</p>
          <Button onClick={() => router.push(`/${tenant?.domain}/attendance`)} className="mt-4">
            Back to Attendance
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => router.push(`/${tenant?.domain}/attendance`)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Daily Attendance</h1>
            <p className="text-gray-600 mt-1">
              School-day attendance for {new Date(`${date}T00:00:00`).toLocaleDateString('en-US', {
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
              })}
            </p>
          </div>
        </div>
        {isAdmin && (
          <Button variant="outline" onClick={onCloseDay} disabled={closing}>
            {closing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CalendarCheck className="h-4 w-4 mr-2" />}
            Close day
          </Button>
        )}
      </div>

      {/* Class Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Select Class
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={selectedClassId} onValueChange={setSelectedClassId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Choose a class to mark attendance" />
            </SelectTrigger>
            <SelectContent>
              {isLoadingClasses ? (
                <SelectItem value="loading" disabled>Loading classes...</SelectItem>
              ) : classes.length === 0 ? (
                <SelectItem value="no-classes" disabled>No classes available</SelectItem>
              ) : (
                classes.map((cls) => (
                  <SelectItem key={cls.id} value={cls.id}>
                    {cls.name || `${cls.grade_name} ${cls.section_name}`}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {selectedClassId ? (
        <DailyRosterPanel key={refreshKey} classId={selectedClassId} date={date} onDateChange={setDate} />
      ) : (
        <Card>
          <CardContent className="flex items-center justify-center h-32">
            <div className="text-center text-gray-500">
              <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>Please select a class to mark attendance</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
