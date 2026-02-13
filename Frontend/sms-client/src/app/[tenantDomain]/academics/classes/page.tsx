'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Plus,
  Edit,
  Trash2,
  School,
  Users,
  BookOpen,
  AlertTriangle,
  CheckCircle,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import { AppError, ErrorType } from '@/utils/error-utils';
import EnrollmentDialogs from '../enrollments/components/EnrollmentDialogs';

// Import API services
import { useClassService } from '@/services/api/class-service';
import { useAcademicGradeService } from '@/services/api/academic-grade-service';
import { useSectionService } from '@/services/api/section-service';
import { useSubjectService } from '@/services/api/subject-service';
import { useEnrollmentService } from '@/services/api/enrollment-service';
import { useTeacherService } from '@/services/api/teacher-service';
import type { Class } from '@/types/class';
import type { AcademicGrade } from '@/types/academic-grade';
import type { Section } from '@/types/section';
import type { Subject } from '@/types/subject';
import type { Teacher } from '@/types/teacher';
import type { AcademicYear, Enrollment } from '@/types/enrollment';
import { Checkbox } from '@/components/ui/checkbox';
import { usePromotionService, PromotionStatusTag } from '@/services/api/promotion-service';
import { useApiClientWithLoading } from '@/services/api/api-client';
import { useGradingService } from '@/services/api/grading-service';
import { useClasses, useCreateClass, useUpdateClass, useDeleteClass } from '@/hooks/queries/classes';
import { useGrades } from '@/hooks/queries/academic-grades';
import { useSections, useSectionsByGrade } from '@/hooks/queries/sections';
import { useSubjects } from '@/hooks/queries/subjects';
import { useTeachers } from '@/hooks/queries/teachers';
import { useAcademicYearsList } from '@/hooks/queries/academic-years';
import { useGradingSchemas } from '@/hooks/queries/grading';
import { useQueries } from '@tanstack/react-query';

const EMPTY_ARRAY: any[] = [];


