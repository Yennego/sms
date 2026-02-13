import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { useAttendanceService } from '@/services/api/attendance-service';
import { useClassService } from '@/services/api/class-service';
import { useAcademicGradeService } from '@/services/api/academic-grade-service';
import { useTeacherService } from '@/services/api/teacher-service';
import { useSectionService } from '@/services/api/section-service';
import { useSubjectService } from '@/services/api/subject-service';
import { Attendance, AttendanceFilters } from '@/types/attendance';
import { Class } from '@/types/class';
import type { AcademicGrade } from '@/types/academic-grade';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DailyAttendanceGrid } from '@/components/attendance/DailyAttendanceGrid';
import { useScheduleService } from '@/services/api/schedule-service';
import { useEnrollmentService } from '@/services/api/enrollment-service';
import type { Section } from '@/types/section';
import type { Subject } from '@/types/subject';
import type { Teacher } from '@/types/teacher';
import { Calendar, Download, FileText, Search, UserCheck } from 'lucide-react';

// Filters state type
interface AttendanceFiltersState {
  selectedDate: string;
  selectedClass: string;
  viewMode: 'daily' | 'weekly' | 'monthly';
}

interface AdHocPeriod {
  name: string;
  isActive: boolean;
}

export function EnhancedAttendanceDashboard() {
  const [filters, setFilters] = useState<AttendanceFiltersState>({
    selectedDate: new Date().toISOString().split('T')[0],
    selectedClass: '',
    viewMode: 'daily'
  });

  const [attendanceData, setAttendanceData] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(false);
  const [adHocPeriod, setAdHocPeriod] = useState<AdHocPeriod>({ name: '', isActive: false });

  // For marking attendance
  const [scheduleId, setScheduleId] = useState('');
  const [academicYearId, setAcademicYearId] = useState('');
  const [studentsForClass, setStudentsForClass] = useState<{ id: string; name: string; roll_number?: string }[]>([]);
  const [currentAcademicYearName, setCurrentAcademicYearName] = useState('');

  //core datasets and UI state
  const [grades, setGrades] = useState<AcademicGrade[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [availableSchedules, setAvailableSchedules] = useState<ScheduleItem[]>([]);

  // Services
  const attendanceService = useAttendanceService();
  const classService = useClassService();
  const gradeService = useAcademicGradeService();
  // const studentService = useStudentService();
  const teacherService = useTeacherService();
  const scheduleService = useScheduleService();
  const enrollmentService = useEnrollmentService();
  const subjectService = useSubjectService();
  const sectionService = useSectionService();

  const gridRef = React.useRef<HTMLDivElement>(null);

  const enrollmentServiceRef = React.useRef(enrollmentService);
  useEffect(() => {
    enrollmentServiceRef.current = enrollmentService;
  }, [enrollmentService]);

  const loadInitialData = React.useCallback(async () => {
    try {
      const [gradesData, classesData, subjectsData, sectionsRes, teachersData] = await Promise.all([
        gradeService.getAllGrades(),
        classService.getClasses(),
        subjectService.getAllSubjects(),
        sectionService.getSections(),
        teacherService.getTeachers()
      ]);
      setGrades(gradesData || []);
      setClasses(dedupeClasses(classesData || []));
      setSubjects(subjectsData || []);
      setSections(sectionsRes?.sections || []);
      setTeachers(teachersData || []);
    } catch (error) {
      console.error('Error loading initial data:', error);
    }
  }, [gradeService, classService, subjectService, sectionService, teacherService]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  useEffect(() => {
    setAdHocPeriod({ name: '', isActive: false });
  }, [filters.selectedClass, filters.selectedDate]);

  // Memoize filtered classes
  const filteredClasses = useMemo(() => dedupeClasses(classes), [classes]);




  // Load academic year + students when class changes
  const loadClassMeta = React.useCallback(async () => {
    if (!filters.selectedClass) {
      setStudentsForClass([]);
      return;
    }
    try {
      // class-service.getClassStudents already returns { id, name, roll_number }
      const students = await classService.getClassStudents(filters.selectedClass);
      console.log('[Attendance] Loaded students:', students.length, students);
      setStudentsForClass(students);
    } catch (err) {
      console.error('Failed loading class meta/students', err);
      setStudentsForClass([]);
    }
  }, [classService, filters.selectedClass]);

  useEffect(() => {
    loadClassMeta();
  }, [loadClassMeta]);

  // Auto-set academic year ID from current academic year if empty
  const fetchCurrentAcademicYear = React.useCallback(async () => {
    const current = await enrollmentServiceRef.current.getCurrentAcademicYear();
    if (current?.id) {
      setAcademicYearId(current.id);
      setCurrentAcademicYearName(current.name);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        console.log('[Attendance] Fetching current academic year...');
        await fetchCurrentAcademicYear();
      } catch (err) {
        console.warn('[Attendance] Failed to auto-set academic year:', err);
      }
    })();
  }, [fetchCurrentAcademicYear]);

  // Resolve schedule_id from class and selected date
  useEffect(() => {
    async function resolveSchedule() {
      if (!filters.selectedClass || !filters.selectedDate) {
        setAvailableSchedules([]);
        return;
      }
      try {
        const date = new Date(filters.selectedDate);
        const dowMap = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;
        const weekday: ScheduleItem['day_of_week'] = dowMap[date.getUTCDay()];

        const list = await scheduleService.getSchedules({
          class_id: filters.selectedClass,
          day_of_week: weekday,
        });
        const schedules = Array.isArray(list) ? list : [];
        setAvailableSchedules(schedules);

        if (schedules.length === 1) {
          if (scheduleId !== schedules[0].id) {
            setScheduleId(schedules[0].id);
          }
        } else if (schedules.length > 1) {
          const stillValid = schedules.find(s => s.id === scheduleId);
          if (!stillValid && scheduleId) {
            setScheduleId('');
          }
        } else {
          if (scheduleId) {
            setScheduleId('');
          }
        }
      } catch (err) {
        console.warn('[Attendance] Failed to resolve schedule for class/date:', err);
        setAvailableSchedules([]);
        if (scheduleId) setScheduleId('');
      }
    }
    resolveSchedule();
  }, [filters.selectedClass, filters.selectedDate, scheduleId, scheduleService]);

  const loadAttendanceData = React.useCallback(async () => {
    if (!filters.selectedClass) return;

    setLoading(true);
    try {
      const attendanceFilters: AttendanceFilters = {
        class_id: filters.selectedClass,
        date: filters.selectedDate
      };

      console.log('[Attendance] Loading data for class:', filters.selectedClass, 'on date:', filters.selectedDate);
      const data = await attendanceService.getAttendanceRecords(attendanceFilters);
      console.log('[Attendance] Loaded', data.length, 'records');
      setAttendanceData(data);
    } catch (error) {
      console.error('Error loading attendance data:', error);
    } finally {
      setLoading(false);
    }
  }, [attendanceService, filters.selectedClass, filters.selectedDate]);

  useEffect(() => {
    loadAttendanceData();
  }, [loadAttendanceData]);

  // Get unique values for dropdowns
  // Build name lookup maps — MUST be declared before any reference
  const gradeMap = useMemo(
    () => Object.fromEntries((grades || []).map(g => [g.id, g.name])),
    [grades]
  );
  const sectionMap = useMemo(
    () => Object.fromEntries((sections || []).map(s => [s.id, s.name])),
    [sections]
  );
  const subjectMap = useMemo(
    () => Object.fromEntries((subjects || []).map(s => [s.id, s.name])),
    [subjects]
  );
  const teacherMap = useMemo(() => {
    const toName = (t: Teacher) => [t.first_name, t.last_name].filter(Boolean).join(' ') || t.id;
    return Object.fromEntries((teachers || []).map(t => [t.id, toName(t)]));
  }, [teachers]);

  // Helpers that depend on the maps — keep above JSX usage
  const formatClassLabel = (cls: Class) => {
    const g = gradeMap[cls.grade_id] || '—';
    const s = sectionMap[cls.section_id] || '—';
    const t = teacherMap[(cls as any).class_teacher_id] || 'Unassigned';
    return `${g} - ${s} (${t})`;
  };

  const getClassLabelById = (classId: string) => {
    const cls = classes.find(c => c.id === classId);
    return cls ? formatClassLabel(cls) : classId;
  };

  const handleMarkAttendance = () => {
    if (!filters.selectedClass) {
      alert('Please select a class first');
      return;
    }
    gridRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleExportReport = () => {
    if (!attendanceData.length) {
      alert('No data to export');
      return;
    }
    const headers = ['Student ID', 'Status', 'Class', 'Date', 'Marked By'];
    const rows = attendanceData.map(r => [
      r.student_id,
      r.status,
      getClassLabelById(r.class_id),
      r.date,
      r.marked_by
    ]);
    const csvContent = "data:text/csv;charset=utf-8,"
      + [headers.join(','), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `attendance_report_${filters.selectedDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Attendance Management</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExportReport}>Export Report</Button>
          <Button onClick={handleMarkAttendance}>Mark Attendance</Button>
        </div>
      </div>

      {/* Filters — simplified to only Class */}
      <Card>
        <CardHeader>
          <CardTitle>Class Selection</CardTitle>
        </CardHeader>
        <CardContent>
          <div>
            <label className="text-sm font-medium">Class</label>
            <Select
              value={filters.selectedClass || undefined}
              onValueChange={(value) => setFilters(prev => ({ ...prev, selectedClass: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select Class" />
              </SelectTrigger>
              <SelectContent>
                {filteredClasses.map(cls => (
                  <SelectItem key={cls.id} value={cls.id}>
                    {formatClassLabel(cls)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Attendance Content */}
      <Tabs value={filters.viewMode} onValueChange={(value) => setFilters(prev => ({ ...prev, viewMode: value as 'daily' | 'weekly' | 'monthly' }))}>
        <TabsList>
          <TabsTrigger value="daily">Daily View</TabsTrigger>
          <TabsTrigger value="weekly">Weekly View</TabsTrigger>
          <TabsTrigger value="monthly">Monthly View</TabsTrigger>
        </TabsList>

        <TabsContent value="daily">
          <Card>
            <CardHeader>
              <CardTitle>Records for {filters.selectedDate || '—'}</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-gray-500">Loading...</div>
              ) : attendanceData.length === 0 ? (
                <div className="text-gray-500">No attendance records for the selected filters.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Class</TableHead>
                      <TableHead>Schedule</TableHead>
                      <TableHead>Marked By</TableHead>
                      <TableHead>Comments</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {attendanceData.map((rec) => (
                      <TableRow key={rec.id}>
                        <TableCell>
                          {studentsForClass.find(s => s.id === rec.student_id)?.name || rec.student_id}
                        </TableCell>
                        <TableCell className="capitalize">{rec.status}</TableCell>
                        <TableCell>{getClassLabelById(rec.class_id)}</TableCell>
                        <TableCell>
                          {((() => {
                            const s = availableSchedules.find(s => s.id === rec.schedule_id);
                            if (!s) return rec.schedule_id;
                            const range = [s.start_time, s.end_time].filter(Boolean).join(' - ');
                            return range || s.id;
                          })())}
                        </TableCell>
                        <TableCell>{rec.marked_by}</TableCell>
                        <TableCell>{rec.comments || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Attendance Marking</CardTitle>
            </CardHeader>
            <CardContent>
              {!filters.selectedClass ? (
                <div className="text-gray-500">Select a class to mark attendance.</div>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    {/* Academic Year — locked, non-editable */}
                    <div>
                      <label className="text-sm font-medium">Academic Year</label>
                      <Input
                        placeholder="Current Academic Year"
                        value={currentAcademicYearName || '—'}
                        disabled
                      />
                    </div>
                    {/* Date — stays here only */}
                    <div>
                      <label className="text-sm font-medium">Date</label>
                      <Input
                        type="date"
                        value={filters.selectedDate}
                        onChange={(e) => setFilters(prev => ({ ...prev, selectedDate: e.target.value }))}
                      />
                    </div>
                    {/* Schedule Selector if multiple exist */}
                    {availableSchedules.length > 1 && (
                      <div>
                        <label className="text-sm font-medium">Select Period/Schedule</label>
                        <select
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                          value={scheduleId}
                          onChange={(e) => setScheduleId(e.target.value)}
                        >
                          <option value="">Select a schedule...</option>
                          {availableSchedules.map(s => (
                            <option key={s.id} value={s.id}>
                              {s.day_of_week} ({s.start_time} - {s.end_time})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  <div ref={gridRef}>
                    {academicYearId && studentsForClass.length > 0 && (scheduleId || adHocPeriod.isActive) ? (
                      <DailyAttendanceGrid
                        classId={filters.selectedClass}
                        scheduleId={scheduleId || undefined}
                        academicYearId={academicYearId}
                        date={filters.selectedDate}
                        students={studentsForClass}
                        manualPeriod={adHocPeriod.isActive ? adHocPeriod.name : undefined}
                        className={classes.find(c => c.id === filters.selectedClass)?.name}
                        onAttendanceMarked={() => loadAttendanceData()}
                      />
                    ) : (
                      <div className="text-gray-500 p-4 border rounded-lg bg-gray-50 flex flex-col gap-4">
                        <div className="flex items-center gap-3">
                          <div className="bg-yellow-100 p-2 rounded-full text-yellow-600">
                            <Calendar className="w-5 h-5" />
                          </div>
                          <div>
                            {(!academicYearId) ? "No current academic year found. Please set one in Academics > Academic Years." :
                              (studentsForClass.length === 0) ? "No students enrolled in this class." :
                                (!scheduleId) ? "No schedule found for this class on this day." :
                                  "Loading class data..."}
                          </div>
                        </div>

                        {!scheduleId && !adHocPeriod.isActive && academicYearId && studentsForClass.length > 0 && (
                          <div className="border-t pt-4 flex flex-col gap-3">
                            <p className="text-sm font-medium text-gray-700">Need to record an unscheduled session (e.g. replacement class)?</p>
                            <div className="flex gap-2 max-w-md">
                              <Input
                                placeholder="Enter period name (e.g. Extra Class)"
                                value={adHocPeriod.name}
                                onChange={(e) => setAdHocPeriod(prev => ({ ...prev, name: e.target.value }))}
                              />
                              <Button
                                variant="secondary"
                                onClick={() => adHocPeriod.name && setAdHocPeriod(prev => ({ ...prev, isActive: true }))}
                                disabled={!adHocPeriod.name}
                              >
                                Mark Ad-hoc
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="weekly">
          <WeeklyAttendanceView
            classId={filters.selectedClass}
            startDate={filters.selectedDate}
            getClassLabel={getClassLabelById}
          />
        </TabsContent>

        <TabsContent value="monthly">
          <MonthlyAttendanceView
            classId={filters.selectedClass}
            date={filters.selectedDate}
            getClassLabel={getClassLabelById}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function WeeklyAttendanceView({ classId, startDate, getClassLabel }: { classId: string, startDate: string, getClassLabel: (id: string) => string }) {
  const [data, setData] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(false);
  const attendanceService = useAttendanceService();

  useEffect(() => {
    if (!classId) return;
    const fetch = async () => {
      setLoading(true);
      try {
        const start = new Date(startDate);
        const end = new Date(start);
        end.setDate(end.getDate() + 6);
        const res = await attendanceService.getClassAttendance(classId, {
          start_date: startDate,
          end_date: end.toISOString().split('T')[0]
        });
        setData(res);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [classId, startDate, attendanceService]);

  if (!classId) return <div className="p-4 text-gray-500">Select a class to view weekly data.</div>;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Weekly Summary for {getClassLabel(classId)}</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? <p>Loading...</p> : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Present</TableHead>
                <TableHead>Absent</TableHead>
                <TableHead>Rate</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 7 }).map((_, i) => {
                const date = new Date(startDate);
                date.setDate(date.getDate() + i);
                const dateStr = date.toISOString().split('T')[0];
                const dayRecords = data.filter(r => r.date === dateStr);
                if (dayRecords.length === 0) return null;
                const present = dayRecords.filter(r => r.status === 'present').length;
                const total = dayRecords.length;
                return (
                  <TableRow key={dateStr}>
                    <TableCell>{dateStr}</TableCell>
                    <TableCell>{present}</TableCell>
                    <TableCell>{total - present}</TableCell>
                    <TableCell>{((present / total) * 100).toFixed(1)}%</TableCell>
                  </TableRow>
                );
              }).filter(Boolean)}
              {data.length === 0 && <TableRow><TableCell colSpan={4} className="text-center">No records found for this week.</TableCell></TableRow>}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function MonthlyAttendanceView({ classId, date, getClassLabel }: { classId: string, date: string, getClassLabel: (id: string) => string }) {
  const [data, setData] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(false);
  const attendanceService = useAttendanceService();

  useEffect(() => {
    if (!classId) return;
    const fetch = async () => {
      setLoading(true);
      try {
        const d = new Date(date);
        const start = new Date(d.getFullYear(), d.getMonth(), 1);
        const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
        const res = await attendanceService.getClassAttendance(classId, {
          start_date: start.toISOString().split('T')[0],
          end_date: end.toISOString().split('T')[0]
        });
        setData(res);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [classId, date, attendanceService]);

  if (!classId) return <div className="p-4 text-gray-500">Select a class to view monthly data.</div>;

  const total = data.length;
  const present = data.filter(r => r.status === 'present').length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Monthly Overview: {new Date(date).toLocaleString('default', { month: 'long', year: 'numeric' })}</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? <p>Loading...</p> : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="p-4 bg-blue-50">
                <p className="text-sm text-blue-600 font-medium">Total Records</p>
                <p className="text-2xl font-bold">{total}</p>
              </Card>
              <Card className="p-4 bg-green-50">
                <p className="text-sm text-green-600 font-medium">Present</p>
                <p className="text-2xl font-bold">{present}</p>
              </Card>
              <Card className="p-4 bg-red-50">
                <p className="text-sm text-red-600 font-medium">Absent</p>
                <p className="text-2xl font-bold">{total - present}</p>
              </Card>
              <Card className="p-4 bg-purple-50">
                <p className="text-sm text-purple-600 font-medium">Monthly Rate</p>
                <p className="text-2xl font-bold">{total ? ((present / total) * 100).toFixed(1) : 0}%</p>
              </Card>
            </div>
            {data.length === 0 && <p className="text-center text-gray-500 py-10">No data available for this month.</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Helper: dedupe classes by id
const dedupeClasses = (list: Class[]) => {
  const seen = new Set<string>();
  return (list || []).filter(c => {
    if (!c?.id) return false;
    if (seen.has(c.id)) return false;
    seen.add(c.id);
    return true;
  });
};

// Local Schedule type for this component
type ScheduleItem = {
  id: string;
  day_of_week: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
  start_time: string;
  end_time: string;
  period?: number;
  class_id: string;
};
