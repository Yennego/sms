import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AttendanceStatusBadge } from './AttendanceStatusBadge';
import { useAttendanceService } from '@/services/api/attendance-service';
import { AttendanceStatus, Attendance } from '@/types/attendance';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns';

interface AttendanceCalendarProps {
  studentId?: string;
  classId?: string;
  academicYearId?: string;
  onDateSelect?: (date: Date, attendance?: Attendance[]) => void;
}

interface DayAttendance {
  date: Date;
  attendance: Attendance[];
  summary: {
    total: number;
    present: number;
    absent: number;
    late: number;
    excused: number;
  };
}

export const AttendanceCalendar: React.FC<AttendanceCalendarProps> = ({
  studentId,
  classId,
  academicYearId,
  onDateSelect
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [attendanceData, setAttendanceData] = useState<Map<string, DayAttendance>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const attendanceService = useAttendanceService();

  // Load attendance data for current month
  useEffect(() => {
    const loadMonthlyAttendance = async () => {
      setIsLoading(true);
      try {
        const monthStart = startOfMonth(currentDate);
        const monthEnd = endOfMonth(currentDate);
        
        const filters = {
          start_date: format(monthStart, 'yyyy-MM-dd'),
          end_date: format(monthEnd, 'yyyy-MM-dd'),
          ...(studentId && { student_id: studentId }),
          ...(classId && { class_id: classId }),
          ...(academicYearId && { academic_year_id: academicYearId })
        };

        const attendanceRecords = await attendanceService.getAttendanceRecords(filters);
        
        // Group attendance by date
        const attendanceMap = new Map<string, DayAttendance>();
        const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
        
        // Initialize all days
        monthDays.forEach(day => {
          const dateKey = format(day, 'yyyy-MM-dd');
          attendanceMap.set(dateKey, {
            date: day,
            attendance: [],
            summary: { total: 0, present: 0, absent: 0, late: 0, excused: 0 }
          });
        });
        
        // Populate with actual attendance data
        attendanceRecords.forEach(record => {
          const dateKey = record.date;
          const dayData = attendanceMap.get(dateKey);
          
          if (dayData) {
            dayData.attendance.push(record);
            dayData.summary.total++;
            
            switch (record.status) {
              case AttendanceStatus.PRESENT:
                dayData.summary.present++;
                break;
              case AttendanceStatus.ABSENT:
                dayData.summary.absent++;
                break;
              case AttendanceStatus.LATE:
                dayData.summary.late++;
                break;
              case AttendanceStatus.EXCUSED:
                dayData.summary.excused++;
                break;
            }
          }
        });
        
        setAttendanceData(attendanceMap);
      } catch (error) {
        console.error('Error loading monthly attendance:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadMonthlyAttendance();
  }, [currentDate, studentId, classId, academicYearId, attendanceService]);

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => direction === 'prev' ? subMonths(prev, 1) : addMonths(prev, 1));
    setSelectedDate(null);
  };

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    const dateKey = format(date, 'yyyy-MM-dd');
    const dayData = attendanceData.get(dateKey);
    onDateSelect?.(date, dayData?.attendance);
  };

  const getDayStatus = (date: Date): { status: 'present' | 'absent' | 'partial' | 'none'; count: number } => {
    const dateKey = format(date, 'yyyy-MM-dd');
    const dayData = attendanceData.get(dateKey);
    
    if (!dayData || dayData.summary.total === 0) {
      return { status: 'none', count: 0 };
    }
    
    const { present, absent, late, excused, total } = dayData.summary;
    
    if (studentId) {
      // For individual student view
      if (present > 0 || late > 0 || excused > 0) return { status: 'present', count: 1 };
      if (absent > 0) return { status: 'absent', count: 1 };
    } else {
      // For class view
      if (absent === 0) return { status: 'present', count: total };
      if (present === 0 && late === 0 && excused === 0) return { status: 'absent', count: total };
      return { status: 'partial', count: total };
    }
    
    return { status: 'none', count: 0 };
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'present': return 'bg-green-100 text-green-800 border-green-200';
      case 'absent': return 'bg-red-100 text-red-800 border-red-200';
      case 'partial': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default: return 'bg-gray-50 text-gray-500 border-gray-200';
    }
  };

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
  
  // Pad calendar to start on Sunday
  const startDay = monthStart.getDay();
  const paddedDays = Array(startDay).fill(null).concat(calendarDays);
  
  // Group into weeks
  const weeks = [];
  for (let i = 0; i < paddedDays.length; i += 7) {
    weeks.push(paddedDays.slice(i, i + 7));
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
            <p className="text-gray-500">Loading calendar...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Attendance Calendar
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigateMonth('prev')}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="font-medium min-w-[140px] text-center">
              {format(currentDate, 'MMMM yyyy')}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigateMonth('next')}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
        
        {/* Legend */}
        <div className="flex gap-4 text-sm">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-green-200"></div>
            <span>Present/Good</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-yellow-200"></div>
            <span>Partial/Mixed</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-red-200"></div>
            <span>Absent/Poor</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-gray-200"></div>
            <span>No Data</span>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        {/* Calendar Grid */}
        <div className="space-y-2">
          {/* Day Headers */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="text-center text-sm font-medium text-gray-500 py-2">
                {day}
              </div>
            ))}
          </div>
          
          {/* Calendar Weeks */}
          {weeks.map((week, weekIndex) => (
            <div key={weekIndex} className="grid grid-cols-7 gap-1">
              {week.map((date, dayIndex) => {
                if (!date) {
                  return <div key={dayIndex} className="h-16"></div>;
                }
                
                const dayStatus = getDayStatus(date);
                const isSelected = selectedDate && isSameDay(date, selectedDate);
                const isCurrentMonth = isSameMonth(date, currentDate);
                const isToday = isSameDay(date, new Date());
                
                return (
                  <button
                    key={dayIndex}
                    onClick={() => handleDateClick(date)}
                    className={`
                      h-16 p-1 rounded-lg border-2 transition-all duration-200 hover:shadow-md
                      ${getStatusColor(dayStatus.status)}
                      ${isSelected ? 'ring-2 ring-blue-500' : ''}
                      ${!isCurrentMonth ? 'opacity-50' : ''}
                      ${isToday ? 'ring-1 ring-blue-300' : ''}
                    `}
                  >
                    <div className="text-sm font-medium">
                      {format(date, 'd')}
                    </div>
                    {dayStatus.count > 0 && (
                      <div className="text-xs mt-1">
                        {studentId ? (
                          <div className="w-2 h-2 rounded-full bg-current mx-auto"></div>
                        ) : (
                          <Badge variant="secondary" className="text-xs px-1 py-0">
                            {dayStatus.count}
                          </Badge>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        
        {/* Selected Date Details */}
        {selectedDate && (
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <h4 className="font-medium mb-2">
              {format(selectedDate, 'EEEE, MMMM d, yyyy')}
            </h4>
            {(() => {
              const dateKey = format(selectedDate, 'yyyy-MM-dd');
              const dayData = attendanceData.get(dateKey);
              
              if (!dayData || dayData.summary.total === 0) {
                return <p className="text-gray-500">No attendance data for this date.</p>;
              }
              
              return (
                <div className="space-y-2">
                  <div className="flex gap-4">
                    <Badge variant="outline">Total: {dayData.summary.total}</Badge>
                    <Badge className="bg-green-100 text-green-800">Present: {dayData.summary.present}</Badge>
                    <Badge variant="destructive">Absent: {dayData.summary.absent}</Badge>
                    <Badge className="bg-yellow-100 text-yellow-800">Late: {dayData.summary.late}</Badge>
                    <Badge className="bg-blue-100 text-blue-800">Excused: {dayData.summary.excused}</Badge>
                  </div>
                  
                  {studentId && dayData.attendance.length > 0 && (
                    <div className="mt-2">
                      <AttendanceStatusBadge status={dayData.attendance[0].status} />
                      {dayData.attendance[0].comments && (
                        <p className="text-sm text-gray-600 mt-1">
                          Note: {dayData.attendance[0].comments}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })()} 
          </div>
        )}
      </CardContent>
    </Card>
  );
};
