import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { AttendanceQuickMark } from './AttendanceQuickMark';
import { AttendanceStatusBadge } from './AttendanceStatusBadge';
import { useAttendanceService } from '@/services/api/attendance-service';
import { AttendanceStatus } from '@/types/attendance';
import { Search, Save, Users, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { useEnrollmentService } from '@/services/api/enrollment-service';
import { isValidUUID } from '@/utils/uuid';

interface Student {
  id: string;
  name: string;
  roll_number?: string;
  current_status?: AttendanceStatus;
}

interface DailyAttendanceGridProps {
  classId: string;
  scheduleId?: string;
  academicYearId: string;
  date?: string;
  students: Student[];
  onAttendanceMarked?: () => void;
  className?: string;
  manualPeriod?: string;
}

export const DailyAttendanceGrid: React.FC<DailyAttendanceGridProps> = ({
  classId,
  scheduleId,
  academicYearId,
  date = format(new Date(), 'yyyy-MM-dd'),
  students,
  onAttendanceMarked,
  manualPeriod,
}) => {
  const [attendanceData, setAttendanceData] = useState<Map<string, AttendanceStatus>>(new Map());
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const attendanceService = useAttendanceService();
  const enrollmentService = useEnrollmentService();
  // Load existing attendance data
  useEffect(() => {
    let mounted = true;

    const loadExistingAttendance = async () => {
      setIsLoading(true);
      try {
        const existingAttendance = await attendanceService.getAttendanceByDate(date, classId, scheduleId);
        const attendanceMap = new Map<string, AttendanceStatus>();
        existingAttendance.forEach(record => {
          attendanceMap.set(record.student_id, record.status);
        });
        if (mounted) setAttendanceData(attendanceMap);
      } catch (error) {
        console.warn('No existing attendance records for this date/schedule; starting fresh.', { date, classId, scheduleId, error });
        if (mounted) setAttendanceData(new Map());
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    if (students.length > 0 && classId && date && (scheduleId || manualPeriod)) {
      loadExistingAttendance();
    } else {
      setAttendanceData(new Map());
    }

    return () => { mounted = false; };
  }, [date, classId, scheduleId, students.length, attendanceService]);

  // Filter students based on search term
  const filteredStudents = students.filter(student =>
    student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.roll_number?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Handle individual status change
  const handleStatusChange = (studentId: string, status: AttendanceStatus) => {
    setAttendanceData(prev => new Map(prev.set(studentId, status)));
  };

  // Bulk mark all as present
  const markAllPresent = () => {
    const newAttendanceData = new Map(attendanceData);
    students.forEach(student => {
      newAttendanceData.set(student.id, AttendanceStatus.PRESENT);
    });
    setAttendanceData(newAttendanceData);
  };

  // Resolve academic year input (name or UUID) into a UUID
  const resolveAcademicYearIdInput = async (rawAcademicYearId: string): Promise<string | null> => {
    const normalize = (s: string) => (s || '').trim().replace(/\s+/g, '').replace(/\//g, '-').toLowerCase();

    // If a UUID is passed, use it directly
    if (rawAcademicYearId && isValidUUID(rawAcademicYearId)) {
      return rawAcademicYearId;
    }

    // Try to map by name using list of academic years
    try {
      const years = await enrollmentService.getAcademicYears();
      const targetNorm = normalize(rawAcademicYearId);
      const byName = years.find(y => normalize(y.name) === targetNorm);
      if (byName?.id && isValidUUID(byName.id)) {
        return byName.id;
      }
    } catch (err) {
      console.warn('[Attendance] Failed to fetch academic years for ID resolution:', err);
    }

    // Fallback to current academic year if the input resembles a current year label
    try {
      const current = await enrollmentService.getCurrentAcademicYear();
      if (current?.id && isValidUUID(current.id)) {
        const targetNorm = normalize(rawAcademicYearId);
        if (!targetNorm || normalize(current.name) === targetNorm) {
          return current.id;
        }
      }
    } catch (err) {
      console.warn('[Attendance] Failed to fetch current academic year:', err);
    }

    return null;
  };

  // Save attendance
  async function saveAttendance() {
    setIsSaving(true);
    try {
      const resolvedAcademicYearId = await resolveAcademicYearIdInput(academicYearId);
      if (!resolvedAcademicYearId) {
        console.error('Invalid academicYearId; cannot save.', { academicYearId });
        setIsSaving(false);
        return;
      }

      const resolvedScheduleId = (isValidUUID(scheduleId))
        ? scheduleId
        : (!manualPeriod ? await getScheduleIdFor(classId, date) : null);

      if (!resolvedScheduleId && !manualPeriod) {
        console.error('No valid schedule or manual period found. Cannot save.', { classId, date });
        setIsSaving(false);
        return;
      }

      const validAttendances = Array.from(attendanceData.entries()).map(([student_id, status]) => ({
        student_id,
        status,
      }));
      if (validAttendances.length === 0) {
        console.warn('No statuses marked; nothing to save.');
        setIsSaving(false);
        return;
      }

      const bulkPayload = {
        class_id: classId,
        academic_year_id: resolvedAcademicYearId,
        date,
        schedule_id: resolvedScheduleId || undefined,
        period: manualPeriod,
        attendances: validAttendances,
      };

      await attendanceService.bulkMarkAttendanceViaProxy(bulkPayload);
      onAttendanceMarked?.();
    } catch (saveError) {
      const errObj = saveError as Record<string, unknown>;
      const originalError = errObj['originalError'] as Record<string, unknown> | undefined;
      const originalResp = originalError?.['response'] as Record<string, unknown> | undefined;
      const originalData = originalResp?.['data'];
      const response = errObj['response'] as Record<string, unknown> | undefined;
      const data = response?.['data'];
      const message = (saveError as Error)?.message;
      const serverDetail = originalData ?? data ?? message ?? saveError;
      console.warn('[Attendance] Bulk mark failed:', serverDetail);
      console.warn('Raw error object:', saveError);
    } finally {
      setIsSaving(false);
    }
  };

  // Calculate summary stats
  const stats = {
    total: students.length,
    marked: attendanceData.size,
    present: Array.from(attendanceData.values()).filter(status => status === AttendanceStatus.PRESENT).length,
    absent: Array.from(attendanceData.values()).filter(status => status === AttendanceStatus.ABSENT).length,
    late: Array.from(attendanceData.values()).filter(status => status === AttendanceStatus.LATE).length,
    excused: Array.from(attendanceData.values()).filter(status => status === AttendanceStatus.EXCUSED).length
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
            <p className="text-gray-500">Loading attendance data...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Daily Attendance - {format(new Date(date), 'MMMM dd, yyyy')}
            </CardTitle>
            <p className="text-sm text-gray-500 mt-1">
              Mark attendance for {students.length} students
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={markAllPresent}
              disabled={isSaving}
            >
              <Users className="w-4 h-4 mr-1" />
              Mark All Present
            </Button>
            <Button
              onClick={saveAttendance}
              disabled={isSaving || attendanceData.size === 0 || (!scheduleId && !manualPeriod)}
              className="bg-green-600 hover:bg-green-700"
            >
              <Save className="w-4 h-4 mr-1" />
              {isSaving ? 'Saving...' : 'Save Attendance'}
            </Button>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="flex gap-4 mt-4">
          <Badge variant="outline" className="px-3 py-1">
            Total: {stats.total}
          </Badge>
          <Badge variant="outline" className="px-3 py-1">
            Marked: {stats.marked}/{stats.total}
          </Badge>
          <Badge variant="default" className="bg-green-100 text-green-800 px-3 py-1">
            Present: {stats.present}
          </Badge>
          <Badge variant="destructive" className="px-3 py-1">
            Absent: {stats.absent}
          </Badge>
          <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 px-3 py-1">
            Late: {stats.late}
          </Badge>
          <Badge variant="outline" className="bg-blue-100 text-blue-800 px-3 py-1">
            Excused: {stats.excused}
          </Badge>
        </div>

        {/* Search */}
        <div className="relative mt-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="Search students by name or roll number..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </CardHeader>

      <CardContent>
        <div className="space-y-2">
          {filteredStudents.map((student) => {
            const currentStatus = attendanceData.get(student.id);

            return (
              <div
                key={student.id}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-sm font-medium text-blue-600">
                      {student.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium">{student.name}</p>
                    {student.roll_number && (
                      <p className="text-sm text-gray-500">Roll: {student.roll_number}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {currentStatus && (
                    <AttendanceStatusBadge status={currentStatus} size="sm" />
                  )}
                  <AttendanceQuickMark
                    currentStatus={currentStatus}
                    onStatusChange={(status) => handleStatusChange(student.id, status)}
                    disabled={isSaving}
                    size="sm"
                  />
                </div>
              </div>
            );
          })}

          {filteredStudents.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No students found matching your search.</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

// Helper: resolve schedule once per class/date
async function getScheduleIdFor(classId: string, isoDate: string) {
  const dayMap = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const d = new Date(isoDate);
  const day = dayMap[d.getUTCDay()];

  const qs = new URLSearchParams({ class_id: classId, day_of_week: day });
  const res = await fetch(`/api/v1/academics/schedules?${qs.toString()}`, { method: 'GET' });
  if (!res.ok) {
    console.warn('[Attendance] Failed to fetch schedules:', res.status);
    return null;
  }

  const schedules: Array<{ id?: string; period?: number }> = await res.json().catch(() => []);
  if (!Array.isArray(schedules) || schedules.length === 0) return null;

  return String(schedules[0]?.id ?? '');
}
