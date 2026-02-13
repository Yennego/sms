'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTenant } from '@/hooks/use-tenant';
import { useAuth } from '@/hooks/use-auth';
import { useClassService } from '@/services/api/class-service';
import { Class } from '@/types/class'; 
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Users } from 'lucide-react';
import { DailyAttendanceGrid } from '@/components/attendance/DailyAttendanceGrid';

interface Student {
  id: string;
  name: string;
  roll_number?: string;
}

export default function DailyAttendancePage() {
  const router = useRouter();
  const { tenant, isLoading: tenantLoading } = useTenant();
  const { user, isLoading: authLoading } = useAuth();
  const classService = useClassService();
  const [classes, setClasses] = useState<Class[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [isLoadingClasses, setIsLoadingClasses] = useState(false);
  const [isLoadingStudents, setIsLoadingStudents] = useState(false);

  const userRole = user?.role || 
    (Array.isArray(user?.roles) && user.roles.length > 0 ? 
      (typeof user?.roles[0] === 'string' ? 
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

  // Memoize the loadClasses function
  const loadClasses = useCallback(async () => {
    // Check if user is authenticated and tenant is available
    if (!tenant?.id || !user || authLoading) {
      console.log('Waiting for authentication or tenant data...');
      return;
    }
    
    setIsLoadingClasses(true);
    try {
      console.log('Loading classes for tenant:', tenant.id);
      
      // Remove tenant_id from filters - it's handled by authentication context
      const classesData = await classService.getClasses({
        is_active: true 
      });
      
      console.log('Classes data received:', classesData);
      setClasses(classesData);
    } catch (error) {
      console.error('Error loading classes:', error);
    } finally {
      setIsLoadingClasses(false);
    }
  }, [tenant?.id, user, authLoading]); // Removed classService from dependencies

  // Load classes when component mounts
  useEffect(() => {
    loadClasses();
  }, [loadClasses]);

  // Memoize the loadStudents function
  const loadStudents = useCallback(async () => {
    if (!selectedClassId || !tenant?.id) {
      setStudents([]);
      return;
    }

    setIsLoadingStudents(true);
    try {
      console.log('Loading students for class:', selectedClassId);
      
      const studentsData = await classService.getClassStudents(selectedClassId);
      
      console.log('Students data received:', studentsData);
      setStudents(studentsData);
    } catch (error) {
      console.error('Error loading students:', error);
      setStudents([]);
    } finally {
      setIsLoadingStudents(false);
    }
  }, [selectedClassId, tenant?.id]); // Removed classService from dependencies

  // Load students when class is selected
  useEffect(() => {
    loadStudents();
  }, [loadStudents]);

  // Check permissions
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
          <p className="text-gray-700">You don&apos;t have permission to mark attendance.</p>
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
          onClick={() => router.push(`/${tenant?.domain}/attendance`)}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Daily Attendance</h1>
          <p className="text-gray-600 mt-1">
            Mark attendance for {new Date().toLocaleDateString('en-US', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </p>
        </div>
      </div>

      {/* Class Selection */}
      <Card className="mb-6">
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
                <SelectItem value="loading" disabled>
                  Loading classes...
                </SelectItem>
              ) : classes.length === 0 ? (
                <SelectItem value="no-classes" disabled>
                  No classes available
                </SelectItem>
              ) : (
                classes.map((cls) => (
                  <SelectItem key={cls.id} value={cls.id}>
                    {cls.name} - Grade {cls.grade_name} {cls.section_name}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Daily Attendance Grid */}
      {selectedClassId && (
        <DailyAttendanceGrid
          classId={selectedClassId}
          scheduleId="default-schedule" 
          academicYearId="current-year" 
          students={students}
          onAttendanceMarked={() => {
            // Refresh or show success message
            console.log('Attendance marked successfully');
          }}
        />
      )}

      {/* Loading state for students */}
      {selectedClassId && isLoadingStudents && (
        <Card>
          <CardContent className="flex items-center justify-center h-32">
            <div className="text-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2"></div>
              <p className="text-gray-500">Loading students...</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* No class selected state */}
      {!selectedClassId && (
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