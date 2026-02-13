import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { AttendanceStatusBadge } from './AttendanceStatusBadge';
import { AttendanceSummaryCard } from './AttendanceSummaryCard';
import { useAttendanceService } from '@/services/api/attendance-service';
import { AttendanceStatus, Attendance, AttendanceSummary } from '@/types/attendance';
import { User, TrendingUp, Calendar, Download } from 'lucide-react';
import { format, subDays, subWeeks, subMonths } from 'date-fns';

interface StudentAttendanceHistoryProps {
  studentId: string;
  studentName?: string;
  classId?: string;
  academicYearId?: string;
}

type TimePeriod = '7d' | '30d' | '90d' | 'semester' | 'year';

interface AttendanceTrend {
  period: string;
  attendance_rate: number;
  total_days: number;
  present_days: number;
}

export const StudentAttendanceHistory: React.FC<StudentAttendanceHistoryProps> = ({
  studentId,
  studentName,
  classId,
  academicYearId
}) => {
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('30d');
  const [attendanceRecords, setAttendanceRecords] = useState<Attendance[]>([]);
  const [attendanceSummary, setAttendanceSummary] = useState<AttendanceSummary | null>(null);
  const [attendanceTrends, setAttendanceTrends] = useState<AttendanceTrend[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const attendanceService = useAttendanceService();

  const periodOptions = [
    { value: '7d' as TimePeriod, label: 'Last 7 Days' },
    { value: '30d' as TimePeriod, label: 'Last 30 Days' },
    { value: '90d' as TimePeriod, label: 'Last 90 Days' },
    { value: 'semester' as TimePeriod, label: 'This Semester' },
    { value: 'year' as TimePeriod, label: 'This Year' }
  ];

  const getDateRange = (period: TimePeriod) => {
    const today = new Date();
    switch (period) {
      case '7d': return { start: subDays(today, 7), end: today };
      case '30d': return { start: subDays(today, 30), end: today };
      case '90d': return { start: subDays(today, 90), end: today };
      case 'semester': return { start: subMonths(today, 6), end: today };
      case 'year': return { start: subMonths(today, 12), end: today };
      default: return { start: subDays(today, 30), end: today };
    }
  };

  // Load attendance data
  useEffect(() => {
    const loadAttendanceData = async () => {
      setIsLoading(true);
      try {
        const { start, end } = getDateRange(selectedPeriod);
        const filters = {
          student_id: studentId,
          start_date: format(start, 'yyyy-MM-dd'),
          end_date: format(end, 'yyyy-MM-dd'),
          ...(classId && { class_id: classId }),
          ...(academicYearId && { academic_year_id: academicYearId })
        };

        // Load records and summary in parallel
        const [records, summary] = await Promise.all([
          attendanceService.getStudentAttendance(studentId, {
            start_date: filters.start_date,
            end_date: filters.end_date
          }),
          attendanceService.getAttendanceSummary(filters)
        ]);

        setAttendanceRecords(records.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
        setAttendanceSummary(summary);

        // Generate trend data (weekly breakdown)
        const trendData: AttendanceTrend[] = [];
        const weeks = Math.min(12, Math.ceil((end.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000)));
        
        for (let i = 0; i < weeks; i++) {
          const weekEnd = subWeeks(end, i);
          const weekStart = subWeeks(weekEnd, 1);
          
          const weekRecords = records.filter(record => {
            const recordDate = new Date(record.date);
            return recordDate >= weekStart && recordDate <= weekEnd;
          });
          
          const presentCount = weekRecords.filter(r => 
            r.status === AttendanceStatus.PRESENT || 
            r.status === AttendanceStatus.LATE || 
            r.status === AttendanceStatus.EXCUSED
          ).length;
          
          trendData.unshift({
            period: format(weekStart, 'MMM dd'),
            attendance_rate: weekRecords.length > 0 ? (presentCount / weekRecords.length) * 100 : 0,
            total_days: weekRecords.length,
            present_days: presentCount
          });
        }
        
        setAttendanceTrends(trendData);
      } catch (error) {
        console.error('Error loading attendance data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadAttendanceData();
  }, [selectedPeriod, studentId, classId, academicYearId, attendanceService]);

  const getStatusIcon = (status: AttendanceStatus) => {
    switch (status) {
      case AttendanceStatus.PRESENT: return '✅';
      case AttendanceStatus.ABSENT: return '❌';
      case AttendanceStatus.LATE: return '⏰';
      case AttendanceStatus.EXCUSED: return '📝';
      default: return '❓';
    }
  };

  const exportData = () => {
    const csvContent = [
      ['Date', 'Status', 'Check In', 'Check Out', 'Comments'],
      ...attendanceRecords.map(record => [
        record.date,
        record.status,
        record.check_in_time || '',
        record.check_out_time || '',
        record.comments || ''
      ])
    ].map(row => row.join(',')).join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance-${studentName || studentId}-${selectedPeriod}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <Card key={i}>
            <CardContent className="h-32 flex items-center justify-center">
              <div className="animate-pulse bg-gray-200 h-4 w-3/4 rounded"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5" />
                {studentName ? `${studentName}&apos;s Attendance` : 'Student Attendance'}
              </CardTitle>
              <p className="text-sm text-gray-500 mt-1">
                Detailed attendance history and analytics
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={exportData}>
                <Download className="w-4 h-4 mr-1" />
                Export
              </Button>
            </div>
          </div>
          
          {/* Period Selector */}
          <div className="flex gap-2 mt-4">
            {periodOptions.map(option => (
              <Button
                key={option.value}
                variant={selectedPeriod === option.value ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedPeriod(option.value)}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </CardHeader>
      </Card>

      {/* Summary Card */}
      {attendanceSummary && (
        <AttendanceSummaryCard 
          summary={attendanceSummary}
          title={`Attendance Summary - ${periodOptions.find(p => p.value === selectedPeriod)?.label}`}
        />
      )}

      {/* Trends Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Attendance Trends
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {attendanceTrends.map((trend, index) => (
              <div key={index} className="flex items-center gap-4">
                <div className="w-16 text-sm text-gray-600">
                  {trend.period}
                </div>
                <div className="flex-1">
                  <Progress value={trend.attendance_rate} className="h-2" />
                </div>
                <div className="w-20 text-sm text-right">
                  {trend.attendance_rate.toFixed(1)}%
                </div>
                <div className="w-16 text-xs text-gray-500 text-right">
                  {trend.present_days}/{trend.total_days}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent Records */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Recent Attendance Records
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {attendanceRecords.slice(0, 20).map((record) => (
              <div
                key={record.id}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg">{getStatusIcon(record.status)}</span>
                  <div>
                    <p className="font-medium">
                      {format(new Date(record.date), 'EEEE, MMMM d, yyyy')}
                    </p>
                    <div className="flex gap-2 text-sm text-gray-500">
                      {record.check_in_time && (
                        <span>In: {format(new Date(record.check_in_time), 'HH:mm')}</span>
                      )}
                      {record.check_out_time && (
                        <span>Out: {format(new Date(record.check_out_time), 'HH:mm')}</span>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <AttendanceStatusBadge status={record.status} size="sm" />
                  {record.comments && (
                    <div className="max-w-xs">
                      <p className="text-xs text-gray-600 truncate">
                        {record.comments}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ))}
            
            {attendanceRecords.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <Calendar className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No attendance records found for the selected period.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
