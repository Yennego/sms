'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTenantNavigation } from '@/hooks/use-tenant';
import { useClassService } from '@/services/api/class-service';
import { useScheduleService } from '@/services/api/schedule-service';
import { ClassWithDetails } from '@/types/class';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, Calendar, MapPin, Edit, Download } from 'lucide-react';
import { toast } from 'sonner';
import { useEnrollmentService } from '@/services/api/enrollment-service';
import { Input } from '@/components/ui/input';
import { useStudentService } from '@/services/api/student-service';
import { useSectionService } from '@/services/api/section-service';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table';
import type { Grade, Section } from '@/types/enrollment';
import type { Student } from '@/types/student';

export default function ClassDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { createTenantPath } = useTenantNavigation();
  const classService = useClassService();
  const scheduleService = useScheduleService();
  const enrollmentService = useEnrollmentService();
  const studentService = useStudentService();
  const sectionApi = useSectionService();

  const classId = params.id as string;
  

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [classDetails, setClassDetails] = useState<ClassWithDetails | null>(null);
  const [enrollmentCount, setEnrollmentCount] = useState<number>(0);
  const [enrollments, setEnrollments] = useState<Array<{ student_id?: string; student?: { id?: string }; student_name?: string; student_full_name?: string; enrollment_date?: string }>>([]);
  const [schedules, setSchedules] = useState<Array<{ id: string; day_of_week: string; period?: number; start_time: string; end_time: string }>>([]);

  const fetchData = useCallback(async () => {
    if (!classService.isApiReady) return;
    try {
      setLoading(true);
      setError(null);

      const [details, count, roster, scheds] = await Promise.all([
        classService.getClassWithDetails(classId),
        classService.getClassEnrollmentCount(classId, { is_active: true }),
        classService.getClassEnrollments(classId, { is_active: true }),
        scheduleService.getSchedules({ class_id: classId }),
      ]);

      setClassDetails(details);
      setEnrollmentCount(count);
      setEnrollments(roster || []);
      setSchedules(scheds || []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load class data';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [classId, classService, scheduleService]);

  useEffect(() => {
    if (!classService.isApiReady) return;
    fetchData();
  }, [classId, classService.isApiReady, fetchData]);

  // Enroll/Search state
  const [currentAcademicYearId, setCurrentAcademicYearId] = useState<string | null>(null);
  const [enrolledStudentIdsThisYear, setEnrolledStudentIdsThisYear] = useState<Set<string>>(new Set());

  const [studentToEnroll, setStudentToEnroll] = useState<string>('');
  const [gradeOptions, setGradeOptions] = useState<Grade[]>([]);
  const [gradeIdFilter, setGradeIdFilter] = useState<string>('');
  const [sectionOptions, setSectionOptions] = useState<Section[]>([]);
  const [sectionIdFilter, setSectionIdFilter] = useState<string>('');
  const [studentSearchTerm, setStudentSearchTerm] = useState<string>('');
  const [studentResults, setStudentResults] = useState<Student[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [studentsLoading, setStudentsLoading] = useState<boolean>(false);

  // Derived table data – must come AFTER studentResults declaration
  const filteredStudentResults = useMemo(
    () => (studentResults || []).filter(s => !enrolledStudentIdsThisYear.has(s.id)),
    [studentResults, enrolledStudentIdsThisYear]
  );
  useEffect(() => {
    async function loadYear() {
      try {
        const year = await enrollmentService.getCurrentAcademicYear();
        if (year?.id) setCurrentAcademicYearId(year.id);
        // name available but not used in this view
      } catch {
        // ignore
      }
    }
    loadYear();
  }, [enrollmentService]);

  useEffect(() => {
    (async () => {
      try {
        const gs = await enrollmentService.getGrades();
        setGradeOptions(Array.isArray(gs) ? gs : []);
      } catch {
        setGradeOptions([]);
      }
    })();
  }, [enrollmentService]);

  useEffect(() => {
    if (classDetails?.grade_id) setGradeIdFilter(classDetails.grade_id);
    if (classDetails?.section_id) setSectionIdFilter(classDetails.section_id);
  }, [classDetails]);

  // Load sections when grade changes
  useEffect(() => {
    (async () => {
      if (!gradeIdFilter) {
        setSectionOptions([]);
        setSectionIdFilter('');
        return;
      }
      try {
        const ss = await sectionApi.getSectionsByGrade(gradeIdFilter);
        const list = Array.isArray(ss) ? ss : [];
        setSectionOptions(list);
        if (list.length && !list.find(s => s.id === sectionIdFilter)) {
          setSectionIdFilter(list[0].id);
        }
      } catch {
        setSectionOptions([]);
        setSectionIdFilter('');
      }
    })();
  }, [gradeIdFilter, sectionApi, sectionIdFilter]);
  
  const gradeName = useMemo(
    () => gradeOptions.find(g => g.id === gradeIdFilter)?.name,
    [gradeIdFilter, gradeOptions]
  );
  const sectionName = useMemo(
    () => sectionOptions.find(s => s.id === sectionIdFilter)?.name,
    [sectionIdFilter, sectionOptions]
  );

  const lastStudentReqIdRef = useRef(0);

  // Keep a simple function for manual refresh (now stable via useCallback)
  const loadStudents = useCallback(async () => {
    if (!gradeName) {
      setStudentResults([]);
      return;
    }
    const reqId = ++lastStudentReqIdRef.current;
    setStudentsLoading(true);
    try {
      // Get all active students (server-side filters may be limited)
      const res = await studentService.getStudents({
        grade: gradeName,
        section: sectionName,
        status: 'active',
      });
      let list = Array.isArray(res) ? res : [];
      
      // Build roster set to exclude students already enrolled in this class
      const classRosterIds = new Set<string>(
        (enrollments || [])
          .map((e: { student_id?: string; student?: { id?: string } }) => e.student_id ?? e.student?.id)
          .filter((v): v is string => typeof v === 'string')
      );
      setEnrolledStudentIdsThisYear(classRosterIds);
      
      // Use bulk current enrollments to resolve grade/section names reliably
      if (list.length) {
        const bulkMap = await enrollmentService.getBulkCurrentEnrollments(list.map(s => s.id));
        const matchesFilter = (studentId: string) => {
          const enr = bulkMap.get(studentId);
          const g = enr?.grade || '';
          const s = enr?.section || '';
          const gradeOk = !gradeName || g === gradeName;
          const sectionOk = !sectionName || s === sectionName;
          return gradeOk && sectionOk;
        };
        list = list
          .filter(s => matchesFilter(s.id))
          .filter(s => !classRosterIds.has(s.id));
        setSelectedStudentIds(prev => prev.filter(id => !classRosterIds.has(id)));
      }

      if (lastStudentReqIdRef.current === reqId) {
        setStudentResults(list);
      }
    } catch {
      if (lastStudentReqIdRef.current === reqId) {
        toast.error('Failed to load students');
        setStudentResults([]);
      }
    } finally {
      if (lastStudentReqIdRef.current === reqId) {
        setStudentsLoading(false);
      }
    }
  }, [studentService, gradeName, sectionName, enrollments, enrollmentService]);

  // Auto-load students when filters change (single effect)
  useEffect(() => {
    if (!gradeIdFilter) return;
    loadStudents();
  }, [gradeIdFilter, sectionIdFilter, loadStudents]);

  useEffect(() => {
    if (gradeIdFilter) {
      loadStudents();
    }
  }, [gradeIdFilter, sectionIdFilter, loadStudents]);

  // Single enroll by explicit student ID input (now accepts optional idParam)
  const handleEnrollStudent = async (idParam?: string) => {
    const studentId = (idParam ?? studentToEnroll).trim();
    if (!studentId || !currentAcademicYearId || !classDetails) return;

    // Use class roster set for “already enrolled in this class”
    if (enrolledStudentIdsThisYear.has(studentId)) {
      toast.info(`Student is already enrolled in this class.`);
      setStudentResults(prev => prev.filter(s => s.id !== studentId));
      setSelectedStudentIds(prev => prev.filter(id => id !== studentId));
      return;
    }

    // Create class enrollment (not academic enrollment)
    const payload = {
      student_id: studentId,
      class_id: classId,
      academic_year_id: currentAcademicYearId,
      enrollment_date: new Date().toISOString().split('T')[0],
      status: 'active'
    };

    try {
      await classService.createClassEnrollment(payload);
      toast.success('Student enrolled in class');
      setEnrolledStudentIdsThisYear(prev => new Set([...prev, studentId]));
      setStudentResults(prev => prev.filter(s => s.id !== studentId));
      setSelectedStudentIds(prev => prev.filter(id => id !== studentId));
      setEnrollmentCount(prev => prev + 1);
      setStudentToEnroll('');
      fetchData();
    } catch (err: unknown) {
      const e = err as { detail?: unknown; message?: unknown; error?: unknown };
      const msg = typeof e.detail === 'string' ? e.detail : typeof e.message === 'string' ? e.message : '';
      if (msg.toLowerCase().includes('already')) {
        toast.info(`Already enrolled in class — removed from list.`);
        setEnrolledStudentIdsThisYear(prev => new Set([...prev, studentId]));
        setStudentResults(prev => prev.filter(s => s.id !== studentId));
        setSelectedStudentIds(prev => prev.filter(id => id !== studentId));
      } else {
        toast.error('Enrollment failed', { description: msg || 'Please try again.' });
      }
    }
  };

  const toggleStudentSelection = (id: string) => {
    setSelectedStudentIds(prev => (prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]));
  };

  const handleBulkEnrollSelected = async () => {
    if (!selectedStudentIds.length || !currentAcademicYearId || !classDetails) return;

    // Filter out already-enrolled-in-class students
    const toEnroll = selectedStudentIds.filter(id => !enrolledStudentIdsThisYear.has(id));
    if (!toEnroll.length) {
      toast.info(`All selected students are already enrolled in this class.`);
      return;
    }

    try {
      await classService.bulkCreateClassEnrollments({
        class_id: classId,
        academic_year_id: currentAcademicYearId,
        student_ids: toEnroll,
        enrollment_date: new Date().toISOString().split('T')[0],
        status: 'active'
      });

      setEnrolledStudentIdsThisYear(prev => new Set([...prev, ...toEnroll]));
      setStudentResults(prev => prev.filter(s => !toEnroll.includes(s.id)));
      setSelectedStudentIds([]);
      setEnrollmentCount(prev => prev + toEnroll.length);

      toast.success(`Enrolled ${toEnroll.length} student(s)`);
      fetchData();
    } catch (err: unknown) {
      const e = err as { detail?: unknown; message?: unknown };
      const msg = typeof e.detail === 'string' ? e.detail : typeof e.message === 'string' ? e.message : '';
      toast.error('Bulk enrollment failed', { description: msg || 'Please try again.' });
    }
  };

  const handleEdit = () => {
    router.push(createTenantPath(`/classes/${classId}/edit`));
  };

  const handleExport = async (format: 'csv' | 'xlsx') => {
    try {
      const blob = await classService.exportClassEnrollments(classId, {
        format,
        details: true,
        is_active: true,
      });
      const filename = `class_${classId}_enrollments.${format}`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${format.toUpperCase()} roster`);
    } catch (error: unknown) {
      const e = error as { message?: unknown; detail?: unknown; error?: unknown };
      const message =
        (typeof e.message === 'string' && e.message) ||
        (typeof e.detail === 'string' && e.detail) ||
        (typeof e.error === 'string' && e.error) ||
        'Failed to export enrollments';
      toast.error('Export failed', { description: message });
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading class...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !classDetails) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-xl mx-auto text-center">
          <p className="text-red-600 mb-4">{error || 'Class not found'}</p>
          <Button variant="outline" onClick={() => router.push(createTenantPath('/classes'))}>
            Back to Classes
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{classDetails.name}</h1>
          <div className="mt-2 flex items-center gap-3 text-gray-600">
            <Badge variant={classDetails.is_active ? 'default' : 'secondary'}>
              {classDetails.is_active ? 'Active' : 'Inactive'}
            </Badge>
            <span className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              {classDetails.academic_year}
            </span>
            {classDetails.room && (
              <span className="flex items-center gap-1">
                <MapPin className="h-4 w-4" />
                Room {classDetails.room}
              </span>
            )}
          </div>
          <div className="mt-1 text-gray-600">
            <span className="font-medium">{classDetails.teacher_name}</span> • {classDetails.subject_name} • {classDetails.grade_name} {classDetails.section_name ? `(${classDetails.section_name})` : ''}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => handleExport('csv')} className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
          <Button variant="outline" onClick={() => handleExport('xlsx')} className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            Export XLSX
          </Button>
          <Button onClick={handleEdit} className="flex items-center gap-2">
            <Edit className="h-4 w-4" />
            Edit
          </Button>
        </div>
      </div>

      {/* Description */}
      {classDetails.description && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Description</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-700">{classDetails.description}</p>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Enrollments
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold">{enrollmentCount}</div>
            <p className="text-gray-500 mt-1">Active students</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Schedules
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold">{schedules.length}</div>
            <p className="text-gray-500 mt-1">Configured periods</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Meta</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1 text-gray-700">
              <div>Academic Year: {classDetails.academic_year}</div>
              <div>Subject: {classDetails.subject_name}</div>
              <div>Teacher: {classDetails.teacher_name}</div>
              <div>Grade: {classDetails.grade_name}{classDetails.section_name ? `, ${classDetails.section_name}` : ''}</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Schedules */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Class Schedules</CardTitle>
        </CardHeader>
        <CardContent>
          {schedules.length === 0 ? (
            <p className="text-gray-600">No schedules configured.</p>
          ) : (
            <div className="space-y-2">
              {schedules.map((s: { id: string; day_of_week: string; period?: number; start_time: string; end_time: string }) => (
                <div key={s.id} className="flex items-center justify-between p-3 border rounded-md">
                  <div className="font-medium capitalize">{s.day_of_week}</div>
                  <div className="text-gray-700">
                    {s.period !== undefined ? `Period ${s.period} • ` : ''}
                    {s.start_time} - {s.end_time}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Roster Preview */}
      <Card>
        <CardHeader>
          <CardTitle>Roster Preview</CardTitle>
        </CardHeader>
        <CardContent>
          {enrollments.length === 0 ? (
            <p className="text-gray-600">No enrollments found.</p>
          ) : (
            <ul className="divide-y">
              {enrollments.slice(0, 10).map((enr: { student_name?: string; student_full_name?: string; student?: { full_name?: string; id?: string }; student_id?: string; enrollment_date?: string }, idx: number) => (
                <li key={idx} className="py-3 flex justify-between">
                  <div>
                    <div className="font-medium">
                      {enr.student_name ||
                        enr.student_full_name ||
                        enr.student?.full_name ||
                        `Student #${idx + 1}`}
                    </div>
                    <div className="text-sm text-gray-600">
                      {enr.student_id || enr.student?.id ? `ID: ${enr.student_id || enr.student?.id}` : ''}
                    </div>
                  </div>
                  <div className="text-sm text-gray-600">
                    {enr.enrollment_date ? `Enrolled: ${enr.enrollment_date}` : ''}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      {/* Enroll Students */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Find & Enroll Students</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div>
              <label className="text-sm font-medium">Grade</label>
              <Select
                value={gradeIdFilter || undefined}
                onValueChange={(val) => setGradeIdFilter(val)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Grade" />
                </SelectTrigger>
                <SelectContent>
                  {gradeOptions.map(g => (
                    <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Section</label>
              <Select
                value={sectionIdFilter || undefined}
                onValueChange={(val) => setSectionIdFilter(val)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Section" />
                </SelectTrigger>
                <SelectContent>
                  {sectionOptions.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <label className="text-sm font-medium">Search (name, ID, admission #)</label>
              <Input
                placeholder="e.g. Jane, 9f8c..., ADM-2024-001"
                value={studentSearchTerm}
                onChange={(e) => setStudentSearchTerm(e.target.value)}
              />
            </div>
          </div>

          {/* In the table header/tooling count */}
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm text-gray-600">
              {studentsLoading ? 'Loading students…' : `Results: ${filteredStudentResults.length}`}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={loadStudents} disabled={!gradeIdFilter}>
                Refresh
              </Button>
              <Button onClick={handleBulkEnrollSelected} disabled={!selectedStudentIds.length || !currentAcademicYearId}>
                Enroll Selected
              </Button>
            </div>
          </div>
          <Table>
            <TableBody>
              {filteredStudentResults
                .filter(s => {
                  const term = studentSearchTerm.trim().toLowerCase();
                  if (!term) return true;
                  const fullName = [s.first_name, s.last_name].filter(Boolean).join(' ').toLowerCase();
                  return (
                    fullName.includes(term) ||
                    s.id?.toLowerCase().includes(term) ||
                    s.admission_number?.toLowerCase().includes(term)
                  );
                })
                .map(s => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={selectedStudentIds.includes(s.id)}
                        onChange={() => toggleStudentSelection(s.id)}
                      />
                    </TableCell>
                    <TableCell>{[s.first_name, s.last_name].filter(Boolean).join(' ') || s.email}</TableCell>
                    <TableCell className="font-mono text-xs">{s.id}</TableCell>
                    <TableCell className="font-mono text-xs">{s.admission_number || '-'}</TableCell>
                    <TableCell>{s.grade || '-'}</TableCell>
                    <TableCell>{s.section || '-'}</TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        onClick={async () => {
                          setStudentToEnroll(s.id);
                          await handleEnrollStudent();
                        }}
                        disabled={!currentAcademicYearId}
                      >
                        Enroll
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            <div className="md:col-span-2">
              <label className="text-sm font-medium">Enroll by Student ID</label>
              <Input
                placeholder="Enter Student UUID"
                value={studentToEnroll}
                onChange={(e) => setStudentToEnroll(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <Button
                onClick={() => handleEnrollStudent()}
                disabled={!studentToEnroll?.trim() || !currentAcademicYearId || !classDetails}
              >
                Enroll
              </Button>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Enrolls into this class&apos;s grade/section for the current academic year.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