export default function ClassesPage() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedAcademicYear, setSelectedAcademicYear] = useState<string>('');
  const [selectedGrade, setSelectedGrade] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [transferRosterModalClass, setTransferRosterModalClass] = useState<Class | null>(null);
  const [promoteModalClass, setPromoteModalClass] = useState<Class | null>(null);
  const dialogsRef = React.useRef<{
    setTransferEnrollment: (e: Enrollment | null) => void;
    setPromoteEnrollment: (e: Enrollment | null) => void;
  }>(null);

  const classService = useClassService();
  const academicGradeService = useAcademicGradeService();
  const sectionService = useSectionService();
  const subjectService = useSubjectService();
  const teacherService = useTeacherService();
  const gradingService = useGradingService();
  const enrollmentService = useEnrollmentService();
  const promotionService = usePromotionService();

  // TankStack Query hooks
  const { data: classes = EMPTY_ARRAY, isLoading: classesLoading, error: classesError } = useClasses({
    academic_year_id: selectedAcademicYear || undefined,
    grade_id: selectedGrade !== 'all' ? selectedGrade : undefined,
  });

  const { data: academicYears = EMPTY_ARRAY } = useAcademicYearsList();
  const { data: grades = EMPTY_ARRAY } = useGrades();
  const { data: sectionsData } = useSections();
  const sections = sectionsData?.sections || EMPTY_ARRAY;
  const { data: teachers = EMPTY_ARRAY } = useTeachers();
  const { data: subjects = EMPTY_ARRAY } = useSubjects();

  // Grading schemas for assignment
  const { data: gradingSchemas = EMPTY_ARRAY } = useGradingSchemas();

  // Mutations
  const createClassMutation = useCreateClass();
  const updateClassMutation = useUpdateClass();
  const deleteClassMutation = useDeleteClass();

  // Local state for class creation
  const [formData, setFormData] = useState({
    academicYearId: '',
    gradeId: '',
    sectionId: '',
    classTeacherId: '',
    room: '',
    capacity: '30'
  });

  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<Class | null>(null);
  const [editFormData, setEditFormData] = useState({
    classTeacherId: '',
    room: '',
    capacity: '30'
  });

  const { isLoading: apiClientLoading } = useApiClientWithLoading();

  // Set default academic year when loaded
  useEffect(() => {
    if (!selectedAcademicYear && academicYears.length > 0) {
      const current = academicYears.find((y: any) => y.is_current);
      if (current && current.id !== selectedAcademicYear) {
        setSelectedAcademicYear(current.id);
        setFormData(prev => prev.academicYearId === current.id ? prev : { ...prev, academicYearId: current.id });
      }
    }
  }, [academicYears, selectedAcademicYear]);

  // Batch fetch enrollment counts using useQueries
  const enrollmentCountResults = useQueries({
    queries: (classes || EMPTY_ARRAY).map((c: any) => ({
      queryKey: ['class-enrollment-count', c.id, selectedAcademicYear],
      queryFn: () => classService.getClassEnrollmentCount(c.id, {
        academic_year_id: selectedAcademicYear,
        is_active: true
      }),
      enabled: !!c.id && !!selectedAcademicYear,
      staleTime: 30000, // 30 seconds
    }))
  });

  const enrollmentCounts = useMemo(() => {
    const map: Record<string, number> = {};
    (classes || EMPTY_ARRAY).forEach((c: any, i: number) => {
      map[c.id] = enrollmentCountResults[i]?.data ?? 0;
    });
    return map;
  }, [classes, enrollmentCountResults]);

  const loading = classesLoading || apiClientLoading;
  const error = classesError ? (classesError as Error).message : null;

  const handleCreateClass = async () => {
    if (!formData.academicYearId || !formData.gradeId || !formData.sectionId) {
      toast.error('Academic year, grade, and section are required');
      return;
    }

    try {
      await createClassMutation.mutateAsync({
        academic_year_id: formData.academicYearId,
        grade_id: formData.gradeId,
        section_id: formData.sectionId,
        class_teacher_id: formData.classTeacherId || undefined,
        room: formData.room || undefined,
        capacity: parseInt(formData.capacity) || 30,
        is_active: true
      });
      setIsCreateDialogOpen(false);
      // Reset form
      setFormData(prev => ({
        ...prev,
        gradeId: '',
        sectionId: '',
        classTeacherId: '',
        room: '',
        capacity: '30'
      }));
    } catch (err) {
      // Error handled by mutation
    }
  };

  const handleDeleteClass = async (classId: string) => {
    if (confirm('Are you sure you want to delete this class? This will also remove all subject assignments for this class.')) {
      try {
        await deleteClassMutation.mutateAsync(classId);
      } catch (err) {
        // Error handled by mutation
      }
    }
  };

  const handleOpenEditDialog = (c: Class) => {
    setEditingClass(c);
    setEditFormData({
      classTeacherId: c.class_teacher_id || '',
      room: c.room || '',
      capacity: String(c.capacity || 30)
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdateClass = async () => {
    if (!editingClass) return;

    try {
      await updateClassMutation.mutateAsync({
        id: editingClass.id,
        data: {
          class_teacher_id: editFormData.classTeacherId || undefined,
          room: editFormData.room || undefined,
          capacity: parseInt(editFormData.capacity) || 30
        }
      });
      setIsEditDialogOpen(false);
    } catch (err) {
      // Error handled by mutation
    }
  };

  const filteredClasses = useMemo(() => {
    if (!classes) return [];
    return classes.filter((c: any) => {
      const gMatch = selectedGrade === 'all' || c.grade_id === selectedGrade;
      const sMatch = !searchQuery ||
        c.grade_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.section_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.class_teacher_name?.toLowerCase().includes(searchQuery.toLowerCase());
      return gMatch && sMatch;
    });
  }, [classes, selectedGrade, searchQuery]);

  // Statistics
  const total = useMemo(() => {
    if (!Array.isArray(grades) || !Array.isArray(sections)) return 0;
    return grades.reduce((sum, g) => sum + sections.filter(s => s.grade_id === g.id).length, 0);
  }, [grades, sections]);
  const configured = classes?.length || 0;
  const completionPercentage = total > 0 ? Math.round((configured / total) * 100) : 0;

  // Grade/Section Map for faster lookup
  const sectionCapacityMap = useMemo(() => {
    const map: Record<string, number> = {};
    sections.forEach(s => {
      map[s.id] = s.capacity || 35;
    });
    return map;
  }, [sections]);

  // Helper for Section generation if they don't exist
  const syncSectionsForGrade = async () => {
    if (selectedGrade === 'all') {
      toast.error('Select a specific grade first');
      return;
    }

    try {
      const alphabet = 'ABCDE'.split('');
      const sectionsArray = Array.isArray(sections) ? sections : [];
      const promises = alphabet.map(async (letter) => {
        const name = `Section ${letter}`;
        // Check if exists
        const exists = sectionsArray.find(s => s.grade_id === selectedGrade && s.name === name);
        if (!exists) {
          return sectionService.createSection({
            grade_id: selectedGrade,
            name: name,
            capacity: 35
          });
        }
      });

      await Promise.all(promises);
      toast.success('Generated default Sections A-E for this Grade');
      window.location.reload();
    } catch (err) {
      toast.error('Failed to generate sections');
    }
  };

  // Build grid of Class availability
  const getClassCombinations = () => {
    const grid: any[] = [];
    if (Array.isArray(grades) && Array.isArray(sections)) {
      grades.forEach(g => {
        sections.filter(s => s.grade_id === g.id).forEach(s => {
          const c = (classes || []).find(cl => cl.grade_id === g.id && cl.section_id === s.id);
          grid.push({ grade: g, section: s, class: c });
        });
      });
    }
    return grid;
  };

  // --- Enrollment & Roster Logic ---
  const [rosterLoading, setRosterLoading] = useState(false);
  const [roster, setRoster] = useState<Enrollment[]>([]);
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [bulkPromoteLoading, setBulkPromoteLoading] = useState(false);

  // Fetch active enrollments for a class (IDs-only filters)
  const loadActiveRosterForClass = async (c: Class) => {
    setRosterLoading(true);
    setTransferRosterModalClass(c);
    try {
      const data = await enrollmentService.getEnrollments(0, 100, {
        grade_id: c.grade_id,
        section_id: c.section_id,
        status: 'active',
        academic_year_id: selectedAcademicYear
      });
      setRoster(data.items || []);
    } catch (err) {
      toast.error('Failed to load class roster');
    } finally {
      setRosterLoading(false);
    }
  };

  // Promote modal open logic
  const openPromoteModal = (c: Class) => {
    setPromoteModalClass(c);
    setRoster([]);
    setSelectedStudents([]);
    // Re-use same loader
    loadActiveRosterForClass(c);
  };

  const toggleStudentSelection = (id: string) => {
    setSelectedStudents(prev =>
      prev.includes(id) ? prev.filter(sid => sid !== id) : [...prev, id]
    );
  };

  const toggleAllStudents = () => {
    if (selectedStudents.length === roster.length) {
      setSelectedStudents([]);
    } else {
      setSelectedStudents(roster.map(r => r.id));
    }
  };

  const confirmBulkPromote = async () => {
    if (selectedStudents.length === 0) {
      toast.error('Select at least one student to promote/transfer');
      return;
    }

    setBulkPromoteLoading(true);
    try {
      // If promoting multiple students to NEXT year
      // Find current year
      const currentYear = academicYears.find(y => y.is_current);
      const nextYear = academicYears.find(y => !y.is_current && new Date(y.start_date) > new Date(currentYear?.start_date || ''));

      if (!nextYear) {
        throw new Error('No future academic year found for promotion');
      }

      // We'll perform one-by-one for now as the Bulk API is tailored for new student creation
      for (const enrollmentId of selectedStudents) {
        const enrollment = roster.find(r => r.id === enrollmentId);
        if (!enrollment) continue;

        // Perform promotion (business logic: current grade -> next grade)
        await promotionService.promoteEnrollment(enrollmentId, {
          target_academic_year: nextYear.id,
          promotion_type: 'grade'
        });
      }

      toast.success(`Successfully processed ${selectedStudents.length} students`);
      setPromoteModalClass(null);
      setSelectedStudents([]);
    } catch (err: any) {
      toast.error(err.message || 'Bulk operation failed');
    } finally {
      setBulkPromoteLoading(false);
    }
  };

  const openTransferRosterModal = (c: Class) => {
    setTransferRosterModalClass(c);
    setRoster([]);
    setSelectedStudents([]);
    loadActiveRosterForClass(c);
  };

  // Transformation for Dialogs
  const gradesForDialogs = grades.map(g => ({
    id: g.id,
    name: g.name,
    level: g.level,
    sections: sections.filter(s => s.grade_id === g.id)
  }));


  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <span className="ml-2 font-medium text-gray-600">Loading classes data...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 min-h-screen">
      <EnrollmentDialogs
        ref={dialogsRef as any}
        showCreateDialog={false}
        setShowCreateDialog={() => { }}
        showBulkDialog={false}
        setShowBulkDialog={() => { }}
        editingEnrollment={null}
        setEditingEnrollment={() => { }}
        students={[]}
        academicYears={academicYears}
        grades={gradesForDialogs as any}
        sections={sections as any}
        currentAcademicYear={academicYears.find(y => y.id === selectedAcademicYear) || null}
        onSuccess={async () => {
          setTransferRosterModalClass(null);
        }}
        hideButtons={true}
      />

      {/* Header Area - Always visible if not loading */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-6 border-b border-gray-200 mb-2">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Class Management</h1>
          <p className="text-gray-500 mt-1 max-w-2xl text-sm">
            Configure classes for each grade, section, and subject combination.
          </p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <Button
            onClick={() => setIsCreateDialogOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 shadow-lg shadow-blue-100 transition-all active:scale-95 flex-shrink-0 min-w-[140px]"
          >
            <Plus className="w-4 h-4 mr-2 stroke-[3px]" />
            Add Class
          </Button>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogContent className="max-w-md rounded-2xl">
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold">Create New Class</DialogTitle>
                <DialogDescription>
                  Set up a new class by selecting grade, section, and location details.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div>
                  <Label htmlFor="academicYear" className="text-gray-700 font-medium mb-1.5 block">Academic Year</Label>
                  <Select
                    value={formData.academicYearId}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, academicYearId: value }))}
                  >
                    <SelectTrigger className="rounded-lg border-gray-200">
                      <SelectValue placeholder="Select academic year" />
                    </SelectTrigger>
                    <SelectContent>
                      {academicYears.map(year => (
                        <SelectItem key={year.id} value={year.id}>
                          {year.name} {year.is_current && '(Current)'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="grade" className="text-gray-700 font-medium mb-1.5 block">Grade</Label>
                    <Select
                      value={formData.gradeId}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, gradeId: value, sectionId: '' }))}
                    >
                      <SelectTrigger className="rounded-lg border-gray-200">
                        <SelectValue placeholder="Select grade" />
                      </SelectTrigger>
                      <SelectContent>
                        {grades.map(grade => (
                          <SelectItem key={grade.id} value={grade.id}>
                            {grade.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="section" className="text-gray-700 font-medium mb-1.5 block">Section</Label>
                    <Select
                      value={formData.sectionId}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, sectionId: value }))}
                    >
                      <SelectTrigger className="rounded-lg border-gray-200">
                        <SelectValue placeholder="Select section" />
                      </SelectTrigger>
                      <SelectContent>
                        {sections
                          .filter((section: any) => section.grade_id === formData.gradeId)
                          .map((section: any) => (
                            <SelectItem key={section.id} value={section.id}>
                              {section.name}
                            </SelectItem>
                          ))}
                        {formData.gradeId && sections.filter((s: any) => s.grade_id === formData.gradeId).length === 0 && (
                          <div className="p-2 text-center text-xs text-gray-400 italic">
                            No sections found for this grade
                          </div>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label htmlFor="teacher" className="text-gray-700 font-medium mb-1.5 block">Class Sponsor (Teacher)</Label>
                  <Select
                    value={formData.classTeacherId}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, classTeacherId: value }))}
                  >
                    <SelectTrigger className="rounded-lg border-gray-200">
                      <SelectValue placeholder="Select teacher" />
                    </SelectTrigger>
                    <SelectContent>
                      {teachers.map(teacher => (
                        <SelectItem key={teacher.id} value={teacher.id}>
                          {teacher.first_name} {teacher.last_name} ({teacher.employee_id})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="room" className="text-gray-700 font-medium mb-1.5 block">Room / Location</Label>
                    <Input
                      id="room"
                      value={formData.room}
                      onChange={(e) => setFormData(prev => ({ ...prev, room: e.target.value }))}
                      placeholder="e.g., Room 101"
                      className="rounded-lg border-gray-200"
                    />
                  </div>
                  <div>
                    <Label htmlFor="capacity" className="text-gray-700 font-medium mb-1.5 block">Max Capacity</Label>
                    <Input
                      id="capacity"
                      type="number"
                      value={formData.capacity}
                      onChange={(e) => setFormData(prev => ({ ...prev, capacity: e.target.value }))}
                      min="1"
                      max="50"
                      className="rounded-lg border-gray-200"
                    />
                  </div>
                </div>
              </div>
              <div className="flex justify-end space-x-3 pt-6">
                <Button variant="ghost" onClick={() => setIsCreateDialogOpen(false)} disabled={createClassMutation.isPending} className="font-medium text-gray-500 hover:text-gray-700">
                  Cancel
                </Button>
                <Button onClick={handleCreateClass} disabled={createClassMutation.isPending} className="bg-blue-600 hover:bg-blue-700 font-bold px-8 rounded-lg shadow-md shadow-blue-100">
                  {createClassMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {createClassMutation.isPending ? 'Processing...' : 'Create Class'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {error && (
        <Alert className="border-red-100 bg-red-50/50 rounded-xl">
          <AlertTriangle className="h-5 w-5 text-red-500" />
          <AlertDescription className="text-red-700 font-medium flex items-center justify-between w-full">
            <span>Unable to load full class list: {error}</span>
            <Button variant="outline" size="sm" className="bg-white border-red-200 text-red-700 hover:bg-red-50 rounded-lg font-bold" onClick={() => window.location.reload()}>
              Retry Connection
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Main Content Area */}
      <div className="space-y-6">
        {/* Teacher Debug Alert */}
        {teachers.length === 0 && !loading && (
          <Alert className="border-yellow-200 bg-yellow-50 mb-4">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
            <AlertDescription className="text-yellow-800">
              <strong>No teachers loaded!</strong>
              <br />
              Teachers count: {teachers.length}. Check the browser console for API errors.
            </AlertDescription>
          </Alert>
        )}

        {/* Status Alert */}
        {configured === 0 && (
          <Alert className="border-red-200 bg-red-50">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800">
              <strong>No classes configured for the current academic year!</strong>
              <br />
              This is why you&apos;re seeing &quot;No subject assignments available&quot; in Teacher Assignments.
              You need to create classes first before teachers can be assigned to subjects.
            </AlertDescription>
          </Alert>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Classes</CardTitle>
              <School className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{configured}</div>
              <p className="text-xs text-muted-foreground">
                Out of {total} possible combinations
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Configuration Progress</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{completionPercentage}%</div>
              <div className="w-full bg-gray-200 rounded-full h-1 mt-2">
                <div
                  className="bg-blue-600 h-1 rounded-full"
                  style={{ width: `${completionPercentage}%` }}
                ></div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Capacity</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {(filteredClasses || []).reduce((sum, c) => sum + (sectionCapacityMap[(c as any).section_id] ?? 0), 0)}
              </div>
              <p className="text-xs text-muted-foreground">
                Student seats available
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Current Enrollment</CardTitle>
              <Badge variant="outline" className="h-4">Active</Badge>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {Object.values(enrollmentCounts || {}).reduce((a, b) => (a as number) + (b as number), 0)}
              </div>
              <p className="text-xs text-muted-foreground">
                Total students in session
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Filters and List */}
        <Card className="shadow-lg border-gray-100 rounded-2xl overflow-hidden">
          <CardHeader className="bg-gray-50/50 border-b border-gray-100 py-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-xl font-bold">Current Setup</CardTitle>
                <CardDescription>Manage and view configured class structures</CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Select value={selectedAcademicYear} onValueChange={setSelectedAcademicYear}>
                  <SelectTrigger className="w-[200px] rounded-lg shadow-sm border-gray-200">
                    <SelectValue placeholder="Academic Year" />
                  </SelectTrigger>
                  <SelectContent>
                    {academicYears.map(year => (
                      <SelectItem key={year.id} value={year.id}>
                        {year.name} {year.is_current && '(Current)'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={selectedGrade} onValueChange={setSelectedGrade}>
                  <SelectTrigger className="w-[180px] rounded-lg shadow-sm border-gray-200">
                    <SelectValue placeholder="Filter by Grade" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Grades</SelectItem>
                    {grades.map(grade => (
                      <SelectItem key={grade.id} value={grade.id}>{grade.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="relative w-[250px]">
                  <Input
                    placeholder="Search classes..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="rounded-lg shadow-sm pl-9 border-gray-200 focus:ring-blue-500"
                  />
                  <Users className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-white hover:bg-white border-b-2">
                <TableRow>
                  <TableHead className="font-bold py-4">Class Structure</TableHead>
                  <TableHead className="font-bold">Sponsor/Location</TableHead>
                  <TableHead className="font-bold">Capacity</TableHead>
                  <TableHead className="font-bold">Subject Load</TableHead>
                  <TableHead className="font-bold text-right pt-2 px-8 pr-12">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredClasses.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-48 text-center bg-gray-50/30">
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <School className="h-10 w-10 text-gray-300" />
                        <p className="text-gray-500 font-medium">No classes match your current filters</p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={syncSectionsForGrade}
                          className="mt-2 text-blue-600 border-blue-200"
                        >
                          Auto-Generate Default Sections
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredClasses.map((c: any) => (
                    <TableRow key={c.id} className="hover:bg-blue-50/30 transition-colors group">
                      <TableCell className="py-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-gray-900 leading-none mb-1">
                            {(c as any).grade_name} - {(c as any).section_name}
                          </span>
                          <span className="text-xs text-gray-500 font-medium">
                            {completionPercentage}% Target Met
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium text-gray-700 flex items-center">
                            <Users className="h-3 w-3 mr-1.5 opacity-60" />
                            {c.class_teacher_name || 'Unassigned'}
                          </span>
                          <span className="text-xs text-gray-500">{c.room || 'No Room'}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col space-y-1">
                          <div className="flex justify-between items-center text-xs px-1">
                            <span className="font-medium">{enrollmentCounts[c.id] || 0}/{c.capacity}</span>
                            <span className="text-gray-400">{Math.round(((enrollmentCounts[c.id] || 0) / c.capacity) * 100)}%</span>
                          </div>
                          <div className="w-28 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                            <div
                              className={cn(
                                "h-full transition-all",
                                ((enrollmentCounts[c.id] || 0) >= c.capacity) ? "bg-red-500" : "bg-blue-500"
                              )}
                              style={{ width: `${Math.min(100, ((enrollmentCounts[c.id] || 0) / c.capacity) * 100)}%` }}
                            ></div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="bg-purple-50 text-purple-700 border-purple-100">
                          <BookOpen className="h-3 w-3 mr-1" />
                          {c.subjects_count || 0} Subjects
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right pt-2 px-8 pr-12">
                        <div className="flex justify-end gap-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenEditDialog(c)}
                            title="Edit Settings"
                            className="text-gray-400 hover:text-blue-600"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openTransferRosterModal(c)}
                            title="Manage Students"
                            className="text-gray-400 hover:text-green-600"
                          >
                            <Users className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteClass(c.id)}
                            className="text-gray-400 hover:text-red-600"
                            title="Delete Class"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Promotion Roster Management Modal */}
      <Dialog open={!!promoteModalClass} onOpenChange={(o) => !o && setPromoteModalClass(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Students in {(promoteModalClass as any)?.grade_name} - {(promoteModalClass as any)?.section_name}</DialogTitle>
            <DialogDescription>
              Select students to bulk-promote to the next academic year.
            </DialogDescription>
          </DialogHeader>

          <div className="border rounded-md max-h-[400px] overflow-y-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-white z-10">
                <TableRow>
                  <TableHead className="w-[50px]">
                    <Checkbox
                      checked={selectedStudents.length === roster.length && roster.length > 0}
                      onCheckedChange={toggleAllStudents}
                    />
                  </TableHead>
                  <TableHead>Student Name</TableHead>
                  <TableHead>Admission #</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rosterLoading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto text-blue-600" />
                      <p className="mt-2 text-sm text-gray-500">Loading roster...</p>
                    </TableCell>
                  </TableRow>
                ) : roster.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-gray-500">
                      No active enrollments found for this class.
                    </TableCell>
                  </TableRow>
                ) : (
                  roster.map((r: any) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedStudents.includes(r.id)}
                          onCheckedChange={() => toggleStudentSelection(r.id)}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{r.student_name}</TableCell>
                      <TableCell>{r.admission_number}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn(
                          r.status === 'Eligible' ? "text-green-600 border-green-200 bg-green-50" :
                            r.status === 'Repeating' ? "text-red-600 border-red-200 bg-red-50" :
                              "text-yellow-600 border-yellow-200 bg-yellow-50"
                        )}>
                          {r.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex justify-between items-center bg-gray-50 p-4 rounded-lg">
            <span className="text-sm font-medium">{selectedStudents.length} students selected</span>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setPromoteModalClass(null)}>Cancel</Button>
              <Button
                onClick={confirmBulkPromote}
                disabled={bulkPromoteLoading || selectedStudents.length === 0}
                className="bg-green-600 hover:bg-green-700"
              >
                {bulkPromoteLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Promote to Next Year
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Class Details</DialogTitle>
            <DialogDescription>
              Update class settings for {(editingClass as any)?.grade_name} - {(editingClass as any)?.section_name}
            </DialogDescription>
          </DialogHeader>

          {editingClass && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-teacher">Class Sponsor</Label>
                <Select
                  value={editFormData.classTeacherId}
                  onValueChange={(value) => setEditFormData(prev => ({ ...prev, classTeacherId: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select teacher" />
                  </SelectTrigger>
                  <SelectContent>
                    {teachers.map(teacher => (
                      <SelectItem key={teacher.id} value={teacher.id}>
                        {teacher.first_name} {teacher.last_name} ({teacher.employee_id})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="edit-room">Room / Location</Label>
                <Input
                  id="edit-room"
                  value={editFormData.room}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, room: e.target.value }))}
                  placeholder="e.g., Room 101"
                />
              </div>
              <div>
                <Label htmlFor="edit-capacity">Class Capacity</Label>
                <Input
                  id="edit-capacity"
                  type="number"
                  value={editFormData.capacity}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, capacity: e.target.value }))}
                  min="1"
                  max="100"
                />
              </div>
            </div>
          )}
          <div className="flex justify-end space-x-2 pt-4">
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)} disabled={updateClassMutation.isPending}>
              Cancel
            </Button>
            <Button onClick={handleUpdateClass} disabled={updateClassMutation.isPending}>
              {updateClassMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {updateClassMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Utility class helper
function cn(...classes: any[]) {
  return classes.filter(Boolean).join(' ');
}
